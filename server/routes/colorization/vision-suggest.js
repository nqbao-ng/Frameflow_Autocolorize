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
} from '../../colorization-shared.js';
import { enforceApiRateLimit, ensureProjectOwnership, recordUsageEvent, requireUser } from '../../account-shared.js';

const MAX_MANUAL_SUGGESTIONS_PER_FRAME = Math.max(1, Number(process.env.FRAMEFLOW_MAX_VISION_SUGGESTIONS_PER_FRAME) || 3);

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['POST'])) return;
  const startedAt = Date.now();
  try {
    const user = await requireUser(req);
    const supabase = getSupabaseAdmin();
    await enforceApiRateLimit(supabase, { key: `vision:suggest:${user.id}`, limit: 15, windowSeconds: 60 });
    const body = await readJsonBody(req);
    const projectId = body.projectId || body.project_id;
    const frameId = body.frameId || body.frame_id;
    const jobId = body.jobId || body.job_id || null;
    const segmentId = Number(body.segmentId || body.segment_id);
    if (!projectId) return sendError(res, 400, 'projectId is required');
    if (!frameId) return sendError(res, 400, 'frameId is required');
    if (!Number.isInteger(segmentId) || segmentId <= 0) return sendError(res, 400, 'A valid segmentId is required');

    await ensureProjectOwnership(supabase, user.id, projectId, frameId);
    const job = await getLatestJob(supabase, projectId, jobId);
    if (!job) return sendError(res, 404, 'No colorization job found for this project');
    if (job.user_id && job.user_id !== user.id) return sendError(res, 403, 'Colorization job access denied');

    const { count, error: countError } = await supabase
      .from('vision_suggestions')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', job.id)
      .eq('frame_id', frameId);
    if (countError) throw countError;
    if ((count || 0) >= MAX_MANUAL_SUGGESTIONS_PER_FRAME) {
      return sendError(res, 429, `Vision Assist fair-use limit reached for this frame (${MAX_MANUAL_SUGGESTIONS_PER_FRAME} suggestions). Continue with role presets or the color picker.`);
    }

    const frame = await getFrameById(supabase, frameId);
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
    if (!segments.some((segment) => Number(segment.segment_id) === segmentId)) {
      return sendError(res, 409, 'The selected segment is not available in this frame analysis. Retry colorization or use manual correction.');
    }

    const referenceFrame = await getFrameById(supabase, job.last_trusted_frame_id);
    const suggestion = await callCvService('/v1/vision-suggest', {
      project_id: projectId,
      job_id: job.id,
      frame_id: frameId,
      frame_name: frame?.name || jobFrame?.frame_name || 'frame.png',
      segment_id: segmentId,
      line_url: frame?.source_image_url || null,
      colorized_url: jobFrame?.colorized_url || frame?.colored_image_url || null,
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
    const { data, error } = await supabase.from('vision_suggestions').insert(payload).select('*').single();
    if (error) throw error;

    await recordUsageEvent(supabase, {
      userId: user.id,
      projectId,
      jobId: job.id,
      eventType: 'vision_assist_suggestion',
      quantity: 1,
      processingSeconds: (Date.now() - startedAt) / 1000,
      visionCallCount: 1,
      modelId: suggestion.model_id || null,
      provider: suggestion.provider || 'frameflow_cv_service',
      metadata: { frame_id: frameId, segment_id: segmentId, included_in_processing_frame: true },
    });

    return sendJson(res, 200, {
      ok: true,
      billing: { includedInProcessingFrame: true, creativeCreditsCharged: 0 },
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
    return sendError(res, Number(error?.statusCode) || 500, 'Failed to get vision suggestion', error?.details || error?.message || String(error));
  }
}
