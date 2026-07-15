import { createClient } from '@supabase/supabase-js';
import {
  callFrameFlowBackend,
  clampInteger,
  clampNumber,
  ensureMethod,
  parseImageDataUrl,
  readJsonBody,
  requireUser,
  sendError,
  sendJson,
  validatePrompt,
} from './stability-shared.js';

export const CREATIVE_BUCKET = 'creative-assets';
export const CREATIVE_JOB_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

const STYLE_PRESETS = new Set([
  '3d-model',
  'analog-film',
  'anime',
  'cinematic',
  'comic-book',
  'digital-art',
  'enhance',
  'fantasy-art',
  'isometric',
  'line-art',
  'low-poly',
  'modeling-compound',
  'neon-punk',
  'origami',
  'photographic',
  'pixel-art',
  'tile-texture',
]);

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const error = new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    error.statusCode = 503;
    throw error;
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}


export async function enforceCreativeLimits(supabase, userId) {
  const nowIso = new Date().toISOString();
  const { data: subscription, error: subscriptionError } = await supabase
    .from('subscriptions')
    .select('plan_code, status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle();
  if (subscriptionError) throw subscriptionError;

  const planCode = subscription?.status === 'active' && subscription.current_period_end > nowIso
    ? subscription.plan_code
    : 'free';

  const { data: plan, error: planError } = await supabase
    .from('billing_plans')
    .select('creative_daily_limit, creative_concurrent_limit')
    .eq('code', planCode)
    .eq('active', true)
    .maybeSingle();
  if (planError) throw planError;

  const maxActive = Math.max(
    1,
    Number(plan?.creative_concurrent_limit)
      || Number(process.env.FRAMEFLOW_CREATIVE_MAX_ACTIVE_PER_USER)
      || 1,
  );
  const dailyLimit = Math.max(
    1,
    Number(plan?.creative_daily_limit)
      || Number(process.env.FRAMEFLOW_CREATIVE_DAILY_LIMIT)
      || 10,
  );

  const { count: activeCount, error: activeError } = await supabase
    .from('creative_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['queued', 'processing']);
  if (activeError) throw activeError;
  if ((activeCount || 0) >= maxActive) {
    const error = new Error(`Your ${planCode} plan allows ${maxActive} active Creative Studio job(s). Wait for one to finish or upgrade your plan.`);
    error.statusCode = 429;
    throw error;
  }

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count: dailyCount, error: dailyError } = await supabase
    .from('creative_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', dayStart.toISOString());
  if (dailyError) throw dailyError;
  if ((dailyCount || 0) >= dailyLimit) {
    const error = new Error(`Your ${planCode} plan has reached its daily Creative Studio limit (${dailyLimit} jobs).`);
    error.statusCode = 429;
    throw error;
  }

  return { planCode, maxActive, dailyLimit, activeCount: activeCount || 0, dailyCount: dailyCount || 0 };
}

export function imageExtension(contentType) {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/webp') return 'webp';
  return 'png';
}

export function sanitizeUuid(value) {
  const clean = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean)
    ? clean
    : null;
}

export async function ensureProjectOwnership(supabase, userId, projectId, frameId = null) {
  if (!projectId) return;

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle();

  if (projectError) throw projectError;
  if (!project) {
    const error = new Error('Project not found or access denied');
    error.statusCode = 403;
    throw error;
  }

  if (frameId) {
    const { data: frame, error: frameError } = await supabase
      .from('frames')
      .select('id')
      .eq('id', frameId)
      .eq('project_id', projectId)
      .maybeSingle();

    if (frameError) throw frameError;
    if (!frame) {
      const error = new Error('Frame does not belong to the selected project');
      error.statusCode = 400;
      throw error;
    }
  }
}

export function normalizeCreativeRequest(body) {
  const jobType = body.jobType === 'outpaint' ? 'outpaint' : 'sketch';
  const prompt = validatePrompt(body.prompt, { required: jobType === 'sketch' });
  const negativePrompt = validatePrompt(body.negativePrompt, { required: false });
  const stylePreset = String(body.stylePreset || '').trim();

  if (stylePreset && !STYLE_PRESETS.has(stylePreset)) {
    const error = new Error('Unsupported visual style preset');
    error.statusCode = 400;
    throw error;
  }

  if (jobType === 'sketch') {
    return {
      jobType,
      prompt,
      negativePrompt: negativePrompt || null,
      settings: {
        control_strength: clampNumber(body.controlStrength, 0, 1, 0.9),
        style_preset: stylePreset || null,
        style_id: String(body.styleId || '').trim() || null,
        seed: body.seed !== undefined && body.seed !== null && body.seed !== ''
          ? Math.max(0, Math.round(Number(body.seed)))
          : null,
      },
    };
  }

  const left = clampInteger(body.left, 0, 2000, 0);
  const right = clampInteger(body.right, 0, 2000, 0);
  const up = clampInteger(body.up, 0, 2000, 0);
  const down = clampInteger(body.down, 0, 2000, 0);
  if (left + right + up + down === 0) {
    const error = new Error('Choose at least one direction to expand');
    error.statusCode = 400;
    throw error;
  }

  return {
    jobType,
    prompt: prompt || null,
    negativePrompt: null,
    settings: {
      left,
      right,
      up,
      down,
      creativity: clampNumber(body.creativity, 0.1, 1, 0.45),
      style_preset: stylePreset || null,
      seed: body.seed !== undefined && body.seed !== null && body.seed !== ''
        ? Math.max(0, Math.round(Number(body.seed)))
        : null,
    },
  };
}

export async function uploadSourceImage(supabase, { userId, jobId, imageDataUrl }) {
  const { imageBase64, contentType } = parseImageDataUrl(imageDataUrl);
  const extension = imageExtension(contentType);
  const path = `${userId}/${jobId}/source.${extension}`;
  const buffer = Buffer.from(imageBase64, 'base64');

  const { error } = await supabase.storage
    .from(CREATIVE_BUCKET)
    .upload(path, buffer, {
      contentType,
      upsert: false,
      cacheControl: '3600',
    });

  if (error) throw error;
  return { path, contentType };
}

export async function createSignedAssetUrl(supabase, bucket, path, expiresIn = 3600) {
  if (!bucket || !path) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl || null;
}

export async function serializeCreativeJob(supabase, job) {
  if (!job) return null;
  let resultUrl = null;
  if (job.status === CREATIVE_JOB_STATUS.COMPLETED && job.result_bucket && job.result_path) {
    resultUrl = await createSignedAssetUrl(supabase, job.result_bucket, job.result_path, 3600);
  }

  return {
    id: job.id,
    jobType: job.job_type,
    status: job.status,
    progress: job.progress,
    projectId: job.project_id,
    frameId: job.frame_id,
    resultUrl,
    provider: job.provider,
    modelId: job.model_id,
    seed: job.seed,
    error: job.error_message,
    attemptCount: job.attempt_count,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    metadata: job.metadata || {},
  };
}

export async function enqueueCreativeJob(jobId) {
  return callFrameFlowBackend('/v1/creative/jobs/enqueue', {
    payload: { job_id: jobId },
  });
}

export async function handleCreativeApiError(res, error, fallbackMessage) {
  const status = Number(error?.statusCode) || 500;
  return sendError(res, status, fallbackMessage, error?.details || error?.message || String(error));
}

export { ensureMethod, readJsonBody, requireUser, sendJson };
