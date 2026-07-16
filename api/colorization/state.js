import {
  ensureMethod,
  getJobFrames,
  getLatestJob,
  getSupabaseAdmin,
  sendError,
  sendJson,
} from '../../server/colorization-shared.js';
import { ensureProjectOwnership, requireUser } from '../../server/account-shared.js';

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['GET'])) return;
  try {
    const user = await requireUser(req);
    const projectId = req.query.projectId || req.query.project_id;
    const jobId = req.query.jobId || req.query.job_id || null;
    if (!projectId) return sendError(res, 400, 'projectId is required');

    const supabase = getSupabaseAdmin();
    await ensureProjectOwnership(supabase, user.id, projectId);
    const job = await getLatestJob(supabase, projectId, jobId);
    if (!job) return sendJson(res, 200, { ok: true, job: null, frames: [] });
    if (job.user_id && job.user_id !== user.id) return sendError(res, 403, 'Colorization job access denied');

    const jobFrames = await getJobFrames(supabase, job.id);
    return sendJson(res, 200, { ok: true, job, frames: jobFrames });
  } catch (error) {
    return sendError(res, Number(error?.statusCode) || 500, 'Failed to load colorization state', error?.details || error?.message || String(error));
  }
}
