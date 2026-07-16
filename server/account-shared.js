import { createClient } from '@supabase/supabase-js';
import { requireUser } from './stability-shared.js';

export const RESOURCE_TYPES = {
  PROCESSING_FRAMES: 'processing_frames',
  CREATIVE_CREDITS: 'creative_credits',
};

export const CREATIVE_COSTS = {
  sketch: Math.max(1, Number(process.env.FRAMEFLOW_SKETCH_CREDIT_COST) || 15),
  outpaint: Math.max(1, Number(process.env.FRAMEFLOW_OUTPAINT_CREDIT_COST) || 20),
  analyze: 0,
};

function envNumber(name) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function estimateUsageCostUsd({
  processingSeconds = 0,
  visionCallCount = 0,
  inputBytes = 0,
  outputBytes = 0,
  computeCostPerSecondUsd = 0,
  modelCostUsd = 0,
} = {}) {
  const dataGb = (Math.max(0, Number(inputBytes) || 0) + Math.max(0, Number(outputBytes) || 0)) / (1024 ** 3);
  const total =
    Math.max(0, Number(processingSeconds) || 0) * Math.max(0, Number(computeCostPerSecondUsd) || 0)
    + Math.max(0, Number(visionCallCount) || 0) * envNumber('FRAMEFLOW_VISION_COST_PER_CALL_USD')
    + dataGb * envNumber('FRAMEFLOW_DATA_TRANSFER_COST_PER_GB_USD')
    + Math.max(0, Number(modelCostUsd) || 0);
  return total > 0 ? Number(total.toFixed(8)) : null;
}

export const COST_RATES = {
  cvComputePerSecondUsd: envNumber('FRAMEFLOW_CV_COMPUTE_COST_PER_SECOND_USD'),
  creativeComputePerSecondUsd: envNumber('FRAMEFLOW_CREATIVE_COMPUTE_COST_PER_SECOND_USD'),
};

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

export async function requireAdmin(req, supabase = getSupabaseAdmin()) {
  const user = await requireUser(req);
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (profile?.role !== 'admin') {
    const authError = new Error('Admin access required');
    authError.statusCode = 403;
    throw authError;
  }
  return user;
}

export async function enforceApiRateLimit(supabase, { key, limit, windowSeconds = 60 }) {
  const { data, error } = await supabase.rpc('consume_frameflow_rate_limit', {
    p_rate_key: String(key),
    p_window_seconds: Math.max(1, Math.round(Number(windowSeconds) || 60)),
    p_max_requests: Math.max(1, Math.round(Number(limit) || 1)),
  });
  if (error) {
    if (String(error.message || '').includes('RATE_LIMIT_EXCEEDED')) {
      const rateError = new Error('Too many requests. Please wait briefly and try again.');
      rateError.statusCode = 429;
      throw rateError;
    }
    throw error;
  }
  return Number(data || 0);
}

export async function ensureProjectOwnership(supabase, userId, projectId, frameId = null) {
  if (!projectId) {
    const error = new Error('projectId is required');
    error.statusCode = 400;
    throw error;
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
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
      .select('*')
      .eq('id', frameId)
      .eq('project_id', projectId)
      .maybeSingle();
    if (frameError) throw frameError;
    if (!frame) {
      const error = new Error('Frame does not belong to the selected project');
      error.statusCode = 400;
      throw error;
    }
    return { project, frame };
  }

  return { project, frame: null };
}

function monthWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return {
    key: `free:${start.toISOString().slice(0, 7)}`,
    start,
    end,
  };
}

function asDate(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

async function getPlan(supabase, code) {
  const { data, error } = await supabase
    .from('billing_plans')
    .select('*')
    .eq('code', code)
    .eq('active', true)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const planError = new Error(`Billing plan is not configured: ${code}`);
    planError.statusCode = 503;
    throw planError;
  }
  return data;
}

export async function resolveEffectivePlan(supabase, userId) {
  const now = new Date();
  const [{ data: profileData, error: profileError }, { data: subscription, error: subscriptionError }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, created_at, trial_started_at, trial_ends_at, trial_consumed, subscription_plan')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);
  if (profileError) throw profileError;
  if (subscriptionError) throw subscriptionError;
  let profile = profileData;
  if (!profile) {
    const { data: authResult, error: authError } = await supabase.auth.admin.getUserById(userId);
    if (authError) throw authError;
    const authUser = authResult?.user;
    if (!authUser) {
      const error = new Error('User profile is missing');
      error.statusCode = 409;
      throw error;
    }
    const nowIso = new Date().toISOString();
    const trialEndIso = new Date(Date.now() + 3 * 86400000).toISOString();
    const { data: createdProfile, error: createProfileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: authUser.email || '',
        full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || '',
        role: 'user',
        credits: 0,
        subscription_plan: 'free',
        trial_started_at: nowIso,
        trial_ends_at: trialEndIso,
        trial_consumed: false,
        created_at: authUser.created_at || nowIso,
        updated_at: nowIso,
      }, { onConflict: 'id' })
      .select('*')
      .single();
    if (createProfileError) throw createProfileError;
    profile = createdProfile;
  }

  const subscriptionEnd = asDate(subscription?.current_period_end);
  if (subscription?.status === 'active' && subscriptionEnd && subscriptionEnd > now) {
    const plan = await getPlan(supabase, subscription.plan_code || 'pro');
    const configuredStart = asDate(subscription.current_period_start, now);
    const membershipStart = configuredStart > now ? now : configuredStart;
    const cycleDays = Math.max(1, Number(plan.duration_days) || 30);
    const cycleMs = cycleDays * 86400000;
    const elapsedMs = Math.max(0, now.getTime() - membershipStart.getTime());
    const cycleIndex = Math.floor(elapsedMs / cycleMs);
    const periodStart = new Date(membershipStart.getTime() + cycleIndex * cycleMs);
    const scheduledPeriodEnd = new Date(periodStart.getTime() + cycleMs);
    const periodEnd = scheduledPeriodEnd < subscriptionEnd ? scheduledPeriodEnd : subscriptionEnd;
    return {
      code: plan.code,
      status: 'active',
      plan,
      periodStart,
      periodEnd,
      periodKey: `subscription:${subscription.id || userId}:${periodStart.toISOString()}`,
      subscription,
      profile,
      trialDaysRemaining: 0,
    };
  }

  if (subscription?.status === 'active' && subscriptionEnd && subscriptionEnd <= now) {
    await Promise.all([
      supabase.from('subscriptions').update({ status: 'expired', updated_at: now.toISOString() }).eq('user_id', userId).eq('status', 'active'),
      supabase.from('profiles').update({ subscription_plan: 'free', updated_at: now.toISOString() }).eq('id', userId),
    ]);
  }

  const trialStart = asDate(profile.trial_started_at, asDate(profile.created_at, now));
  const configuredTrialEnd = asDate(profile.trial_ends_at);
  const trialEnd = configuredTrialEnd || new Date(trialStart.getTime() + 3 * 24 * 60 * 60 * 1000);
  if (!profile.trial_consumed && trialEnd > now) {
    const plan = await getPlan(supabase, 'trial');
    return {
      code: 'trial',
      status: 'trialing',
      plan,
      periodStart: trialStart,
      periodEnd: trialEnd,
      periodKey: `trial:${trialStart.toISOString()}`,
      subscription: null,
      profile,
      trialDaysRemaining: Math.max(1, Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000)),
    };
  }

  if (!profile.trial_consumed && trialEnd <= now) {
    await supabase
      .from('profiles')
      .update({ trial_consumed: true, subscription_plan: 'free', updated_at: now.toISOString() })
      .eq('id', userId);
  }

  const plan = await getPlan(supabase, 'free');
  const window = monthWindow(now);
  return {
    code: 'free',
    status: 'active',
    plan,
    periodStart: window.start,
    periodEnd: window.end,
    periodKey: window.key,
    subscription: null,
    profile,
    trialDaysRemaining: 0,
  };
}

export async function ensureUsagePeriod(supabase, userId, resolved = null) {
  const effective = resolved || await resolveEffectivePlan(supabase, userId);
  const payload = {
    user_id: userId,
    period_key: effective.periodKey,
    plan_code: effective.code,
    period_start: effective.periodStart.toISOString(),
    period_end: effective.periodEnd.toISOString(),
    processing_frame_limit: Math.max(0, Number(effective.plan.processing_frame_limit) || 0),
    creative_credit_limit: Math.max(0, Number(effective.plan.creative_credit_limit ?? effective.plan.credits_grant) || 0),
    metadata: {
      source: effective.code === 'trial' ? 'automatic_trial' : effective.code === 'free' ? 'monthly_free_allowance' : 'paid_subscription',
      plan_snapshot: {
        project_limit: effective.plan.project_limit,
        creative_concurrent_limit: effective.plan.creative_concurrent_limit,
      },
    },
  };

  const { data, error } = await supabase
    .from('account_usage_periods')
    .upsert(payload, { onConflict: 'user_id,period_key', ignoreDuplicates: true })
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (data) return { effective, period: data };

  const { data: existing, error: readError } = await supabase
    .from('account_usage_periods')
    .select('*')
    .eq('user_id', userId)
    .eq('period_key', effective.periodKey)
    .single();
  if (readError) throw readError;
  return { effective, period: existing };
}

export function usageRemaining(period, resourceType) {
  if (resourceType === RESOURCE_TYPES.PROCESSING_FRAMES) {
    return Math.max(0, Number(period.processing_frame_limit || 0) - Number(period.processing_frames_used || 0) - Number(period.processing_frames_reserved || 0));
  }
  return Math.max(0, Number(period.creative_credit_limit || 0) - Number(period.creative_credits_used || 0) - Number(period.creative_credits_reserved || 0));
}

function quotaError(error, resourceType) {
  const message = String(error?.message || error || 'Quota exceeded');
  if (message.includes('Insufficient')) {
    const quota = new Error(resourceType === RESOURCE_TYPES.PROCESSING_FRAMES
      ? 'Not enough Processing Frames for this operation.'
      : 'Not enough Creative Credits for this operation.');
    quota.statusCode = 402;
    quota.details = message;
    return quota;
  }
  return error;
}

export async function reserveUsage(supabase, {
  userId,
  resourceType,
  amount,
  sourceType,
  sourceId,
  idempotencyKey,
  metadata = {},
  entitlement = null,
}) {
  const { effective, period } = entitlement || await ensureUsagePeriod(supabase, userId);
  const { data, error } = await supabase.rpc('reserve_frameflow_usage', {
    p_user_id: userId,
    p_usage_period_id: period.id,
    p_resource_type: resourceType,
    p_amount: Math.max(1, Math.round(Number(amount) || 0)),
    p_source_type: sourceType,
    p_source_id: sourceId ? String(sourceId) : null,
    p_idempotency_key: String(idempotencyKey),
    p_metadata: metadata,
  });
  if (error) throw quotaError(error, resourceType);
  return { effective, period, reservation: data };
}

export async function consumeUsage(supabase, reservationId, amount = null) {
  if (!reservationId) return null;
  const { data, error } = await supabase.rpc('consume_frameflow_usage', {
    p_reservation_id: reservationId,
    p_amount: amount == null ? null : Math.max(1, Math.round(Number(amount) || 0)),
  });
  if (error) throw error;
  return data;
}

export async function releaseUsage(supabase, reservationId) {
  if (!reservationId) return null;
  const { data, error } = await supabase.rpc('release_frameflow_usage', {
    p_reservation_id: reservationId,
  });
  if (error) throw error;
  return data;
}

export async function recordUsageEvent(supabase, {
  userId,
  projectId = null,
  jobId = null,
  eventType,
  resourceType = null,
  quantity = 1,
  processingSeconds = null,
  inputBytes = null,
  outputBytes = null,
  visionCallCount = 0,
  modelId = null,
  provider = null,
  status = 'completed',
  estimatedCostUsd = null,
  metadata = {},
}) {
  const { error } = await supabase.from('usage_events').insert({
    user_id: userId,
    project_id: projectId,
    job_id: jobId ? String(jobId) : null,
    event_type: eventType,
    resource_type: resourceType,
    quantity,
    processing_seconds: processingSeconds,
    input_bytes: inputBytes,
    output_bytes: outputBytes,
    vision_call_count: visionCallCount,
    model_id: modelId,
    provider,
    status,
    estimated_cost_usd: estimatedCostUsd,
    metadata,
  });
  if (error) console.warn('[usage] unable to record event:', error.message);
}

export async function getEntitlements(supabase, userId) {
  const { effective, period } = await ensureUsagePeriod(supabase, userId);
  const [{ count: projectCount, error: projectError }, { count: activeCreativeJobs, error: creativeError }] = await Promise.all([
    supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('archived_at', null),
    supabase
      .from('creative_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['queued', 'processing']),
  ]);
  if (projectError) throw projectError;
  if (creativeError) throw creativeError;

  const projectLimit = effective.plan.project_limit == null ? null : Number(effective.plan.project_limit);
  const processingLimit = Number(period.processing_frame_limit || 0);
  const processingUsed = Number(period.processing_frames_used || 0);
  const processingReserved = Number(period.processing_frames_reserved || 0);
  const creativeLimit = Number(period.creative_credit_limit || 0);
  const creativeUsed = Number(period.creative_credits_used || 0);
  const creativeReserved = Number(period.creative_credits_reserved || 0);

  return {
    plan: {
      code: effective.code,
      name: effective.plan.name,
      status: effective.status,
      periodStart: effective.periodStart.toISOString(),
      periodEnd: effective.periodEnd.toISOString(),
      trialDaysRemaining: effective.trialDaysRemaining,
      priceVnd: Number(effective.plan.price_vnd || 0),
    },
    limits: {
      projects: projectLimit,
      processingFrames: processingLimit,
      creativeCredits: creativeLimit,
      creativeConcurrent: Math.max(1, Number(effective.plan.creative_concurrent_limit) || 1),
      creativeDaily: Math.max(1, Number(effective.plan.creative_daily_limit) || 1),
      versionHistoryDays: Math.max(0, Number(effective.plan.version_history_days) || 0),
    },
    usage: {
      projects: projectCount || 0,
      processingFrames: processingUsed,
      processingFramesReserved: processingReserved,
      processingFramesRemaining: Math.max(0, processingLimit - processingUsed - processingReserved),
      creativeCredits: creativeUsed,
      creativeCreditsReserved: creativeReserved,
      creativeCreditsRemaining: Math.max(0, creativeLimit - creativeUsed - creativeReserved),
      activeCreativeJobs: activeCreativeJobs || 0,
    },
    features: {
      autoColor: true,
      manualCorrection: true,
      visionAssistIncluded: true,
      creativeStudio: creativeLimit > 0,
      priorityQueue: Boolean(effective.plan.priority_queue),
      highQualityExport: Boolean(effective.plan.high_quality_export),
    },
    creativeCosts: CREATIVE_COSTS,
    usagePeriodId: period.id,
  };
}

export async function enforceProjectLimit(supabase, userId) {
  const entitlements = await getEntitlements(supabase, userId);
  if (entitlements.limits.projects != null && entitlements.usage.projects >= entitlements.limits.projects) {
    const error = new Error(`Your ${entitlements.plan.name} plan allows ${entitlements.limits.projects} active project(s). Archive or delete a project, or upgrade your plan.`);
    error.statusCode = 402;
    error.details = { code: 'PROJECT_LIMIT_REACHED', entitlements };
    throw error;
  }
  return entitlements;
}

export function serializePlan(plan) {
  return {
    code: plan.code,
    name: plan.name,
    description: plan.description,
    priceVnd: Number(plan.price_vnd || 0),
    durationDays: Number(plan.duration_days || 0),
    creditsGrant: Number(plan.credits_grant || 0),
    projectLimit: plan.project_limit == null ? null : Number(plan.project_limit),
    processingFrameLimit: Number(plan.processing_frame_limit || 0),
    creativeCreditLimit: Number(plan.creative_credit_limit ?? plan.credits_grant ?? 0),
    creativeDailyLimit: Number(plan.creative_daily_limit || 0),
    creativeConcurrentLimit: Number(plan.creative_concurrent_limit || 0),
    trialDays: Number(plan.trial_days || 0),
    priorityQueue: Boolean(plan.priority_queue),
    highQualityExport: Boolean(plan.high_quality_export),
    versionHistoryDays: Number(plan.version_history_days || 0),
    sortOrder: Number(plan.sort_order || 0),
    features: Array.isArray(plan.features) ? plan.features : [],
  };
}

export { requireUser };
