import { createHash } from 'node:crypto';
import { enforceApiRateLimit, getSupabaseAdmin } from '../server/account-shared.js';
import { sendJson } from '../server/stability-shared.js';

const MAX_BODY_BYTES = 32 * 1024;
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE']);
const ALLOWED_AUTH_PATHS = new Set([
  '/auth/v1/logout',
  '/auth/v1/otp',
  '/auth/v1/reauthenticate',
  '/auth/v1/recover',
  '/auth/v1/resend',
  '/auth/v1/settings',
  '/auth/v1/signup',
  '/auth/v1/token',
  '/auth/v1/user',
  '/auth/v1/verify',
]);

function httpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function normalizeAuthPath(value) {
  const raw = String(value || '').trim();
  if (!raw.startsWith('/auth/v1/')) {
    throw httpError(400, 'Unsupported authentication endpoint', 'invalid_auth_path');
  }

  const parsed = new URL(raw, 'https://frameflow.invalid');
  if (!ALLOWED_AUTH_PATHS.has(parsed.pathname)) {
    throw httpError(400, 'Unsupported authentication endpoint', 'invalid_auth_path');
  }

  return `${parsed.pathname}${parsed.search}`;
}

function originFromEnv(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    return new URL(raw.includes('://') ? raw : `https://${raw}`).origin;
  } catch {
    return null;
  }
}

export function isAllowedRequestOrigin(req) {
  const origin = String(req.headers?.origin || '').trim();
  if (!origin) return true;

  const forwardedProto = String(req.headers?.['x-forwarded-proto'] || 'https')
    .split(',')[0]
    .trim();
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '')
    .split(',')[0]
    .trim();

  const allowed = new Set([
    originFromEnv(process.env.APP_URL),
    originFromEnv(process.env.VERCEL_URL),
    originFromEnv(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    host ? originFromEnv(`${forwardedProto}://${host}`) : null,
  ].filter(Boolean));

  return allowed.has(originFromEnv(origin));
}

function clientFingerprint(req) {
  const address = String(
    req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'] || 'unknown',
  ).split(',')[0].trim();

  return createHash('sha256').update(address).digest('hex').slice(0, 24);
}

async function readRawBody(req) {
  let body;
  if (Buffer.isBuffer(req.body)) body = req.body;
  else if (typeof req.body === 'string') body = Buffer.from(req.body);
  else if (req.body && typeof req.body === 'object') body = Buffer.from(JSON.stringify(req.body));
  else {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      const buffer = Buffer.from(chunk);
      size += buffer.length;
      if (size > MAX_BODY_BYTES) {
        throw httpError(413, 'Authentication request is too large', 'request_too_large');
      }
      chunks.push(buffer);
    }
    body = Buffer.concat(chunks);
  }

  if (body.length > MAX_BODY_BYTES) {
    throw httpError(413, 'Authentication request is too large', 'request_too_large');
  }
  return body;
}

async function applyRateLimit(req, authPath) {
  const pathname = new URL(authPath, 'https://frameflow.invalid').pathname;
  const policy = {
    '/auth/v1/otp': { limit: 5, windowSeconds: 900 },
    '/auth/v1/recover': { limit: 5, windowSeconds: 900 },
    '/auth/v1/resend': { limit: 5, windowSeconds: 900 },
    '/auth/v1/signup': { limit: 5, windowSeconds: 900 },
    '/auth/v1/token': { limit: 20, windowSeconds: 900 },
  }[pathname];

  if (!policy) return;
  await enforceApiRateLimit(getSupabaseAdmin(), {
    key: `auth-proxy:${pathname}:${clientFingerprint(req)}`,
    ...policy,
  });
}

function copyUpstreamHeader(upstream, res, name) {
  const value = upstream.headers.get(name);
  if (value) res.setHeader(name, value);
}

export default async function handler(req, res) {
  try {
    if (!ALLOWED_METHODS.has(req.method)) {
      res.setHeader('Allow', [...ALLOWED_METHODS].join(', '));
      throw httpError(405, `Method ${req.method} not allowed`, 'method_not_allowed');
    }
    if (!isAllowedRequestOrigin(req)) {
      throw httpError(403, 'Authentication request origin is not allowed', 'origin_not_allowed');
    }

    const authPath = normalizeAuthPath(req.query?.path);
    const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
      .trim()
      .replace(/\/$/, '');
    const publicKey = String(process.env.VITE_SUPABASE_ANON_KEY || '').trim();
    if (!supabaseUrl || !publicKey) {
      throw httpError(503, 'FrameFlow authentication is not configured', 'auth_not_configured');
    }

    await applyRateLimit(req, authPath);
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readRawBody(req);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let upstream;
    try {
      upstream = await fetch(`${supabaseUrl}${authPath}`, {
        method: req.method,
        signal: controller.signal,
        headers: {
          apikey: publicKey,
          authorization: String(req.headers?.authorization || `Bearer ${publicKey}`),
          'content-type': String(req.headers?.['content-type'] || 'application/json'),
          'x-client-info': 'frameflow-auth-proxy/1.0',
          ...(req.headers?.['x-supabase-api-version']
            ? { 'x-supabase-api-version': String(req.headers['x-supabase-api-version']) }
            : {}),
        },
        ...(body !== undefined ? { body } : {}),
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw httpError(504, 'Authentication service timed out', 'auth_timeout');
      }
      throw httpError(502, 'Authentication service is temporarily unavailable', 'auth_upstream_unavailable');
    } finally {
      clearTimeout(timeoutId);
    }

    res.statusCode = upstream.status;
    res.setHeader('Cache-Control', 'no-store');
    copyUpstreamHeader(upstream, res, 'content-type');
    copyUpstreamHeader(upstream, res, 'sb-error-code');
    copyUpstreamHeader(upstream, res, 'www-authenticate');
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    const status = Number(error?.statusCode) || 500;
    const message = status >= 500
      ? 'FrameFlow authentication is temporarily unavailable. Please try again shortly.'
      : String(error?.message || 'Authentication request failed');
    if (status >= 500) console.error('[auth-proxy]', error?.message || error);
    return sendJson(res, status, {
      code: error?.code || 'auth_proxy_error',
      error_code: error?.code || 'auth_proxy_error',
      msg: message,
      message,
    });
  }
}
