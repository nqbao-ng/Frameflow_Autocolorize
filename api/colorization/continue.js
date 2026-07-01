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
} from './_shared.js';

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

  // Product rule:
  // target sketch luôn dùng source_image_url gốc.
  // reference luôn là colored frame gần nhất đã có colored_image_url.
  // Với forward propagation: Frame 5 lấy Frame 4 đã tô, nếu có.
  if (job.settings?.reference_strategy === 'nearest_colored_neighbor' && Number.isFinite(referenceIndex)) {
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

async function completeJob(supabase, jobId) {
  const { data, error } = await supabase
    .from('colorization_jobs')
    .update({
      status: JOB_STATUS.COMPLETED,
      current_review_frame_id: null,
    })
    .eq('id', jobId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function processOneFrame({ supabase, projectId, job }) {
  const nextFrame = await findNextPendingJobFrame(supabase, job, job.next_frame_index);

  if (!nextFrame) {
    const completedJob = await completeJob(supabase, job.id);
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

  await supabase
    .from('colorization_job_frames')
    .update({ pipeline_status: FRAME_PIPELINE_STATUS.PROCESSING })
    .eq('id', nextFrame.id);

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
  const jobUpdate = needsReview
    ? {
        status: JOB_STATUS.WAITING_REVIEW,
        current_review_frame_id: frameRecord.id,
        next_frame_index: currentCursor,
      }
    : {
        status: JOB_STATUS.RUNNING,
        current_review_frame_id: null,
        last_trusted_frame_id: frameRecord.id,
        next_frame_index: nextCursor,
      };

  const { data: updatedJob, error: updateJobError } = await supabase
    .from('colorization_jobs')
    .update(jobUpdate)
    .eq('id', job.id)
    .select('*')
    .single();

  if (updateJobError) throw updateJobError;

  return {
    kind: needsReview ? 'needs_review' : 'colorized',
    status: pipelineStatus,
    job: updatedJob,
    job_frame: updatedJobFrame,
    frame_id: frameRecord.id,
    result_url: colorizedUrl,
    overlay_url: overlayUrl,
    segment_ids_url: segmentIdsUrl,
    segments_json_url: segmentsJsonUrl,
    message: needsReview
      ? 'Frame needs review. Open RightPanel Review/Correction.'
      : 'Frame colorized by CV propagation.',
  };
}

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['POST'])) return;

  try {
    const body = await readJsonBody(req);
    const projectId = body.projectId || body.project_id;
    const jobId = body.jobId || body.job_id || null;
    const maxSteps = Math.max(1, Math.min(Number(body.maxSteps ?? body.max_steps ?? 8), 20));

    if (!projectId) return sendError(res, 400, 'projectId is required');

    const supabase = getSupabaseAdmin();
    let job = await getLatestJob(supabase, projectId, jobId);

    if (!job) return sendError(res, 404, 'No colorization job found for this project');

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
      last = await processOneFrame({ supabase, projectId, job });
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
      processed_count: processed.filter((item) => item.kind === 'colorized').length,
      processed,
      message: last?.message || 'Colorization continued.',
    });
  } catch (error) {
    return sendError(res, 500, 'Failed to continue colorization job', String(error?.message || error));
  }
}
