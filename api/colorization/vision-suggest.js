import {
  callCvService,
  ensureMethod,
  getFrameById,
  getLatestJob,
  getRoleMemory,
  getSupabaseAdmin,
  readJsonBody,
  sendError,
  sendJson,
} from '../../server/colorization-shared.js';

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['POST'])) return;

  try {
    const body = await readJsonBody(req);
    const projectId = body.projectId || body.project_id;
    const frameId = body.frameId || body.frame_id;
    const jobId = body.jobId || body.job_id || null;
    const segmentId = Number(body.segmentId || body.segment_id);

    if (!projectId) return sendError(res, 400, 'projectId is required');
    if (!frameId) return sendError(res, 400, 'frameId is required');
    if (!segmentId) return sendError(res, 400, 'segmentId is required');

    const supabase = getSupabaseAdmin();
    const job = await getLatestJob(supabase, projectId, jobId);
    if (!job) return sendError(res, 404, 'No colorization job found for this project');

    const frame = await getFrameById(supabase, frameId);
    if (!frame) return sendError(res, 404, 'Frame not found');

    const { data: jobFrame, error: jobFrameError } = await supabase
      .from('colorization_job_frames')
      .select('*')
      .eq('job_id', job.id)
      .eq('frame_id', frameId)
      .maybeSingle();

    if (jobFrameError) throw jobFrameError;

    const roleMemory = await getRoleMemory(supabase, projectId);
    const summary = jobFrame?.confidence_summary || {};
    const segments = Array.isArray(summary.segments) ? summary.segments : [];

    const referenceFrame = await getFrameById(supabase, job.last_trusted_frame_id);

    const suggestion = await callCvService('/v1/vision-suggest', {
      project_id: projectId,
      job_id: job.id,
      frame_id: frameId,
      frame_name: frame.name || jobFrame?.frame_name || 'frame.png',
      segment_id: segmentId,
      line_url: frame.source_image_url || null,
      colorized_url: jobFrame?.colorized_url || frame.colored_image_url || null,
      segment_ids_url: jobFrame?.segment_ids_url || null,
      reference_url: referenceFrame?.colored_image_url || null,
      segments,
      role_memory: roleMemory,
    });

    const payload = {
      project_id: projectId,
      job_id: job.id,
      frame_id: frameId,
      clicked_segment_id: segmentId,
      suggested_role_id: suggestion.role_id || 'unknown',
      suggested_segment_ids: [segmentId],
      suggested_color: suggestion.color_hex || '#3B82F6',
      confidence: Number(suggestion.confidence ?? 0.55),
      status: 'pending_user_confirm',
      raw_response: {
        provider: suggestion.provider || 'frameflow_cv_service',
        model_id: suggestion.model_id || null,
        reason: suggestion.reason || null,
        raw_response: suggestion.raw_response || null,
      },
    };

    const { data, error } = await supabase
      .from('vision_suggestions')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;

    return sendJson(res, 200, {
      ok: true,
      suggestion: {
        id: data.id,
        role_id: data.suggested_role_id,
        segment_ids: data.suggested_segment_ids,
        color_hex: data.suggested_color,
        confidence: data.confidence,
        status: data.status,
        reason: suggestion.reason || null,
        provider: suggestion.provider || 'frameflow_cv_service',
      },
    });
  } catch (error) {
    return sendError(res, 500, 'Failed to get vision suggestion', String(error?.message || error));
  }
}
