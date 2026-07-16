import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  ensureMethod,
  readJsonBody,
  requireUser,
  sendError,
  sendJson,
} from '../server/stability-shared.js';
import { enforceApiRateLimit, getEntitlements, serializePlan } from '../server/account-shared.js';

export const config = { maxDuration: 30 };

const PAYOS_API_BASE = 'https://api-merchant.payos.vn';
const PAYMENT_STATUSES = new Set(['pending', 'paid', 'cancelled', 'expired', 'failed']);

function getSupabaseAdmin() {
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

function getPayOSConfig() {
  const clientId = String(process.env.PAYOS_CLIENT_ID || '').trim();
  const apiKey = String(process.env.PAYOS_API_KEY || '').trim();
  const checksumKey = String(process.env.PAYOS_CHECKSUM_KEY || '').trim();
  const appUrl = String(process.env.PAYOS_APP_URL || '').trim().replace(/\/$/, '');

  if (!clientId || !apiKey || !checksumKey) {
    const error = new Error('payOS credentials are not configured');
    error.statusCode = 503;
    throw error;
  }
  if (!appUrl || !/^https:\/\//i.test(appUrl)) {
    const error = new Error('PAYOS_APP_URL must be a production HTTPS URL');
    error.statusCode = 503;
    throw error;
  }

  return { clientId, apiKey, checksumKey, appUrl };
}

function sortObject(value) {
  return Object.keys(value || {})
    .sort()
    .reduce((result, key) => {
      result[key] = value[key];
      return result;
    }, {});
}

function toSignatureQuery(data) {
  return Object.keys(sortObject(data))
    .filter((key) => data[key] !== undefined)
    .map((key) => {
      let value = data[key];
      if (Array.isArray(value)) {
        value = JSON.stringify(value.map((item) => (
          item && typeof item === 'object' ? sortObject(item) : item
        )));
      } else if (value && typeof value === 'object') {
        value = JSON.stringify(sortObject(value));
      }
      if (value === null || value === undefined || value === 'null' || value === 'undefined') {
        value = '';
      }
      return `${key}=${value}`;
    })
    .join('&');
}

function createPayOSSignature(data, checksumKey) {
  return createHmac('sha256', checksumKey)
    .update(toSignatureQuery(data))
    .digest('hex');
}

function safeSignatureEqual(left, right) {
  const a = Buffer.from(String(left || '').toLowerCase(), 'utf8');
  const b = Buffer.from(String(right || '').toLowerCase(), 'utf8');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function verifyPayOSSignature(data, signature, checksumKey) {
  return safeSignatureEqual(createPayOSSignature(data, checksumKey), signature);
}

async function payOSRequest(path, { method = 'GET', body } = {}) {
  const { clientId, apiKey, checksumKey } = getPayOSConfig();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(`${PAYOS_API_BASE}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        'x-client-id': clientId,
        'x-api-key': apiKey,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || (payload.code && payload.code !== '00')) {
      const error = new Error(payload?.desc || payload?.message || `payOS request failed (${response.status})`);
      error.statusCode = response.status >= 400 && response.status < 500 ? response.status : 502;
      throw error;
    }

    if (payload.signature && payload.data && !verifyPayOSSignature(payload.data, payload.signature, checksumKey)) {
      const error = new Error('payOS returned an invalid response signature');
      error.statusCode = 502;
      throw error;
    }

    return payload.data ?? payload;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('payOS took too long to respond');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function makeOrderCode() {
  // 15 digits and below Number.MAX_SAFE_INTEGER.
  return Number(`${Date.now()}${randomInt(10, 100)}`);
}


async function insertPendingPaymentOrder(supabase, payload) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const orderCode = makeOrderCode();
    const { data, error } = await supabase
      .from('payment_orders')
      .insert({ ...payload, order_code: orderCode })
      .select('*')
      .single();

    if (!error) return { orderCode, payment: data };
    if (error.code !== '23505') throw error;
  }

  const error = new Error('Could not allocate a unique payment order code');
  error.statusCode = 503;
  throw error;
}

function normalizePlan(plan) {
  return serializePlan(plan);
}

function serializePayment(payment) {
  return {
    id: payment.id,
    orderCode: Number(payment.order_code),
    planCode: payment.plan_code,
    amountVnd: payment.amount_vnd,
    creditsGrant: payment.credits_grant,
    durationDays: payment.duration_days,
    status: PAYMENT_STATUSES.has(payment.status) ? payment.status : 'failed',
    checkoutUrl: payment.checkout_url,
    paymentLinkId: payment.payment_link_id,
    reference: payment.payos_reference,
    error: payment.error_message,
    expiresAt: payment.expires_at,
    paidAt: payment.paid_at,
    createdAt: payment.created_at,
    updatedAt: payment.updated_at,
  };
}

async function getActivePlans(supabase, { publicOnly = false } = {}) {
  let query = supabase
    .from('billing_plans')
    .select('*')
    .eq('active', true);
  if (publicOnly) query = query.eq('public_visible', true);
  const { data, error } = await query.order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(normalizePlan);
}

async function expireSubscriptionIfNeeded(supabase, userId) {
  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;

  if (subscription?.status === 'active' && new Date(subscription.current_period_end).getTime() <= Date.now()) {
    await supabase
      .from('subscriptions')
      .update({ status: 'expired' })
      .eq('user_id', userId)
      .eq('status', 'active');
    await supabase
      .from('profiles')
      .update({ subscription_plan: 'free', updated_at: new Date().toISOString() })
      .eq('id', userId);
    return { ...subscription, status: 'expired' };
  }

  return subscription;
}

async function applyPaidOrder(supabase, payosData) {
  const { data, error } = await supabase.rpc('apply_payos_payment', {
    p_order_code: Number(payosData.orderCode),
    p_amount: Number(payosData.amount),
    p_reference: String(payosData.reference || ''),
    p_payment_link_id: String(payosData.paymentLinkId || ''),
    p_payload: payosData,
  });
  if (error) throw error;
  return data;
}

async function handlePlans(_req, res) {
  const supabase = getSupabaseAdmin();
  const plans = await getActivePlans(supabase, { publicOnly: true });
  return sendJson(res, 200, { ok: true, plans });
}

async function handleSummary(req, res) {
  const user = await requireUser(req);
  const supabase = getSupabaseAdmin();
  await expireSubscriptionIfNeeded(supabase, user.id);
  const [plans, entitlements, paymentsResult] = await Promise.all([
    getActivePlans(supabase, { publicOnly: true }),
    getEntitlements(supabase, user.id),
    supabase
      .from('payment_orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  if (paymentsResult.error) throw paymentsResult.error;

  const { data: subscription, error: subscriptionError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (subscriptionError) throw subscriptionError;

  return sendJson(res, 200, {
    ok: true,
    plans,
    entitlements,
    profile: {
      credits: entitlements.usage.creativeCreditsRemaining,
      planCode: entitlements.plan.code,
    },
    subscription: subscription ? {
      planCode: subscription.plan_code,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
    } : null,
    payments: (paymentsResult.data || []).map(serializePayment),
  });
}

async function handleCreateCheckout(req, res) {
  const user = await requireUser(req);
  const supabase = getSupabaseAdmin();
  await enforceApiRateLimit(supabase, { key: `billing:checkout:${user.id}`, limit: 5, windowSeconds: 900 });
  const body = await readJsonBody(req);
  const planCode = String(body.planCode || '').trim().toLowerCase();

  if (planCode === 'studio') {
    const error = new Error('The Studio plan is coming soon');
    error.statusCode = 409;
    throw error;
  }

  const { data: plan, error: planError } = await supabase
    .from('billing_plans')
    .select('*')
    .eq('code', planCode)
    .eq('active', true)
    .maybeSingle();
  if (planError) throw planError;
  if (!plan || plan.price_vnd <= 0 || plan.duration_days <= 0) {
    const error = new Error('Choose an active paid plan');
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();

  const { data: currentSubscription, error: currentSubscriptionError } = await supabase
    .from('subscriptions')
    .select('plan_code, status, current_period_end')
    .eq('user_id', user.id)
    .maybeSingle();
  if (currentSubscriptionError) throw currentSubscriptionError;

  if (
    currentSubscription?.status === 'active'
    && new Date(currentSubscription.current_period_end).getTime() > now.getTime()
    && currentSubscription.plan_code !== plan.code
  ) {
    const { data: currentPlan, error: currentPlanError } = await supabase
      .from('billing_plans')
      .select('sort_order')
      .eq('code', currentSubscription.plan_code)
      .maybeSingle();
    if (currentPlanError) throw currentPlanError;
    if (Number(currentPlan?.sort_order || 0) > Number(plan.sort_order || 0)) {
      const error = new Error('Downgrades are available after the current paid period ends');
      error.statusCode = 409;
      throw error;
    }
  }

  const { error: expireOrdersError } = await supabase
    .from('payment_orders')
    .update({ status: 'expired' })
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .lte('expires_at', now.toISOString());
  if (expireOrdersError) throw expireOrdersError;

  const { data: existing, error: existingError } = await supabase
    .from('payment_orders')
    .select('*')
    .eq('user_id', user.id)
    .eq('plan_code', planCode)
    .eq('status', 'pending')
    .gt('expires_at', now.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.checkout_url) {
    return sendJson(res, 200, { ok: true, reused: true, payment: serializePayment(existing) });
  }

  const { checksumKey, appUrl } = getPayOSConfig();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const description = planCode === 'studio' ? 'FFSTUDIO' : 'FFPRO';
  const { orderCode, payment: created } = await insertPendingPaymentOrder(supabase, {
    user_id: user.id,
    plan_code: plan.code,
    amount_vnd: plan.price_vnd,
    credits_grant: plan.credits_grant,
    duration_days: plan.duration_days,
    status: 'pending',
    description,
    expires_at: expiresAt.toISOString(),
  });
  const returnUrl = `${appUrl}/payment/result?payment=success&orderCode=${orderCode}`;
  const cancelUrl = `${appUrl}/payment/result?payment=cancelled&orderCode=${orderCode}`;

  try {
    const signatureData = {
      amount: plan.price_vnd,
      cancelUrl,
      description,
      orderCode,
      returnUrl,
    };
    const paymentLink = await payOSRequest('/v2/payment-requests', {
      method: 'POST',
      body: {
        ...signatureData,
        buyerName: String(user.user_metadata?.full_name || '').slice(0, 100) || undefined,
        buyerEmail: user.email || undefined,
        items: [{ name: `FrameFlow ${plan.name} - 1 month`, quantity: 1, price: plan.price_vnd }],
        expiredAt: Math.floor(expiresAt.getTime() / 1000),
        signature: createPayOSSignature(signatureData, checksumKey),
      },
    });

    const { data: updated, error: updateError } = await supabase
      .from('payment_orders')
      .update({
        payment_link_id: paymentLink.paymentLinkId || paymentLink.id || null,
        checkout_url: paymentLink.checkoutUrl || null,
        qr_code: paymentLink.qrCode || null,
        bin: paymentLink.bin || null,
        account_number: paymentLink.accountNumber || null,
        account_name: paymentLink.accountName || null,
        payos_payload: paymentLink,
      })
      .eq('id', created.id)
      .eq('user_id', user.id)
      .select('*')
      .single();
    if (updateError) throw updateError;
    if (!updated.checkout_url) throw new Error('payOS did not return a checkout URL');

    return sendJson(res, 201, { ok: true, reused: false, payment: serializePayment(updated) });
  } catch (error) {
    await supabase
      .from('payment_orders')
      .update({ status: 'failed', error_message: error?.message || String(error) })
      .eq('id', created.id);
    throw error;
  }
}

async function reconcilePayment(supabase, payment) {
  if (payment.status !== 'pending') return payment;
  if (payment.expires_at && new Date(payment.expires_at).getTime() <= Date.now()) {
    const { data: expired } = await supabase
      .from('payment_orders')
      .update({ status: 'expired' })
      .eq('id', payment.id)
      .eq('status', 'pending')
      .select('*')
      .single();
    return expired || payment;
  }

  const remote = await payOSRequest(`/v2/payment-requests/${encodeURIComponent(payment.order_code)}`);
  const remoteStatus = String(remote.status || '').toUpperCase();

  if (remoteStatus === 'PAID') {
    const tx = Array.isArray(remote.transactions) ? remote.transactions.at(-1) : null;
    await applyPaidOrder(supabase, {
      orderCode: Number(remote.orderCode || payment.order_code),
      amount: Number(remote.amountPaid || remote.amount || payment.amount_vnd),
      reference: tx?.reference || remote.reference || '',
      paymentLinkId: remote.id || payment.payment_link_id || '',
      transactionDateTime: tx?.transactionDateTime || null,
      currency: 'VND',
      code: '00',
      desc: 'Thành công',
    });
  } else if (remoteStatus === 'CANCELLED') {
    await supabase
      .from('payment_orders')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), payos_payload: remote })
      .eq('id', payment.id)
      .eq('status', 'pending');
  } else if (remoteStatus === 'EXPIRED') {
    await supabase
      .from('payment_orders')
      .update({ status: 'expired', payos_payload: remote })
      .eq('id', payment.id)
      .eq('status', 'pending');
  }

  const { data: refreshed, error } = await supabase
    .from('payment_orders')
    .select('*')
    .eq('id', payment.id)
    .single();
  if (error) throw error;
  return refreshed;
}

async function handleStatus(req, res) {
  const user = await requireUser(req);
  const supabase = getSupabaseAdmin();
  const orderCode = Number(req.query?.orderCode);
  if (!Number.isSafeInteger(orderCode) || orderCode <= 0) {
    const error = new Error('A valid orderCode is required');
    error.statusCode = 400;
    throw error;
  }

  const { data: payment, error } = await supabase
    .from('payment_orders')
    .select('*')
    .eq('order_code', orderCode)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!payment) {
    const notFound = new Error('Payment order not found');
    notFound.statusCode = 404;
    throw notFound;
  }

  let reconciled = payment;
  try {
    reconciled = await reconcilePayment(supabase, payment);
  } catch (reconcileError) {
    // The local webhook state remains the source of truth when payOS status lookup is temporarily unavailable.
    console.warn('[billing] payment reconciliation failed:', reconcileError?.message || reconcileError);
  }

  return sendJson(res, 200, { ok: true, payment: serializePayment(reconciled) });
}

async function handleWebhook(req, res) {
  const body = await readJsonBody(req);
  const { checksumKey } = getPayOSConfig();
  if (!body?.data || !body?.signature || !verifyPayOSSignature(body.data, body.signature, checksumKey)) {
    return sendError(res, 400, 'Invalid payOS webhook signature');
  }

  const supabase = getSupabaseAdmin();
  const isSuccessful = body.success === true && String(body.code) === '00' && String(body.data.code) === '00';
  if (isSuccessful) {
    await applyPaidOrder(supabase, body.data);
  }

  // payOS expects a 2XX response, including for its sample webhook confirmation payload.
  return sendJson(res, 200, { success: true });
}

export default async function handler(req, res) {
  const action = String(req.query?.action || (req.method === 'POST' ? 'create' : 'summary')).toLowerCase();

  try {
    if (action === 'plans') {
      if (!ensureMethod(req, res, ['GET'])) return;
      return await handlePlans(req, res);
    }
    if (action === 'summary') {
      if (!ensureMethod(req, res, ['GET'])) return;
      return await handleSummary(req, res);
    }
    if (action === 'status') {
      if (!ensureMethod(req, res, ['GET'])) return;
      return await handleStatus(req, res);
    }
    if (action === 'webhook') {
      if (!ensureMethod(req, res, ['POST'])) return;
      return await handleWebhook(req, res);
    }
    if (action === 'create') {
      if (!ensureMethod(req, res, ['POST'])) return;
      return await handleCreateCheckout(req, res);
    }

    return sendError(res, 404, 'Unknown billing action');
  } catch (error) {
    const status = Number(error?.statusCode) || 500;
    console.error('[billing]', action, error);
    return sendError(res, status, 'Billing request failed', error?.message || String(error));
  }
}
