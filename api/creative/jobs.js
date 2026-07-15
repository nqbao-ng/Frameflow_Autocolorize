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

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['GET', 'POST'])) return;

  try {
    const user = await requireUser(req);
    const supabase = getSupabaseAdmin();

    if (req.method === 'GET') {
      const limit = Math.min(30, Math.max(1, Number(req.query?.limit) || 12));
      const { data, error } = await supabase
        .from('creative_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      const jobs = await Promise.all((data || []).map((job) => serializeCreativeJob(supabase, job)));
      return sendJson(res, 200, { ok: true, jobs });
    }

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

      const job = await serializeCreativeJob(supabase, created);
      return sendJson(res, 202, { ok: true, job });
    } catch (error) {
      if (sourcePath) {
        await supabase.storage.from(CREATIVE_BUCKET).remove([sourcePath]).catch(() => null);
      }
      throw error;
    }
  } catch (error) {
    return handleCreativeApiError(res, error, 'Unable to create or list Creative Studio jobs');
  }
}
