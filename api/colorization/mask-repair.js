import {
  ensureMethod,
  getLatestJob,
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
    const frameId = body.frameId || body.frame_id;
    const jobId = body.jobId || body.job_id || null;
    const maskUrl = body.maskUrl || body.mask_url;
    const roleId = body.roleId || body.role_id || null;
    const colorHex = body.colorHex || body.color_hex || null;
    const sourceSegmentIds = body.sourceSegmentIds || body.source_segment_ids || [];
    const maskSource = body.maskSource || body.mask_source || 'manual_canvas_repair';

    if (!projectId) return sendError(res, 400, 'projectId is required');
    if (!frameId) return sendError(res, 400, 'frameId is required');
    if (!maskUrl) return sendError(res, 400, 'maskUrl is required');

    const supabase = getSupabaseAdmin();
    const job = await getLatestJob(supabase, projectId, jobId);

    const { data, error } = await supabase
      .from('correction_masks')
      .insert({
        project_id: projectId,
        job_id: job?.id || null,
        frame_id: frameId,
        role_id: roleId,
        color_hex: colorHex,
        mask_url: maskUrl,
        mask_source: maskSource,
        source_segment_ids: sourceSegmentIds,
      })
      .select('*')
      .single();

    if (error) throw error;

    return sendJson(res, 200, {
      ok: true,
      mask: data,
      message: 'Mask repair metadata saved.',
    });
  } catch (error) {
    return sendError(res, 500, 'Failed to save mask repair', String(error?.message || error));
  }
}
