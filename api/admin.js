import { ensureMethod, readJsonBody, sendError, sendJson } from '../server/stability-shared.js';
import { getEntitlements, getSupabaseAdmin, requireAdmin } from '../server/account-shared.js';

async function logAudit(supabase, adminId, action, targetUserId = null, details = {}) {
  const { error } = await supabase.from('audit_logs').insert({ admin_id: adminId, action, target_user_id: targetUserId, details });
  if (error) console.warn('Audit logging failed:', error.message);
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

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['GET', 'POST', 'PATCH', 'DELETE'])) return;
  try {
    const admin = await requireAdmin(req);
    const supabase = getSupabaseAdmin();
    const action = String(req.query?.action || 'users').toLowerCase();
    const body = req.method === 'GET' ? {} : await readJsonBody(req);

    if (req.method === 'GET' && action === 'users') {
      const now = new Date().toISOString();
      const [profilesResult, periodsResult] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase
          .from('account_usage_periods')
          .select('user_id,period_start,creative_credit_limit,creative_credits_used,creative_credits_reserved')
          .lte('period_start', now)
          .gt('period_end', now)
          .order('period_start', { ascending: false }),
      ]);
      if (profilesResult.error) throw profilesResult.error;
      if (periodsResult.error) throw periodsResult.error;
      const currentPeriodByUser = new Map();
      for (const period of periodsResult.data || []) {
        if (!currentPeriodByUser.has(period.user_id)) currentPeriodByUser.set(period.user_id, period);
      }
      const users = (profilesResult.data || []).map((profile) => {
        const period = currentPeriodByUser.get(profile.id);
        const available = period
          ? Math.max(0, Number(period.creative_credit_limit || 0) - Number(period.creative_credits_used || 0) - Number(period.creative_credits_reserved || 0))
          : Number(profile.credits || 0);
        return { ...profile, credits: available };
      });
      return sendJson(res, 200, { ok: true, data: users });
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
      const now = new Date();
      const since = new Date(now.getTime() - 30 * 86400000).toISOString();
      const [total, active, periods, usage] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('updated_at', since),
        supabase.from('account_usage_periods').select('creative_credit_limit,creative_credits_used,creative_credits_reserved').lte('period_start', now.toISOString()).gt('period_end', now.toISOString()),
        supabase.from('usage_events').select('resource_type,quantity,estimated_cost_usd,status').gte('created_at', since),
      ]);
      for (const result of [total, active, periods, usage]) if (result.error) throw result.error;
      const totalCredits = (periods.data || []).reduce((sum, row) => sum + Math.max(0, Number(row.creative_credit_limit || 0) - Number(row.creative_credits_used || 0) - Number(row.creative_credits_reserved || 0)), 0);
      const usageRows = usage.data || [];
      const processingFrames = usageRows.filter((row) => row.resource_type === 'processing_frames' && row.status !== 'released').reduce((sum, row) => sum + Number(row.quantity || 0), 0);
      const creativeCreditsUsed = usageRows.filter((row) => row.resource_type === 'creative_credits' && row.status !== 'released').reduce((sum, row) => sum + Number(row.quantity || 0), 0);
      const estimatedCostUsd = usageRows.reduce((sum, row) => sum + Number(row.estimated_cost_usd || 0), 0);
      return sendJson(res, 200, { ok: true, data: {
        totalUsers: total.count || 0,
        activeUsers: active.count || 0,
        totalCredits,
        processingFrames,
        creativeCreditsUsed,
        estimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
      } });
    }
    if (req.method === 'PATCH' && action === 'role') {
      const userId = String(body.userId || '');
      const role = cleanRole(body.role);
      const { error } = await supabase.from('profiles').update({ role, updated_at: new Date().toISOString() }).eq('id', userId);
      if (error) throw error;
      await logAudit(supabase, admin.id, 'UPDATE_USER_ROLE', userId, { role });
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'POST' && action === 'credits') {
      const userId = String(body.userId || '');
      const amount = Number(body.amount);
      const reason = String(body.reason || 'Admin adjustment').trim();
      if (!userId || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 100000) {
        const error = new Error('A valid non-zero integer credit adjustment is required');
        error.statusCode = 400;
        throw error;
      }
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
      await logAudit(supabase, admin.id, 'DELETE_USER', userId);
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;
      return sendJson(res, 200, { ok: true });
    }
    return sendError(res, 404, 'Admin action not found');
  } catch (error) {
    return sendError(res, Number(error?.statusCode) || 500, 'Admin request failed', error?.message || String(error));
  }
}
