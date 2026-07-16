import { randomUUID } from 'node:crypto';
import {
  FRAME_PIPELINE_STATUS,
  JOB_STATUS,
  ensureMethod,
  getProjectFrames,
  getSupabaseAdmin,
  readJsonBody,
  sendError,
  sendJson,
} from '../../server/colorization-shared.js';
import {
  RESOURCE_TYPES,
  enforceApiRateLimit,
  ensureProjectOwnership,
  recordUsageEvent,
  releaseUsage,
  requireUser,
  reserveUsage,
} from '../../server/account-shared.js';

function frameIndex(frame) {
  return Number(frame?.frame_index ?? 0);
}

function uniqueStrings(values) {
  return Array.from(new Set((values || []).map(String).filter(Boolean)));
}

function buildForwardChainTargets(frames, referenceFrame, targetFrameIds) {
  const referenceIndex = frameIndex(referenceFrame);
  const targetIdSet = new Set(targetFrameIds);
  if (targetIdSet.size > 0) {
    const selected = frames.filter((frame) => targetIdSet.has(String(frame.id)) && frameIndex(frame) > referenceIndex);
    if (!selected.length) return [];
    const maxIndex = Math.max(...selected.map(frameIndex));
    return frames
      .filter((frame) => frame.id !== referenceFrame.id)
      .filter((frame) => frameIndex(frame) > referenceIndex && frameIndex(frame) <= maxIndex)
      .sort((a, b) => frameIndex(a) - frameIndex(b));
  }
  return frames
    .filter((frame) => frame.id !== referenceFrame.id && frameIndex(frame) > referenceIndex)
    .sort((a, b) => frameIndex(a) - frameIndex(b));
}

function buildBackwardChainTargets(frames, referenceFrame, targetFrameIds) {
  const referenceIndex = frameIndex(referenceFrame);
  const targetIdSet = new Set(targetFrameIds);
  if (targetIdSet.size > 0) {
    const selected = frames.filter((frame) => targetIdSet.has(String(frame.id)) && frameIndex(frame) < referenceIndex);
    if (!selected.length) return [];
    const minIndex = Math.min(...selected.map(frameIndex));
    return frames
      .filter((frame) => frame.id !== referenceFrame.id)
      .filter((frame) => frameIndex(frame) < referenceIndex && frameIndex(frame) >= minIndex)
      .sort((a, b) => frameIndex(b) - frameIndex(a));
  }
  return frames
    .filter((frame) => frame.id !== referenceFrame.id && frameIndex(frame) < referenceIndex)
    .sort((a, b) => frameIndex(b) - frameIndex(a));
}

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['POST'])) return;

  let reservationId = null;
  let user = null;
  let projectId = null;
  const supabase = getSupabaseAdmin();

  try {
    user = await requireUser(req);
    await enforceApiRateLimit(supabase, { key: `colorization:start:${user.id}`, limit: 10, windowSeconds: 60 });
    const body = await readJsonBody(req);
    projectId = body.projectId || body.project_id;
    const referenceFrameId = body.referenceFrameId || body.reference_frame_id || null;
    const targetFrameIds = uniqueStrings(body.targetFrameIds || body.target_frame_ids || []);
    const direction = ['forward', 'backward', 'both'].includes(body.direction) ? body.direction : 'forward';
    const overwriteExisting = body.overwriteExisting ?? body.overwrite_existing ?? true;
    const clientSettings = body.settings && typeof body.settings === 'object' ? body.settings : {};

    if (!projectId) return sendError(res, 400, 'projectId is required');
    await ensureProjectOwnership(supabase, user.id, projectId);

    const { data: activeJob, error: activeError } = await supabase
      .from('colorization_jobs')
      .select('id,status,current_review_frame_id')
      .eq('project_id', projectId)
      .in('status', [JOB_STATUS.CREATED, JOB_STATUS.RUNNING, JOB_STATUS.WAITING_REVIEW])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeError) throw activeError;
    if (activeJob) {
      const conflict = new Error(activeJob.current_review_frame_id
        ? 'This project already has a colorization job waiting for review.'
        : 'This project already has an active colorization job.');
      conflict.statusCode = 409;
      conflict.details = { jobId: activeJob.id, status: activeJob.status };
      throw conflict;
    }

    const frames = await getProjectFrames(supabase, projectId);
    if (!frames.length) return sendError(res, 400, 'Project has no frames. Upload sketch frames first.');

    const referenceFrame = referenceFrameId
      ? frames.find((frame) => String(frame.id) === String(referenceFrameId))
      : frames.find((frame) => frame.colored_image_url);
    if (!referenceFrame) return sendError(res, 400, 'No colored reference/keyframe found. Upload or save a colored keyframe first.');
    if (!referenceFrame.source_image_url) return sendError(res, 400, 'Reference frame is missing source_image_url.');
    if (!referenceFrame.colored_image_url) return sendError(res, 400, 'Reference frame must have colored_image_url. Save/import the colored keyframe first.');

    const referenceIndex = frameIndex(referenceFrame);
    const forwardTargets = buildForwardChainTargets(frames, referenceFrame, targetFrameIds);
    const backwardTargets = buildBackwardChainTargets(frames, referenceFrame, targetFrameIds);
    const processingFrames = direction === 'forward'
      ? forwardTargets
      : direction === 'backward'
        ? backwardTargets
        : [...forwardTargets, ...backwardTargets];
    const processingFrameIds = processingFrames.map((frame) => String(frame.id));
    if (!processingFrameIds.length) return sendError(res, 400, 'No target frames were selected for processing.');

    const jobId = randomUUID();
    const usage = await reserveUsage(supabase, {
      userId: user.id,
      resourceType: RESOURCE_TYPES.PROCESSING_FRAMES,
      amount: processingFrameIds.length,
      sourceType: 'colorization_job',
      sourceId: jobId,
      idempotencyKey: `colorization:${jobId}`,
      metadata: { project_id: projectId, frame_ids: processingFrameIds, direction },
    });
    reservationId = usage.reservation.id;

    const { data: job, error: jobError } = await supabase
      .from('colorization_jobs')
      .insert({
        id: jobId,
        user_id: user.id,
        project_id: projectId,
        usage_reservation_id: reservationId,
        status: JOB_STATUS.CREATED,
        last_trusted_frame_id: referenceFrame.id,
        next_frame_index: 0,
        settings: {
          mode: 'correction_keyframe_forward_propagation',
          reference_frame_id: referenceFrame.id,
          reference_frame_index: referenceIndex,
          target_frame_ids: processingFrameIds,
          processing_frame_ids: processingFrameIds,
          processing_direction: direction,
          overwrite_existing: Boolean(overwriteExisting),
          reference_strategy: 'anchored_plus_nearest_safe',
          trusted_reference_min_confidence: 0.6,
          review_every_n_frames: 0,
          backend: 'frameflow_cv_service',
          vision_ai_policy: 'included_in_processing_frame_and_triggered_only_when_needed',
          generation_api: 'none',
          line_threshold: 180,
          adaptive_threshold: true,
          gap_close_kernel: 3,
          gap_close_iterations: 1,
          line_dilate: 1,
          min_segment_area: 25,
          max_side: 0,
          low_confidence_threshold: 0.55,
          flow_min_ratio: 0.16,
          use_flow: true,
          line_mode: 'original',
          max_low_confidence: 20,
          use_role_memory: true,
          role_memory_override_max_confidence: 0.82,
          ...clientSettings,
        },
      })
      .select('*')
      .single();
    if (jobError) throw jobError;

    const jobFramesPayload = [
      {
        job_id: job.id,
        project_id: projectId,
        frame_id: referenceFrame.id,
        frame_index: referenceIndex,
        frame_name: referenceFrame.name || `Frame ${referenceIndex + 1}`,
        pipeline_status: FRAME_PIPELINE_STATUS.CORRECTION_KEYFRAME,
        reference_used_frame_id: null,
        colorized_url: referenceFrame.colored_image_url,
        confidence_summary: { role: 'correction_reference_keyframe', confidence_score: 1, engine: 'user_reference' },
      },
      ...processingFrames.map((frame) => ({
        job_id: job.id,
        project_id: projectId,
        frame_id: frame.id,
        frame_index: frameIndex(frame),
        frame_name: frame.name || `Frame ${frameIndex(frame) + 1}`,
        pipeline_status: FRAME_PIPELINE_STATUS.PENDING,
        reference_used_frame_id: null,
        colorized_url: null,
        confidence_summary: { pending: true, overwrite_existing: Boolean(overwriteExisting) },
      })),
    ];

    const { error: frameError } = await supabase
      .from('colorization_job_frames')
      .upsert(jobFramesPayload, { onConflict: 'job_id,frame_id' });
    if (frameError) throw frameError;

    const [{ data: runningJob, error: runningError }] = await Promise.all([
      supabase.from('colorization_jobs').update({ status: JOB_STATUS.RUNNING }).eq('id', job.id).select('*').single(),
      supabase.from('projects').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('id', projectId).eq('user_id', user.id),
    ]);
    if (runningError) throw runningError;

    await recordUsageEvent(supabase, {
      userId: user.id,
      projectId,
      jobId: job.id,
      eventType: 'colorization_job_started',
      resourceType: RESOURCE_TYPES.PROCESSING_FRAMES,
      quantity: processingFrameIds.length,
      status: 'reserved',
      metadata: { reference_frame_id: referenceFrame.id, direction },
    });

    return sendJson(res, 200, {
      ok: true,
      job: runningJob,
      reference_frame: referenceFrame,
      total_frames: frames.length,
      target_frames: processingFrameIds.length,
      target_frame_ids: processingFrameIds,
      quota: {
        reserved: processingFrameIds.length,
        remainingAfterReservation: Math.max(0, Number(usage.period.processing_frame_limit) - Number(usage.period.processing_frames_used) - Number(usage.period.processing_frames_reserved) - processingFrameIds.length),
      },
      direction,
      overwrite_existing: Boolean(overwriteExisting),
      message: `Colorization job created. ${processingFrameIds.length} Processing Frame(s) reserved.`,
    });
  } catch (error) {
    if (reservationId) await releaseUsage(supabase, reservationId).catch(() => null);
    if (user && projectId) {
      await recordUsageEvent(supabase, {
        userId: user.id,
        projectId,
        eventType: 'colorization_job_start_failed',
        resourceType: RESOURCE_TYPES.PROCESSING_FRAMES,
        status: 'failed',
        metadata: { error: error?.message || String(error) },
      });
    }
    return sendError(res, Number(error?.statusCode) || 500, 'Failed to start colorization job', error?.details || error?.message || String(error));
  }
}
