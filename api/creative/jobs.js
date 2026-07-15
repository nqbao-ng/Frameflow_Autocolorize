import { randomUUID } from 'node:crypto';
import {
  CREATIVE_BUCKET,
  ensureMethod,
  ensureProjectOwnership,
  enqueueCreativeJob,
  enforceCreativeLimits,
  getSupabaseAdmin,
  handleCreativeApiError,
  normalizeCreativeRequest,
  readJsonBody,
  requireUser,
  sendJson,
  serializeCreativeJob,
  uploadSourceImage,
} from './_shared.js';

export const config = { maxDuration: 30 };

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function readOwnedJob(supabase, userId, jobId) {
  const { data: job, error } = await supabase
    .from('creative_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!job) throw createHttpError('Creative job not found', 404);
  return job;
}

async function listJobs(req, res, supabase, user) {
  const limit = Math.min(30, Math.max(1, Number(req.query?.limit) || 12));
  const { data, error } = await supabase
    .from('creative_jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const jobs = await Promise.all(
    (data || []).map((job) => serializeCreativeJob(supabase, job)),
  );

  return sendJson(res, 200, { ok: true, jobs });
}

async function getJob(req, res, supabase, user, jobId) {
  const job = await readOwnedJob(supabase, user.id, jobId);
  return sendJson(res, 200, {
    ok: true,
    job: await serializeCreativeJob(supabase, job),
  });
}

async function cancelJob(req, res, supabase, user, jobId) {
  const job = await readOwnedJob(supabase, user.id, jobId);

  // Jobs that already ended do not need another database update.
  if (['completed', 'failed', 'cancelled'].includes(job.status)) {
    return sendJson(res, 200, {
      ok: true,
      job: await serializeCreativeJob(supabase, job),
    });
  }

  const { data: cancelled, error } = await supabase
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

  if (error) throw error;

  const paths = [job.source_path, job.result_path].filter(Boolean);
  if (paths.length) {
    await supabase.storage
      .from(job.source_bucket || CREATIVE_BUCKET)
      .remove(paths)
      .catch(() => null);
  }

  return sendJson(res, 200, {
    ok: true,
    job: await serializeCreativeJob(supabase, cancelled),
  });
}

async function createJob(req, res, supabase, user) {
  const body = await readJsonBody(req);
  const normalized = normalizeCreativeRequest(body);
  await enforceCreativeLimits(supabase, user.id);

  const projectId = body.projectId ? String(body.projectId) : null;
  const frameId = body.frameId ? String(body.frameId) : null;
  await ensureProjectOwnership(supabase, user.id, projectId, frameId);

  const jobId = randomUUID();
  let sourcePath = null;

  try {
    const uploaded = await uploadSourceImage(supabase, {
      userId: user.id,
      jobId,
      imageDataUrl: body.imageDataUrl,
    });
    sourcePath = uploaded.path;

    const metadata = {
      source_name: String(body.sourceName || '').slice(0, 200) || null,
      source_content_type: uploaded.contentType,
      visual_style_label: String(body.visualStyleLabel || '').slice(0, 120) || null,
    };

    const analysis = body.analysis && typeof body.analysis === 'object'
      ? body.analysis
      : {};

    const { data: created, error: insertError } = await supabase
      .from('creative_jobs')
      .insert({
        id: jobId,
        user_id: user.id,
        project_id: projectId,
        frame_id: frameId,
        job_type: normalized.jobType,
        status: 'queued',
        progress: 5,
        source_bucket: CREATIVE_BUCKET,
        source_path: sourcePath,
        prompt: normalized.prompt,
        negative_prompt: normalized.negativePrompt,
        settings: normalized.settings,
        analysis,
        metadata,
      })
      .select('*')
      .single();

    if (insertError) throw insertError;

    try {
      await enqueueCreativeJob(jobId);
    } catch (enqueueError) {
      await supabase
        .from('creative_jobs')
        .update({
          status: 'failed',
          progress: 0,
          error_message: `Queue dispatch failed: ${enqueueError?.message || String(enqueueError)}`,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)
        .eq('user_id', user.id);
      throw enqueueError;
    }

    return sendJson(res, 202, {
      ok: true,
      job: await serializeCreativeJob(supabase, created),
    });
  } catch (error) {
    if (sourcePath) {
      await supabase.storage.from(CREATIVE_BUCKET).remove([sourcePath]).catch(() => null);
    }
    throw error;
  }
}

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['GET', 'POST', 'DELETE'])) return;

  try {
    const user = await requireUser(req);
    const supabase = getSupabaseAdmin();
    const jobId = String(req.query?.id || '').trim();

    if (req.method === 'GET') {
      return jobId
        ? getJob(req, res, supabase, user, jobId)
        : listJobs(req, res, supabase, user);
    }

    if (req.method === 'DELETE') {
      if (!jobId) throw createHttpError('Job id is required', 400);
      return cancelJob(req, res, supabase, user, jobId);
    }

    return createJob(req, res, supabase, user);
  } catch (error) {
    return handleCreativeApiError(
      res,
      error,
      'Unable to create, list, read, or cancel Creative Studio jobs',
    );
  }
}
