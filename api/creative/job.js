import {
  ensureMethod,
  getSupabaseAdmin,
  handleCreativeApiError,
  requireUser,
  sendJson,
  serializeCreativeJob,
} from './_shared.js';

export const config = { maxDuration: 20 };

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['GET', 'DELETE'])) return;

  try {
    const user = await requireUser(req);
    const supabase = getSupabaseAdmin();
    const jobId = String(req.query?.id || '').trim();
    if (!jobId) {
      const error = new Error('Job id is required');
      error.statusCode = 400;
      throw error;
    }

    const { data: job, error: readError } = await supabase
      .from('creative_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (readError) throw readError;
    if (!job) {
      const error = new Error('Creative job not found');
      error.statusCode = 404;
      throw error;
    }

    if (req.method === 'DELETE') {
      if (!['completed', 'failed', 'cancelled'].includes(job.status)) {
        const { data: cancelled, error: cancelError } = await supabase
          .from('creative_jobs')
          .update({
            status: 'cancelled',
            progress: 0,
            error_message: 'Cancelled by user',
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobId)
          .eq('user_id', user.id)
          .select('*')
          .single();
        if (cancelError) throw cancelError;
        const paths = [job.source_path, job.result_path].filter(Boolean);
        if (paths.length) {
          await supabase.storage.from(job.source_bucket || 'creative-assets').remove(paths).catch(() => null);
        }
        return sendJson(res, 200, { ok: true, job: await serializeCreativeJob(supabase, cancelled) });
      }
    }

    return sendJson(res, 200, { ok: true, job: await serializeCreativeJob(supabase, job) });
  } catch (error) {
    return handleCreativeApiError(res, error, 'Unable to read or cancel Creative Studio job');
  }
}
