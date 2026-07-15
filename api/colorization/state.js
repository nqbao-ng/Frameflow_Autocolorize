import {
  ensureMethod,
  getJobFrames,
  getLatestJob,
  getSupabaseAdmin,
  sendError,
  sendJson,
} from '../../server/colorization-shared.js';

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['GET'])) return;

  try {
    const projectId = req.query.projectId || req.query.project_id;
    const jobId = req.query.jobId || req.query.job_id || null;

    if (!projectId) return sendError(res, 400, 'projectId is required');

    const supabase = getSupabaseAdmin();
    const job = await getLatestJob(supabase, projectId, jobId);

    if (!job) {
      return sendJson(res, 200, {
        ok: true,
        job: null,
        frames: [],
      });
    }

    const jobFrames = await getJobFrames(supabase, job.id);

    return sendJson(res, 200, {
      ok: true,
      job,
      frames: jobFrames,
    });
  } catch (error) {
    return sendError(res, 500, 'Failed to load colorization state', String(error?.message || error));
  }
}
