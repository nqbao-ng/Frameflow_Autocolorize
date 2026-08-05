import { ensureMethod, readJsonBody, sendError, sendJson } from '../server/stability-shared.js';
import { getEntitlements, getSupabaseAdmin, requireAdmin } from '../server/account-shared.js';

const PAYMENT_STATUSES = new Set(['all', 'pending', 'paid', 'cancelled', 'expired', 'failed']);
const USER_ROLES = new Set(['all', 'user', 'admin']);
const USER_PLANS = new Set(['all', 'trial', 'free', 'pro', 'studio']);

async function logAudit(supabase, adminId, action, targetUserId = null, details = {}) {
  const { error } = await supabase
    .from('audit_logs')
    .insert({ admin_id: adminId, action, target_user_id: targetUserId, details });
  if (error) throw new Error(`Audit logging failed: ${error.message}`);
}

function cleanRole(value) {
  const role = String(value || '').toLowerCase();
  if (!['user', 'admin'].includes(role)) {
    const error = new Error('Role must be user or admin');
    error.statusCode = 400;
    throw error;
  }
  return role;
}

function cleanEnum(value, allowed, fallback) {
  const normalized = String(value || fallback).trim().toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

export function cleanSearch(value) {
  return String(value || '')
    .replace(/[,*()[\]{}\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export function pagination(query) {
  const page = Math.max(1, Math.floor(Number(query?.page) || 1));
  const pageSize = Math.max(10, Math.min(100, Math.floor(Number(query?.pageSize) || 20)));
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}

function paged(items, total, page, pageSize) {
  return {
    items,
    page,
    pageSize,
    total: Number(total || 0),
    totalPages: Math.max(1, Math.ceil(Number(total || 0) / pageSize)),
  };
}

async function listUsers(supabase, query) {
  const { page, pageSize, from, to } = pagination(query);
  const search = cleanSearch(query?.search);
  const role = cleanEnum(query?.role, USER_ROLES, 'all');
  const plan = cleanEnum(query?.plan, USER_PLANS, 'all');

  let profilesQuery = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (role !== 'all') profilesQuery = profilesQuery.eq('role', role);
  if (plan !== 'all') profilesQuery = profilesQuery.eq('subscription_plan', plan);
  if (search) profilesQuery = profilesQuery.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);

  const profilesResult = await profilesQuery;
  if (profilesResult.error) throw profilesResult.error;
  const profiles = profilesResult.data || [];
  const userIds = profiles.map((profile) => profile.id);
  if (userIds.length === 0) return paged([], profilesResult.count, page, pageSize);

  const now = new Date().toISOString();
  const [periodsResult, subscriptionsResult] = await Promise.all([
    supabase
      .from('account_usage_periods')
      .select('user_id,period_start,creative_credit_limit,creative_credits_used,creative_credits_reserved')
      .in('user_id', userIds)
      .lte('period_start', now)
      .gt('period_end', now)
      .order('period_start', { ascending: false }),
    supabase
      .from('subscriptions')
      .select('user_id,plan_code,status,current_period_start,current_period_end')
      .in('user_id', userIds),
  ]);
  if (periodsResult.error) throw periodsResult.error;
  if (subscriptionsResult.error) throw subscriptionsResult.error;

  const currentPeriodByUser = new Map();
  for (const period of periodsResult.data || []) {
    if (!currentPeriodByUser.has(period.user_id)) currentPeriodByUser.set(period.user_id, period);
  }
  const subscriptionByUser = new Map((subscriptionsResult.data || []).map((row) => [row.user_id, row]));

  const users = profiles.map((profile) => {
    const period = currentPeriodByUser.get(profile.id);
    const subscription = subscriptionByUser.get(profile.id);
    const available = period
      ? Math.max(0, Number(period.creative_credit_limit || 0) - Number(period.creative_credits_used || 0) - Number(period.creative_credits_reserved || 0))
      : Number(profile.credits || 0);
    return {
      ...profile,
      credits: available,
      subscription_status: subscription?.status || null,
      subscription_period_start: subscription?.current_period_start || null,
      subscription_period_end: subscription?.current_period_end || null,
    };
  });
  return paged(users, profilesResult.count, page, pageSize);
}

async function findPaymentUserIds(supabase, search) {
  if (!search) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
    .limit(250);
  if (error) throw error;
  return (data || []).map((row) => row.id);
}

async function listPayments(supabase, query) {
  const { page, pageSize, from, to } = pagination(query);
  const status = cleanEnum(query?.status, PAYMENT_STATUSES, 'all');
  const search = cleanSearch(query?.search);
  const numericOrderCode = /^\d+$/.test(search) ? Number(search) : null;
  const matchingUserIds = search && numericOrderCode === null
    ? await findPaymentUserIds(supabase, search)
    : null;

  if (matchingUserIds && matchingUserIds.length === 0) return paged([], 0, page, pageSize);

  let paymentsQuery = supabase
    .from('payment_orders')
    .select('id,user_id,order_code,amount_vnd,plan_code,status,provider,description,created_at,updated_at,paid_at,cancelled_at,expires_at,payos_reference,error_message', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (status !== 'all') paymentsQuery = paymentsQuery.eq('status', status);
  if (numericOrderCode !== null) paymentsQuery = paymentsQuery.eq('order_code', numericOrderCode);
  if (matchingUserIds) paymentsQuery = paymentsQuery.in('user_id', matchingUserIds);

  const paymentsResult = await paymentsQuery;
  if (paymentsResult.error) throw paymentsResult.error;
  const payments = paymentsResult.data || [];
  const userIds = [...new Set(payments.map((payment) => payment.user_id))];
  if (userIds.length === 0) return paged([], paymentsResult.count, page, pageSize);

  const [profilesResult, subscriptionsResult] = await Promise.all([
    supabase.from('profiles').select('id,email,full_name').in('id', userIds),
    supabase
      .from('subscriptions')
      .select('user_id,status,current_period_end')
      .in('user_id', userIds),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (subscriptionsResult.error) throw subscriptionsResult.error;

  const profileByUser = new Map((profilesResult.data || []).map((row) => [row.id, row]));
  const subscriptionByUser = new Map((subscriptionsResult.data || []).map((row) => [row.user_id, row]));
  const items = payments.map((payment) => {
    const profile = profileByUser.get(payment.user_id);
    const subscription = subscriptionByUser.get(payment.user_id);
    return {
      ...payment,
      customer_email: profile?.email || 'Deleted user',
      customer_name: profile?.full_name || '',
      subscription_status: subscription?.status || null,
      subscription_period_end: subscription?.current_period_end || null,
    };
  });
  return paged(items, paymentsResult.count, page, pageSize);
}

function serializeMetrics(row) {
  return {
    totalUsers: Number(row?.total_users || 0),
    newUsers30d: Number(row?.new_users_30d || 0),
    activeUsers: Number(row?.active_users_30d || 0),
    activeSubscriptions: Number(row?.active_subscriptions || 0),
    paidOrders30d: Number(row?.paid_orders_30d || 0),
    pendingPayments: Number(row?.pending_payments || 0),
    revenue30dVnd: Number(row?.revenue_30d_vnd || 0),
    revenueAllTimeVnd: Number(row?.revenue_all_time_vnd || 0),
    totalCredits: Number(row?.available_creative_credits || 0),
    processingFrames: Number(row?.processing_frames_30d || 0),
    creativeCreditsUsed: Number(row?.creative_credits_used_30d || 0),
    estimatedCostUsd: Number(Number(row?.estimated_cost_usd_30d || 0).toFixed(4)),
  };
}

async function fallbackMetrics(supabase, since, nowIso) {
  const [total, newUsers, activeRows, activeSubscriptions, paid30d, paidAll, pending, periods, usage] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', since),
    supabase.from('usage_events').select('user_id').gte('created_at', since).limit(10000),
    supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active').gt('current_period_end', nowIso),
    supabase.from('payment_orders').select('amount_vnd').eq('status', 'paid').gte('paid_at', since),
    supabase.from('payment_orders').select('amount_vnd').eq('status', 'paid'),
    supabase.from('payment_orders').select('*', { count: 'exact', head: true }).eq('status', 'pending').gt('expires_at', nowIso),
    supabase.from('account_usage_periods').select('creative_credit_limit,creative_credits_used,creative_credits_reserved').lte('period_start', nowIso).gt('period_end', nowIso),
    supabase.from('usage_events').select('resource_type,quantity,estimated_cost_usd,status').gte('created_at', since),
  ]);
  for (const result of [total, newUsers, activeRows, activeSubscriptions, paid30d, paidAll, pending, periods, usage]) {
    if (result.error) throw result.error;
  }

  const usageRows = usage.data || [];
  return serializeMetrics({
    total_users: total.count,
    new_users_30d: newUsers.count,
    active_users_30d: new Set((activeRows.data || []).map((row) => row.user_id)).size,
    active_subscriptions: activeSubscriptions.count,
    paid_orders_30d: (paid30d.data || []).length,
    pending_payments: pending.count,
    revenue_30d_vnd: (paid30d.data || []).reduce((sum, row) => sum + Number(row.amount_vnd || 0), 0),
    revenue_all_time_vnd: (paidAll.data || []).reduce((sum, row) => sum + Number(row.amount_vnd || 0), 0),
    available_creative_credits: (periods.data || []).reduce((sum, row) => sum + Math.max(0, Number(row.creative_credit_limit || 0) - Number(row.creative_credits_used || 0) - Number(row.creative_credits_reserved || 0)), 0),
    processing_frames_30d: usageRows.filter((row) => row.resource_type === 'processing_frames' && row.status !== 'released').reduce((sum, row) => sum + Number(row.quantity || 0), 0),
    creative_credits_used_30d: usageRows.filter((row) => row.resource_type === 'creative_credits' && row.status !== 'released').reduce((sum, row) => sum + Number(row.quantity || 0), 0),
    estimated_cost_usd_30d: usageRows.reduce((sum, row) => sum + Number(row.estimated_cost_usd || 0), 0),
  });
}

async function getMetrics(supabase) {
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 86400000).toISOString();
  const { data, error } = await supabase.rpc('get_frameflow_admin_metrics', { p_since: since });
  if (!error) return serializeMetrics(Array.isArray(data) ? data[0] : data);
  if (!/function .* does not exist|schema cache/i.test(String(error.message || ''))) throw error;
  return fallbackMetrics(supabase, since, now.toISOString());
}

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['GET', 'POST', 'PATCH', 'DELETE'])) return;
  try {
    const admin = await requireAdmin(req);
    const supabase = getSupabaseAdmin();
    const action = String(req.query?.action || 'users').toLowerCase();
    const body = req.method === 'GET' ? {} : await readJsonBody(req);

    if (req.method === 'GET' && action === 'users') {
      return sendJson(res, 200, { ok: true, data: await listUsers(supabase, req.query) });
    }
    if (req.method === 'GET' && action === 'payments') {
      return sendJson(res, 200, { ok: true, data: await listPayments(supabase, req.query) });
    }
    if (req.method === 'GET' && action === 'user') {
      const userId = String(req.query?.userId || '');
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error) throw error;
      const entitlements = await getEntitlements(supabase, userId).catch(() => null);
      return sendJson(res, 200, { ok: true, data: { ...data, credits: entitlements?.usage.creativeCreditsRemaining ?? data.credits ?? 0, entitlements } });
    }
    if (req.method === 'GET' && action === 'audits') {
      const limit = Math.max(1, Math.min(500, Number(req.query?.limit) || 100));
      const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return sendJson(res, 200, { ok: true, data: data || [] });
    }
    if (req.method === 'GET' && action === 'transactions') {
      const userId = String(req.query?.userId || '');
      const limit = Math.max(1, Math.min(500, Number(req.query?.limit) || 50));
      const { data, error } = await supabase.from('credit_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return sendJson(res, 200, { ok: true, data: data || [] });
    }
    if (req.method === 'GET' && action === 'metrics') {
      return sendJson(res, 200, { ok: true, data: await getMetrics(supabase) });
    }
    if (req.method === 'PATCH' && action === 'role') {
      const userId = String(body.userId || '');
      const role = cleanRole(body.role);
      if (!userId) throw Object.assign(new Error('User id is required'), { statusCode: 400 });
      if (userId === admin.id && role !== 'admin') {
        throw Object.assign(new Error('You cannot remove your own admin access'), { statusCode: 400 });
      }
      const { data: target, error: targetError } = await supabase.from('profiles').select('role,email').eq('id', userId).maybeSingle();
      if (targetError) throw targetError;
      if (!target) throw Object.assign(new Error('User not found'), { statusCode: 404 });
      if (target.role === role) return sendJson(res, 200, { ok: true });
      const { error } = await supabase.from('profiles').update({ role, updated_at: new Date().toISOString() }).eq('id', userId);
      if (error) throw error;
      await logAudit(supabase, admin.id, 'UPDATE_USER_ROLE', userId, { previousRole: target.role, role, email: target.email });
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'POST' && action === 'credits') {
      const userId = String(body.userId || '');
      const amount = Number(body.amount);
      const reason = String(body.reason || '').trim().slice(0, 240);
      if (!userId || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 100000) {
        throw Object.assign(new Error('A valid non-zero integer credit adjustment is required'), { statusCode: 400 });
      }
      if (reason.length < 3) throw Object.assign(new Error('A clear adjustment reason is required'), { statusCode: 400 });
      const entitlements = await getEntitlements(supabase, userId);
      const { error } = await supabase.rpc('adjust_frameflow_creative_credits', {
        p_user_id: userId,
        p_usage_period_id: entitlements.usagePeriodId,
        p_amount: amount,
        p_admin_id: admin.id,
        p_reason: reason,
      });
      if (error) throw error;
      await logAudit(supabase, admin.id, amount > 0 ? 'ADD_CREATIVE_CREDITS' : 'DEDUCT_CREATIVE_CREDITS', userId, { amount, reason });
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'DELETE' && action === 'user') {
      const userId = String(body.userId || req.query?.userId || '');
      if (!userId) throw Object.assign(new Error('User id is required'), { statusCode: 400 });
      if (userId === admin.id) throw Object.assign(new Error('You cannot delete your own admin account'), { statusCode: 400 });
      const { data: target, error: targetError } = await supabase.from('profiles').select('email,role').eq('id', userId).maybeSingle();
      if (targetError) throw targetError;
      if (!target) throw Object.assign(new Error('User not found'), { statusCode: 404 });
      if (target.role === 'admin') {
        throw Object.assign(new Error('Demote this admin to user before deleting the account'), { statusCode: 409 });
      }
      await logAudit(supabase, admin.id, 'DELETE_USER_REQUESTED', userId, { email: target.email, role: target.role });
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;
      return sendJson(res, 200, { ok: true });
    }
    return sendError(res, 404, 'Admin action not found');
  } catch (error) {
    return sendError(res, Number(error?.statusCode) || 500, 'Admin request failed', error?.message || String(error));
  }
}
