import {
  FRAME_PIPELINE_STATUS,
  JOB_STATUS,
  buildAssetPaths,
  buildCvSettings,
  callCvService,
  ensureMethod,
  getFrameById,
  getLatestJob,
  getRoleMemory,
  getSupabaseAdmin,
  readJsonBody,
  sendError,
  sendJson,
  uploadBase64Asset,
} from '../../server/colorization-shared.js';
import {
  COST_RATES,
  RESOURCE_TYPES,
  consumeUsage,
  estimateUsageCostUsd,
  enforceApiRateLimit,
  ensureProjectOwnership,
  recordUsageEvent,
  releaseUsage,
  requireUser,
} from '../../server/account-shared.js';

async function findNextPendingJobFrame(supabase, job, nextIndex) {
  const processingFrameIds = Array.isArray(job.settings?.processing_frame_ids)
    ? job.settings.processing_frame_ids.map(String)
    : [];

  if (processingFrameIds.length) {
    const startCursor = Math.max(0, Number(nextIndex ?? 0));
    for (let cursor = startCursor; cursor < processingFrameIds.length; cursor += 1) {
      const frameId = processingFrameIds[cursor];
      const { data, error } = await supabase
        .from('colorization_job_frames')
        .select('*')
        .eq('job_id', job.id)
        .eq('frame_id', frameId)
        .eq('pipeline_status', FRAME_PIPELINE_STATUS.PENDING)
        .maybeSingle();

      if (error) throw error;
      if (data) return { ...data, _order_cursor: cursor };
    }
    return null;
  }

  const { data, error } = await supabase
    .from('colorization_job_frames')
    .select('*')
    .eq('job_id', job.id)
    .gte('frame_index', Number(nextIndex ?? 0))
    .eq('pipeline_status', FRAME_PIPELINE_STATUS.PENDING)
    .order('frame_index', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function resolveReferenceFrame(supabase, job, targetJobFrame) {
  const referenceFrameId = job.settings?.reference_frame_id || job.last_trusted_frame_id;
  const referenceIndex = Number(job.settings?.reference_frame_index ?? NaN);
  const targetIndex = Number(targetJobFrame.frame_index ?? 0);
  const trustThreshold = Number(job.settings?.trusted_reference_min_confidence ?? 0.6);
  const strategy = job.settings?.reference_strategy || 'anchored_plus_nearest_safe';

  // Anchored propagation rule:
  // 1) Prefer the nearest already trusted/corrected job frame.
  // 2) Skip low-confidence generated frames as references.
  // 3) Fall back to the original correction keyframe so errors do not accumulate forever.
  if (strategy === 'anchored_plus_nearest_safe' && Number.isFinite(referenceIndex)) {
    let query = supabase
      .from('colorization_job_frames')
      .select('*')
      .eq('job_id', job.id)
      .in('pipeline_status', [
        FRAME_PIPELINE_STATUS.COLORIZED,
        FRAME_PIPELINE_STATUS.CORRECTION_APPLIED,
        FRAME_PIPELINE_STATUS.CORRECTION_KEYFRAME,
      ]);

    if (targetIndex >= referenceIndex) {
      query = query.lt('frame_index', targetIndex).order('frame_index', { ascending: false });
    } else {
      query = query.gt('frame_index', targetIndex).order('frame_index', { ascending: true });
    }

    const { data: candidates, error } = await query.limit(8);
    if (error) throw error;

    for (const row of candidates || []) {
      const summary = row.confidence_summary || {};
      const score = Number(summary.confidence_score ?? 1);
      const isManual = row.pipeline_status === FRAME_PIPELINE_STATUS.CORRECTION_APPLIED
        || row.pipeline_status === FRAME_PIPELINE_STATUS.CORRECTION_KEYFRAME;

      if (!isManual && score < trustThreshold) continue;

      const candidateFrame = await getFrameById(supabase, row.frame_id);
      if (candidateFrame?.source_image_url && candidateFrame?.colored_image_url) {
        return candidateFrame;
      }
    }
  }

  // Backward compatibility with old jobs.
  if (strategy === 'nearest_colored_neighbor' && Number.isFinite(referenceIndex)) {
    let query = supabase
      .from('frames')
      .select('*')
      .eq('project_id', job.project_id)
      .not('colored_image_url', 'is', null);

    if (targetIndex > referenceIndex) {
      query = query.lt('frame_index', targetIndex).order('frame_index', { ascending: false });
    } else if (targetIndex < referenceIndex) {
      query = query.gt('frame_index', targetIndex).order('frame_index', { ascending: true });
    } else {
      query = query.eq('id', referenceFrameId);
    }

    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throw error;
    if (data?.source_image_url && data?.colored_image_url) return data;
  }

  const fallback = await getFrameById(supabase, job.last_trusted_frame_id || referenceFrameId);
  if (fallback?.source_image_url && fallback?.colored_image_url) return fallback;

  const originalReference = await getFrameById(supabase, referenceFrameId);
  return originalReference;
}

async function completeJob(supabase, job) {
  const { data, error } = await supabase
    .from('colorization_jobs')
    .update({
      status: JOB_STATUS.COMPLETED,
      current_review_frame_id: null,
      error_message: null,
    })
    .eq('id', job.id)
    .in('status', [JOB_STATUS.CREATED, JOB_STATUS.RUNNING])
    .select('*')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    const conflict = new Error('The colorization job changed state before completion.');
    conflict.statusCode = 409;
    conflict.preserveJob = true;
    throw conflict;
  }
  if (job.usage_reservation_id) {
    await releaseUsage(supabase, job.usage_reservation_id);
  }
  await supabase
    .from('projects')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', job.project_id);
  return data;
}

async function processOneFrame({ supabase, projectId, job, userId }) {
  const startedAt = Date.now();
  const { data: activeProcessing, error: activeProcessingError } = await supabase
    .from('colorization_job_frames')
    .select('id')
    .eq('job_id', job.id)
    .eq('pipeline_status', FRAME_PIPELINE_STATUS.PROCESSING)
    .limit(1)
    .maybeSingle();
  if (activeProcessingError) throw activeProcessingError;
  if (activeProcessing) {
    const busy = new Error('Another request is already processing the current frame.');
    busy.statusCode = 409;
    busy.preserveJob = true;
    throw busy;
  }

  let nextFrame = await findNextPendingJobFrame(supabase, job, job.next_frame_index);

  if (!nextFrame) {
    const completedJob = await completeJob(supabase, job);
    return {
      kind: 'completed',
      status: JOB_STATUS.COMPLETED,
      job: completedJob,
      message: 'All frames completed.',
    };
  }

  const frameRecord = await getFrameById(supabase, nextFrame.frame_id);
  if (!frameRecord) throw new Error(`Frame not found: ${nextFrame.frame_id}`);

  const referenceFrame = await resolveReferenceFrame(supabase, job, nextFrame);
  if (!referenceFrame) throw new Error('Missing trusted reference frame. Upload/select a colored keyframe first.');

  const sourceImageUrl = frameRecord.source_image_url;
  const referenceLineUrl = referenceFrame.source_image_url;
  const referenceColorUrl = referenceFrame.colored_image_url;

  if (!sourceImageUrl) throw new Error('Current frame has no source_image_url.');
  if (!referenceLineUrl) throw new Error('Reference frame has no source_image_url.');
  if (!referenceColorUrl) throw new Error('Reference frame has no colored_image_url. Save/import the colored keyframe first.');

  const orderCursor = nextFrame._order_cursor;
  const { data: claimedFrame, error: claimError } = await supabase.rpc('claim_frameflow_colorization_frame', {
    p_job_id: job.id,
    p_job_frame_id: nextFrame.id,
  });
  if (claimError) throw claimError;
  if (!claimedFrame) {
    const busy = new Error('The next frame was already claimed or the job is no longer active.');
    busy.statusCode = 409;
    busy.preserveJob = true;
    throw busy;
  }
  nextFrame = { ...claimedFrame, _order_cursor: orderCursor };

  const roleMemory = await getRoleMemory(supabase, projectId);

  const cv = await callCvService('/v1/colorize-frame', {
    project_id: projectId,
    job_id: job.id,
    frame_id: frameRecord.id,
    frame_name: frameRecord.name || nextFrame.frame_name || `frame_${nextFrame.frame_index}.png`,
    frame_index: Number(nextFrame.frame_index ?? frameRecord.frame_index ?? 0),
    source_image_url: sourceImageUrl,
    reference_line_url: referenceLineUrl,
    reference_color_url: referenceColorUrl,
    reference_frame_id: referenceFrame.id,
    role_memory: roleMemory,
    settings: buildCvSettings(job.settings || {}),
  });

  const paths = buildAssetPaths({
    projectId,
    jobId: job.id,
    frameId: frameRecord.id,
    frameIndex: Number(nextFrame.frame_index ?? frameRecord.frame_index ?? 0),
    frameName: frameRecord.name || nextFrame.frame_name,
  });

  const bucket = 'colored-frames';
  const colorizedUrl = await uploadBase64Asset(supabase, {
    bucket,
    path: paths.colorized,
    base64: cv.assets.colorized_png_base64,
    contentType: 'image/png',
  });
  const overlayUrl = await uploadBase64Asset(supabase, {
    bucket,
    path: paths.overlay,
    base64: cv.assets.low_confidence_overlay_png_base64,
    contentType: 'image/png',
  });
  const segmentIdsUrl = await uploadBase64Asset(supabase, {
    bucket,
    path: paths.segmentIds,
    base64: cv.assets.segment_ids_png_base64,
    contentType: 'image/png',
  });
  const encodedSegmentMapUrl = cv.assets.encoded_segment_map_png_base64
    ? await uploadBase64Asset(supabase, {
        bucket,
        path: paths.encodedSegmentMap,
        base64: cv.assets.encoded_segment_map_png_base64,
        contentType: 'image/png',
      })
    : null;
  const segmentsJsonUrl = await uploadBase64Asset(supabase, {
    bucket,
    path: paths.segmentsJson,
    base64: cv.assets.segments_json_base64,
    contentType: 'application/json',
  });

  const needsReview = cv.status === FRAME_PIPELINE_STATUS.NEEDS_REVIEW;
  const pipelineStatus = needsReview ? FRAME_PIPELINE_STATUS.NEEDS_REVIEW : FRAME_PIPELINE_STATUS.COLORIZED;

  const confidenceSummary = {
    mode: 'cv_keyframe_guided_propagation',
    engine: 'frameflow_cv_service',
    confidence_score: cv.confidence_score,
    low_confidence_count: cv.low_confidence_count,
    num_segments: cv.num_segments,
    reason: cv.reason,
    reference_used_frame_id: referenceFrame.id,
    segments: cv.segments || [],
    debug: cv.debug || {},
  };

  const { data: updatedJobFrame, error: updateFrameError } = await supabase
    .from('colorization_job_frames')
    .update({
      pipeline_status: pipelineStatus,
      reference_used_frame_id: referenceFrame.id,
      low_confidence_count: cv.low_confidence_count,
      confidence_summary: confidenceSummary,
      colorized_url: colorizedUrl,
      low_confidence_overlay_url: overlayUrl,
      segment_ids_url: segmentIdsUrl,
      labels_asset_url: encodedSegmentMapUrl,
      segments_json_url: segmentsJsonUrl,
    })
    .eq('id', nextFrame.id)
    .select('*')
    .single();

  if (updateFrameError) throw updateFrameError;

  // Keep the generated colorized preview on the frame so the canvas can load/edit it.
  const { error: updateRealFrameError } = await supabase
    .from('frames')
    .update({
      colored_image_url: colorizedUrl,
      status: needsReview ? 'needs_review_not_reference' : 'colorized',
    })
    .eq('id', frameRecord.id);

  if (updateRealFrameError) throw updateRealFrameError;

  const nextCursor = nextFrame._order_cursor != null
    ? Number(nextFrame._order_cursor) + 1
    : Number(nextFrame.frame_index ?? frameRecord.frame_index ?? 0) + 1;
  const currentCursor = nextFrame._order_cursor != null
    ? Number(nextFrame._order_cursor)
    : Number(nextFrame.frame_index ?? frameRecord.frame_index ?? 0);
  const trustThreshold = Number(job.settings?.trusted_reference_min_confidence ?? 0.6);
  const resultConfidenceScore = Number(cv.confidence_score ?? 0);
  const canTrustResult = !needsReview && resultConfidenceScore >= trustThreshold;

  const jobUpdate = needsReview
    ? {
        status: JOB_STATUS.WAITING_REVIEW,
        current_review_frame_id: frameRecord.id,
        next_frame_index: currentCursor,
      }
    : {
        status: JOB_STATUS.RUNNING,
        current_review_frame_id: null,
        last_trusted_frame_id: canTrustResult ? frameRecord.id : job.last_trusted_frame_id,
        next_frame_index: nextCursor,
      };

  const { data: updatedJob, error: updateJobError } = await supabase
    .from('colorization_jobs')
    .update(jobUpdate)
    .eq('id', job.id)
    .in('status', [JOB_STATUS.CREATED, JOB_STATUS.RUNNING])
    .select('*')
    .maybeSingle();

  if (updateJobError) throw updateJobError;
  if (!updatedJob) {
    const conflict = new Error('The colorization job is no longer active.');
    conflict.statusCode = 409;
    conflict.preserveJob = true;
    throw conflict;
  }

  if (job.usage_reservation_id) {
    await consumeUsage(supabase, job.usage_reservation_id, 1);
  }
  const processingSeconds = (Date.now() - startedAt) / 1000;
  const visionCallCount = Number(cv.vision_call_count || cv.debug?.vision_call_count || 0);
  await recordUsageEvent(supabase, {
    userId,
    projectId,
    jobId: job.id,
    eventType: 'processing_frame_completed',
    resourceType: RESOURCE_TYPES.PROCESSING_FRAMES,
    quantity: 1,
    processingSeconds,
    visionCallCount,
    modelId: cv.vision_model_id || cv.debug?.vision_model_id || null,
    provider: 'frameflow_cv_service',
    status: needsReview ? 'needs_review' : 'completed',
    estimatedCostUsd: estimateUsageCostUsd({
      processingSeconds,
      visionCallCount,
      computeCostPerSecondUsd: COST_RATES.cvComputePerSecondUsd,
    }),
    metadata: {
      frame_id: frameRecord.id,
      frame_index: nextFrame.frame_index,
      confidence_score: cv.confidence_score,
      low_confidence_count: cv.low_confidence_count,
      reference_frame_id: referenceFrame.id,
    },
  });

  return {
    kind: needsReview ? 'needs_review' : 'colorized',
    status: pipelineStatus,
    job: updatedJob,
    job_frame: updatedJobFrame,
    frame_id: frameRecord.id,
    result_url: colorizedUrl,
    overlay_url: overlayUrl,
    segment_ids_url: segmentIdsUrl,
    labels_asset_url: encodedSegmentMapUrl,
    segments_json_url: segmentsJsonUrl,
    message: needsReview
      ? 'Frame needs review. Open RightPanel Review/Correction.'
      : 'Frame colorized by CV propagation.',
  };
}

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['POST'])) return;

  const supabase = getSupabaseAdmin();
  let user = null;
  let job = null;
  let projectId = null;

  try {
    user = await requireUser(req);
    await enforceApiRateLimit(supabase, { key: `colorization:continue:${user.id}`, limit: 120, windowSeconds: 60 });
    const body = await readJsonBody(req);
    projectId = body.projectId || body.project_id;
    const jobId = body.jobId || body.job_id || null;
    const maxSteps = Math.max(1, Math.min(Number(body.maxSteps ?? body.max_steps ?? 8), 20));

    if (!projectId) return sendError(res, 400, 'projectId is required');
    await ensureProjectOwnership(supabase, user.id, projectId);
    job = await getLatestJob(supabase, projectId, jobId);
    if (!job) return sendError(res, 404, 'No colorization job found for this project');
    if (job.user_id && job.user_id !== user.id) return sendError(res, 403, 'Colorization job access denied');

    if (job.status === JOB_STATUS.FAILED) {
      return sendError(res, 409, 'This colorization job failed. Start a new job to retry.', job.error_message || null);
    }
    if (job.status === JOB_STATUS.CANCELLED) {
      return sendError(res, 409, 'This colorization job was cancelled. Start a new job to continue.');
    }
    if (job.status === JOB_STATUS.COMPLETED) {
      return sendJson(res, 200, { ok: true, status: JOB_STATUS.COMPLETED, job, processed_count: 0, processed: [], message: 'Colorization job is already complete.' });
    }

    if (job.current_review_frame_id) {
      return sendJson(res, 200, {
        ok: true,
        status: JOB_STATUS.WAITING_REVIEW,
        job,
        frame_id: job.current_review_frame_id,
        message: 'Pipeline is waiting for user correction before continuing.',
      });
    }

    const processed = [];
    let last = null;
    for (let i = 0; i < maxSteps; i += 1) {
      last = await processOneFrame({ supabase, projectId, job, userId: user.id });
      processed.push(last);
      job = last.job;
      if (last.kind === 'needs_review' || last.kind === 'completed') break;
    }

    return sendJson(res, 200, {
      ok: true,
      status: last?.status || job.status,
      job,
      job_frame: last?.job_frame,
      frame_id: last?.frame_id,
      result_url: last?.result_url,
      overlay_url: last?.overlay_url,
      processed_count: processed.filter((item) => item.kind === 'colorized' || item.kind === 'needs_review').length,
      processed,
      message: last?.message || 'Colorization continued.',
    });
  } catch (error) {
    if (job?.id && !error?.preserveJob) {
      await Promise.all([
        supabase
          .from('colorization_jobs')
          .update({ status: JOB_STATUS.FAILED, error_message: error?.message || String(error) })
          .eq('id', job.id),
        supabase
          .from('colorization_job_frames')
          .update({ pipeline_status: FRAME_PIPELINE_STATUS.FAILED })
          .eq('job_id', job.id)
          .eq('pipeline_status', FRAME_PIPELINE_STATUS.PROCESSING),
        supabase
          .from('projects')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', projectId),
      ]).catch(() => null);
      if (job.usage_reservation_id) await releaseUsage(supabase, job.usage_reservation_id).catch(() => null);
    }
    if (user && projectId && !error?.preserveJob) {
      await recordUsageEvent(supabase, {
        userId: user.id,
        projectId,
        jobId: job?.id || null,
        eventType: 'colorization_job_failed',
        resourceType: RESOURCE_TYPES.PROCESSING_FRAMES,
        status: 'failed',
        metadata: { error: error?.message || String(error) },
      });
    }
    return sendError(res, Number(error?.statusCode) || 500, 'Failed to continue colorization job', error?.details || error?.message || String(error));
  }
}
