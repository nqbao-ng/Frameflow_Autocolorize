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

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['POST'])) return;

  try {
    const body = await readJsonBody(req);
    const projectId = body.projectId || body.project_id;
    const referenceFrameId = body.referenceFrameId || body.reference_frame_id || null;

    if (!projectId) return sendError(res, 400, 'projectId is required');

    const supabase = getSupabaseAdmin();
    const frames = await getProjectFrames(supabase, projectId);

    if (!frames.length) {
      return sendError(res, 400, 'Project has no frames. Upload sketch frames first.');
    }

    const referenceFrame = referenceFrameId
      ? frames.find((frame) => frame.id === referenceFrameId)
      : frames.find((frame) => frame.colored_image_url);

    if (!referenceFrame) {
      return sendError(res, 400, 'No colored reference/keyframe found. Upload a colored keyframe first.');
    }

    if (!referenceFrame.source_image_url) {
      return sendError(res, 400, 'Reference frame is missing source_image_url.');
    }

    if (!referenceFrame.colored_image_url) {
      return sendError(res, 400, 'Reference frame must have colored_image_url. Save/import the colored keyframe first.');
    }

    const firstNextIndex = Math.min(frames.length, Number(referenceFrame.frame_index ?? 0) + 1);

    const { data: job, error: jobError } = await supabase
      .from('colorization_jobs')
      .insert({
        project_id: projectId,
        status: JOB_STATUS.CREATED,
        last_trusted_frame_id: referenceFrame.id,
        next_frame_index: firstNextIndex,
        settings: {
          mode: 'keyframe_guided_sequence',
          reference_frame_id: referenceFrame.id,
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
          created_from: 'FrameFlow RightPanel/Toolbar',
        },
      })
      .select('*')
      .single();

    if (jobError) throw jobError;

    const jobFramesPayload = frames.map((frame) => {
      const frameIndex = Number(frame.frame_index ?? 0);
      const isReference = frame.id === referenceFrame.id;
      return {
        job_id: job.id,
        project_id: projectId,
        frame_id: frame.id,
        frame_index: frameIndex,
        frame_name: frame.name || `Frame ${frameIndex + 1}`,
        pipeline_status: isReference
          ? FRAME_PIPELINE_STATUS.CORRECTION_KEYFRAME
          : FRAME_PIPELINE_STATUS.PENDING,
        reference_used_frame_id: isReference ? null : referenceFrame.id,
        colorized_url: frame.colored_image_url || null,
        confidence_summary: isReference
          ? { role: 'initial_colored_keyframe', confidence_score: 1, engine: 'user_reference' }
          : {},
      };
    });

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
      message: 'FrameFlow CV job created. Call /api/colorization/continue to process frames until review/completion.',
    });
  } catch (error) {
    return sendError(res, 500, 'Failed to start colorization job', String(error?.message || error));
  }
}
