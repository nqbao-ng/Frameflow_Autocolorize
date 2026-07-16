import {
  ensureMethod,
  getLatestJob,
  getSupabaseAdmin,
  readJsonBody,
  sendError,
  sendJson,
} from '../../server/colorization-shared.js';
import { ensureProjectOwnership, requireUser } from '../../server/account-shared.js';

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['POST'])) return;
  try {
    const user = await requireUser(req);
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
    await ensureProjectOwnership(supabase, user.id, projectId, frameId);
    const job = await getLatestJob(supabase, projectId, jobId);
    if (job?.user_id && job.user_id !== user.id) return sendError(res, 403, 'Colorization job access denied');

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
    return sendJson(res, 200, { ok: true, mask: data, message: 'Mask repair metadata saved.' });
  } catch (error) {
    return sendError(res, Number(error?.statusCode) || 500, 'Failed to save mask repair', error?.details || error?.message || String(error));
  }
}
