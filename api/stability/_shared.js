import { createClient } from '@supabase/supabase-js';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export function sendError(res, status, message, details = null) {
  sendJson(res, status, { ok: false, error: message, details });
}

export function sendImage(res, { buffer, mimeType, seed = null, finishReason = null }) {
  res.statusCode = 200;
  res.setHeader('Content-Type', mimeType || 'image/png');
  res.setHeader('Cache-Control', 'no-store');
  if (seed) res.setHeader('x-stability-seed', String(seed));
  if (finishReason) res.setHeader('x-stability-finish-reason', String(finishReason));
  res.end(buffer);
}

export function ensureMethod(req, res, allowed) {
  if (!allowed.includes(req.method)) {
    res.setHeader('Allow', allowed.join(', '));
    sendError(res, 405, `Method ${req.method} not allowed`);
    return false;
  }
  return true;
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON body');
  }
}

function getSupabaseVerifier() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables for API authentication');
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireUser(req) {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    const error = new Error('Authentication required');
    error.statusCode = 401;
    throw error;
  }

  const supabase = getSupabaseVerifier();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    const authError = new Error('Invalid or expired session');
    authError.statusCode = 401;
    throw authError;
  }

  return data.user;
}

export function getStabilityApiKey() {
  const apiKey = String(process.env.STABILITY_API_KEY || '').trim();
  if (!apiKey) {
    const error = new Error('STABILITY_API_KEY is not configured on the server');
    error.statusCode = 503;
    throw error;
  }
  return apiKey;
}

export function parseImageDataUrl(imageDataUrl) {
  const value = String(imageDataUrl || '');
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) {
    const error = new Error('imageDataUrl must be a PNG, JPEG, or WebP data URL');
    error.statusCode = 400;
    throw error;
  }

  const contentType = match[1];
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    const error = new Error('Unsupported image type');
    error.statusCode = 400;
    throw error;
  }

  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!buffer.length) {
    const error = new Error('Uploaded image is empty');
    error.statusCode = 400;
    throw error;
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    const error = new Error('Image is too large after optimization. Maximum is 4 MB.');
    error.statusCode = 413;
    throw error;
  }

  return { buffer, contentType };
}

export function validatePrompt(prompt, { required = true } = {}) {
  const clean = String(prompt || '').trim().replace(/\s+/g, ' ');
  if (required && !clean) {
    const error = new Error('Prompt is required');
    error.statusCode = 400;
    throw error;
  }
  if (clean.length > 10000) {
    const error = new Error('Prompt is too long');
    error.statusCode = 400;
    throw error;
  }
  return clean;
}

export function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function clampInteger(value, min, max, fallback = 0) {
  return Math.round(clampNumber(value, min, max, fallback));
}

export async function callStabilityImage(endpoint, { image, contentType, fields }) {
  const apiKey = getStabilityApiKey();
  const form = new FormData();
  form.append('image', new Blob([image], { type: contentType }), `frameflow-input.${contentType.split('/')[1]}`);

  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    form.append(key, String(value));
  });

  const response = await fetch(`https://api.stability.ai${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'image/*',
      'stability-client-id': 'FrameFlow',
    },
    body: form,
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    let details = raw;
    try {
      const parsed = JSON.parse(raw);
      details = parsed?.message || parsed?.errors?.join(', ') || parsed?.name || raw;
    } catch {
      // Keep original response text.
    }
    const error = new Error(`Stability AI request failed (${response.status})`);
    error.statusCode = response.status === 429 ? 429 : 502;
    error.details = details || response.statusText;
    throw error;
  }

  const mimeType = response.headers.get('content-type') || 'image/png';
  const output = Buffer.from(await response.arrayBuffer());
  return {
    mimeType,
    buffer: output,
    finishReason: response.headers.get('finish-reason') || null,
    seed: response.headers.get('seed') || null,
  };
}

export function handleApiError(res, error, fallbackMessage) {
  const status = Number(error?.statusCode) || 500;
  sendError(res, status, fallbackMessage, error?.details || error?.message || String(error));
}
