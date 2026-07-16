import { randomUUID } from 'node:crypto';
import {
  CREATIVE_BUCKET,
  RESOURCE_TYPES,
  ensureMethod,
  ensureProjectOwnership,
  enqueueCreativeJob,
  enforceCreativeLimits,
  getCreativeCreditCost,
  getSupabaseAdmin,
  handleCreativeApiError,
  normalizeCreativeRequest,
  readJsonBody,
  recordUsageEvent,
  releaseUsage,
  requireUser,
  reserveUsage,
  sendJson,
  serializeCreativeJob,
  uploadSourceImage,
} from '../../server/creative-shared.js';
import { enforceApiRateLimit } from '../../server/account-shared.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['GET', 'POST'])) return;

  let reservationId = null;
  let sourcePath = null;
  let jobId = null;
  let user = null;
  const supabase = getSupabaseAdmin();

  try {
    user = await requireUser(req);

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

    await enforceApiRateLimit(supabase, { key: `creative:create:${user.id}`, limit: 10, windowSeconds: 60 });
    const body = await readJsonBody(req);
    const normalized = normalizeCreativeRequest(body);
    const limits = await enforceCreativeLimits(supabase, user.id);
    const projectId = body.projectId ? String(body.projectId) : null;
    const frameId = body.frameId ? String(body.frameId) : null;
    if (projectId) await ensureProjectOwnership(supabase, user.id, projectId, frameId);

    jobId = randomUUID();
    const creditCost = getCreativeCreditCost(normalized.jobType);
    const usage = await reserveUsage(supabase, {
      userId: user.id,
      resourceType: RESOURCE_TYPES.CREATIVE_CREDITS,
      amount: creditCost,
      sourceType: 'creative_job',
      sourceId: jobId,
      idempotencyKey: `creative:${jobId}`,
      metadata: { job_type: normalized.jobType, project_id: projectId, frame_id: frameId },
    });
    reservationId = usage.reservation.id;

    const uploaded = await uploadSourceImage(supabase, {
      userId: user.id,
      jobId,
      imageDataUrl: body.imageDataUrl,
    });
    sourcePath = uploaded.path;

    const metadata = {
      source_name: String(body.sourceName || '').slice(0, 200) || null,
      source_content_type: uploaded.contentType,
      source_bytes: uploaded.bytes,
      visual_style_label: String(body.visualStyleLabel || '').slice(0, 120) || null,
      credit_policy: 'reserved_on_create_consumed_on_success_refunded_on_failure',
    };
    const analysis = body.analysis && typeof body.analysis === 'object' ? body.analysis : {};

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
        usage_reservation_id: reservationId,
        creative_credit_cost: creditCost,
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
          status: 'failed', progress: 0,
          error_message: `Queue dispatch failed: ${enqueueError?.message || String(enqueueError)}`,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)
        .eq('user_id', user.id);
      throw enqueueError;
    }

    await recordUsageEvent(supabase, {
      userId: user.id,
      projectId,
      jobId,
      eventType: 'creative_job_started',
      resourceType: RESOURCE_TYPES.CREATIVE_CREDITS,
      quantity: creditCost,
      inputBytes: uploaded.bytes,
      status: 'reserved',
      metadata: { job_type: normalized.jobType, plan_code: limits.entitlements.plan.code },
    });

    return sendJson(res, 202, {
      ok: true,
      job: await serializeCreativeJob(supabase, created),
      credits: {
        cost: creditCost,
        remainingAfterReservation: Math.max(0, limits.entitlements.usage.creativeCreditsRemaining - creditCost),
      },
    });
  } catch (error) {
    if (reservationId) await releaseUsage(supabase, reservationId).catch(() => null);
    if (sourcePath) await supabase.storage.from(CREATIVE_BUCKET).remove([sourcePath]).catch(() => null);
    if (user && jobId) {
      await recordUsageEvent(supabase, {
        userId: user.id,
        jobId,
        eventType: 'creative_job_start_failed',
        resourceType: RESOURCE_TYPES.CREATIVE_CREDITS,
        status: 'failed',
        metadata: { error: error?.message || String(error) },
      });
    }
    return handleCreativeApiError(res, error, 'Unable to create or list Creative Studio jobs');
  }
}
