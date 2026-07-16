import {
  JOB_STATUS,
  ensureMethod,
  getLatestJob,
  getSupabaseAdmin,
  readJsonBody,
  sendError,
  sendJson,
} from '../../colorization-shared.js';
import {
  ensureProjectOwnership,
  recordUsageEvent,
  releaseUsage,
  requireUser,
} from '../../account-shared.js';

const ACTIVE_STATUSES = [JOB_STATUS.CREATED, JOB_STATUS.RUNNING, JOB_STATUS.WAITING_REVIEW];

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['POST'])) return;
  try {
    const user = await requireUser(req);
    const body = await readJsonBody(req);
    const projectId = body.projectId || body.project_id;
    const jobId = body.jobId || body.job_id || null;
    if (!projectId) return sendError(res, 400, 'projectId is required');

    const supabase = getSupabaseAdmin();
    await ensureProjectOwnership(supabase, user.id, projectId);
    const job = await getLatestJob(supabase, projectId, jobId);
    if (!job) return sendError(res, 404, 'Colorization job not found');
    if (job.user_id && job.user_id !== user.id) return sendError(res, 403, 'Colorization job access denied');

    if (!ACTIVE_STATUSES.includes(job.status)) {
      return sendJson(res, 200, { ok: true, job, released: false, message: 'Colorization job is already closed.' });
    }

    const { data: cancelled, error } = await supabase.rpc('cancel_frameflow_colorization_job', {
      p_job_id: job.id,
      p_user_id: user.id,
    });
    if (error) {
      if (String(error.message || '').includes('FRAME_IN_PROGRESS')) {
        const conflict = new Error('The current frame is still processing. Wait for it to finish, then cancel the remaining sequence.');
        conflict.statusCode = 409;
        throw conflict;
      }
      throw error;
    }
    if (cancelled.status !== JOB_STATUS.CANCELLED) {
      return sendJson(res, 200, { ok: true, job: cancelled, released: false, message: 'Colorization job is already closed.' });
    }
    if (job.usage_reservation_id) await releaseUsage(supabase, job.usage_reservation_id);

    const now = new Date().toISOString();

    const { count: coloredFrameCount, error: coloredCountError } = await supabase
      .from('frames')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .not('colored_image_url', 'is', null);
    if (coloredCountError) throw coloredCountError;
    await supabase
      .from('projects')
      .update({ status: (coloredFrameCount || 0) > 0 ? 'ready' : 'draft', updated_at: now })
      .eq('id', projectId)
      .eq('user_id', user.id);

    await recordUsageEvent(supabase, {
      userId: user.id,
      projectId,
      jobId: job.id,
      eventType: 'colorization_job_cancelled',
      resourceType: 'processing_frames',
      quantity: 0,
      status: 'cancelled',
      metadata: { reservation_released: Boolean(job.usage_reservation_id) },
    });

    return sendJson(res, 200, {
      ok: true,
      job: cancelled,
      released: Boolean(job.usage_reservation_id),
      message: 'Colorization sequence cancelled. Unused Processing Frames were returned.',
    });
  } catch (error) {
    return sendError(res, Number(error?.statusCode) || 500, 'Failed to cancel colorization job', error?.details || error?.message || String(error));
  }
}
