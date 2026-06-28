import {
  buildMockSegments,
  ensureMethod,
  getLatestJob,
  getSupabaseAdmin,
  readJsonBody,
  sendError,
  sendJson,
} from './_shared.js';

const ROLE_BY_SEGMENT = {
  1: { role_id: 'skin', color: '#F2B08C', confidence: 0.72 },
  2: { role_id: 'hair', color: '#1E293B', confidence: 0.69 },
  3: { role_id: 'shirt', color: '#3B82F6', confidence: 0.66 },
  4: { role_id: 'background', color: '#E5E7EB', confidence: 0.74 },
};

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

    // Replace this mock with Gemini/OpenAI/Nova Vision once key is configured.
    const fallback = buildMockSegments().find((item) => Number(item.segment_id) === segmentId);
    const suggestion = ROLE_BY_SEGMENT[segmentId] || {
      role_id: fallback?.role_guess || 'unknown',
      color: fallback?.suggested_color || '#8B5CF6',
      confidence: fallback?.confidence || 0.55,
    };

    const payload = {
      project_id: projectId,
      job_id: job.id,
      frame_id: frameId,
      clicked_segment_id: segmentId,
      suggested_role_id: suggestion.role_id,
      suggested_segment_ids: [segmentId],
      suggested_color: suggestion.color,
      confidence: suggestion.confidence,
      status: 'pending_user_confirm',
      raw_response: {
        provider: 'mock_until_vision_api_configured',
        reason: 'Deterministic fallback suggestion for UI/core integration test.',
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
      },
    });
  } catch (error) {
    return sendError(res, 500, 'Failed to get vision suggestion', String(error?.message || error));
  }
}
