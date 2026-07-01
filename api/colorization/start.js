import {
  FRAME_PIPELINE_STATUS,
  JOB_STATUS,
  ensureMethod,
  getProjectFrames,
  getSupabaseAdmin,
  readJsonBody,
  sendError,
  sendJson,
} from './_shared.js';

function frameIndex(frame) {
  return Number(frame?.frame_index ?? 0);
}

function uniqueStrings(values) {
  return Array.from(new Set((values || []).map(String).filter(Boolean)));
}

function buildForwardChainTargets(frames, referenceFrame, targetFrameIds) {
  const referenceIndex = frameIndex(referenceFrame);
  const targetIdSet = new Set(targetFrameIds);

  // Nếu client truyền frame rời rạc, server vẫn mở rộng thành chain liên tục.
  // Ví dụ reference=3, target=7 => chạy 4,5,6,7.
  if (targetIdSet.size > 0) {
    const selectedAfterReference = frames.filter(
      (frame) => targetIdSet.has(String(frame.id)) && frameIndex(frame) > referenceIndex,
    );

    if (!selectedAfterReference.length) return [];

    const maxTargetIndex = Math.max(...selectedAfterReference.map(frameIndex));

    return frames
      .filter((frame) => frame.id !== referenceFrame.id)
      .filter((frame) => frameIndex(frame) > referenceIndex && frameIndex(frame) <= maxTargetIndex)
      .sort((a, b) => frameIndex(a) - frameIndex(b));
  }

  // Nếu không truyền target cụ thể, mặc định chạy toàn bộ frame sau reference.
  return frames
    .filter((frame) => frame.id !== referenceFrame.id)
    .filter((frame) => frameIndex(frame) > referenceIndex)
    .sort((a, b) => frameIndex(a) - frameIndex(b));
}

function buildBackwardChainTargets(frames, referenceFrame, targetFrameIds) {
  const referenceIndex = frameIndex(referenceFrame);
  const targetIdSet = new Set(targetFrameIds);

  if (targetIdSet.size > 0) {
    const selectedBeforeReference = frames.filter(
      (frame) => targetIdSet.has(String(frame.id)) && frameIndex(frame) < referenceIndex,
    );

    if (!selectedBeforeReference.length) return [];

    const minTargetIndex = Math.min(...selectedBeforeReference.map(frameIndex));

    return frames
      .filter((frame) => frame.id !== referenceFrame.id)
      .filter((frame) => frameIndex(frame) < referenceIndex && frameIndex(frame) >= minTargetIndex)
      .sort((a, b) => frameIndex(b) - frameIndex(a));
  }

  return frames
    .filter((frame) => frame.id !== referenceFrame.id)
    .filter((frame) => frameIndex(frame) < referenceIndex)
    .sort((a, b) => frameIndex(b) - frameIndex(a));
}

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['POST'])) return;

  try {
    const body = await readJsonBody(req);
    const projectId = body.projectId || body.project_id;
    const referenceFrameId = body.referenceFrameId || body.reference_frame_id || null;
    const targetFrameIds = uniqueStrings(body.targetFrameIds || body.target_frame_ids || []);
    const direction = ['forward', 'backward', 'both'].includes(body.direction)
      ? body.direction
      : 'forward';
    const overwriteExisting = body.overwriteExisting ?? body.overwrite_existing ?? true;

    if (!projectId) return sendError(res, 400, 'projectId is required');

    const supabase = getSupabaseAdmin();
    const frames = await getProjectFrames(supabase, projectId);

    if (!frames.length) {
      return sendError(res, 400, 'Project has no frames. Upload sketch frames first.');
    }

    const referenceFrame = referenceFrameId
      ? frames.find((frame) => String(frame.id) === String(referenceFrameId))
      : frames.find((frame) => frame.colored_image_url);

    if (!referenceFrame) {
      return sendError(res, 400, 'No colored reference/keyframe found. Upload or save a colored keyframe first.');
    }

    if (!referenceFrame.source_image_url) {
      return sendError(res, 400, 'Reference frame is missing source_image_url.');
    }

    if (!referenceFrame.colored_image_url) {
      return sendError(res, 400, 'Reference frame must have colored_image_url. Save/import the colored keyframe first.');
    }

    const referenceIndex = frameIndex(referenceFrame);

    const forwardTargets = buildForwardChainTargets(frames, referenceFrame, targetFrameIds);
    const backwardTargets = buildBackwardChainTargets(frames, referenceFrame, targetFrameIds);

    const processingFrames = direction === 'forward'
      ? forwardTargets
      : direction === 'backward'
        ? backwardTargets
        : [...forwardTargets, ...backwardTargets];

    const processingFrameIds = processingFrames.map((frame) => String(frame.id));

    if (!processingFrameIds.length) {
      return sendError(res, 400, 'No target frames after reference. Choose a reference earlier in the sequence or tick later frames.');
    }

    const { data: job, error: jobError } = await supabase
      .from('colorization_jobs')
      .insert({
        project_id: projectId,
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
          reference_strategy: 'nearest_colored_neighbor',
          backend: 'frameflow_cv_service',
          ai_runtime: 'bedrock_vision_optional_for_suggestions_only',
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
          created_from: 'FrameFlow correction reference workflow',
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
        confidence_summary: {
          role: 'correction_reference_keyframe',
          confidence_score: 1,
          engine: 'user_reference',
        },
      },
      ...processingFrames.map((frame) => {
        const idx = frameIndex(frame);
        return {
          job_id: job.id,
          project_id: projectId,
          frame_id: frame.id,
          frame_index: idx,
          frame_name: frame.name || `Frame ${idx + 1}`,
          pipeline_status: FRAME_PIPELINE_STATUS.PENDING,
          reference_used_frame_id: null,
          colorized_url: null,
          confidence_summary: {
            pending: true,
            overwrite_existing: Boolean(overwriteExisting),
          },
        };
      }),
    ];

    const { error: frameError } = await supabase
      .from('colorization_job_frames')
      .upsert(jobFramesPayload, { onConflict: 'job_id,frame_id' });

    if (frameError) throw frameError;

    const { data: runningJob, error: runningError } = await supabase
      .from('colorization_jobs')
      .update({ status: JOB_STATUS.RUNNING })
      .eq('id', job.id)
      .select('*')
      .single();

    if (runningError) throw runningError;

    return sendJson(res, 200, {
      ok: true,
      job: runningJob,
      reference_frame: referenceFrame,
      total_frames: frames.length,
      target_frames: processingFrameIds.length,
      target_frame_ids: processingFrameIds,
      direction,
      overwrite_existing: Boolean(overwriteExisting),
      message: 'FrameFlow CV job created for frames after the selected correction reference.',
    });
  } catch (error) {
    return sendError(res, 500, 'Failed to start colorization job', String(error?.message || error));
  }
}
