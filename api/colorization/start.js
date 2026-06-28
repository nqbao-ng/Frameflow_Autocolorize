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

    let referenceFrame = referenceFrameId
      ? frames.find((frame) => frame.id === referenceFrameId)
      : frames.find((frame) => frame.colored_image_url) || frames[0];

    if (!referenceFrame) {
      return sendError(res, 400, 'Reference frame was not found in this project.');
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
          backend: 'vercel_serverless_core',
          ai_runtime: 'disabled_until_configured',
          created_from: 'FrameFlow RightPanel',
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
          ? { role: 'initial_colored_keyframe', confidence: 1 }
          : {},
      };
    });

    const { error: frameError } = await supabase
      .from('colorization_job_frames')
      .upsert(jobFramesPayload, { onConflict: 'job_id,frame_id' });

    if (frameError) throw frameError;

    await supabase
      .from('colorization_jobs')
      .update({ status: JOB_STATUS.RUNNING })
      .eq('id', job.id);

    return sendJson(res, 200, {
      ok: true,
      job: { ...job, status: JOB_STATUS.RUNNING },
      reference_frame: referenceFrame,
      total_frames: frames.length,
      message: 'Colorization core job created. Call /api/colorization/continue to process the next frame.',
    });
  } catch (error) {
    return sendError(res, 500, 'Failed to start colorization job', String(error?.message || error));
  }
}
