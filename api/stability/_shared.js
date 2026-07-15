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

export function sendImage(res, { imageBase64, mimeType, seed = null, finishReason = null, modelId = null }) {
  const buffer = Buffer.from(String(imageBase64 || ''), 'base64');
  if (!buffer.length) {
    const error = new Error('FrameFlow backend returned an empty image');
    error.statusCode = 502;
    throw error;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', mimeType || 'image/png');
  res.setHeader('Cache-Control', 'no-store');
  if (seed !== null && seed !== undefined) res.setHeader('x-stability-seed', String(seed));
  if (finishReason) res.setHeader('x-stability-finish-reason', String(finishReason));
  if (modelId) res.setHeader('x-bedrock-model-id', String(modelId));
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

export function getFrameFlowBackendConfig() {
  const baseUrl = String(process.env.FRAMEFLOW_CV_API_URL || process.env.CV_API_URL || '').trim();
  const apiKey = String(process.env.FRAMEFLOW_CV_API_KEY || process.env.CV_API_KEY || '').trim();

  if (!baseUrl) {
    const error = new Error('FRAMEFLOW_CV_API_URL is not configured in Vercel');
    error.statusCode = 503;
    throw error;
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    apiKey,
  };
}

export async function callFrameFlowBackend(path, { method = 'POST', payload } = {}) {
  const { baseUrl, apiKey } = getFrameFlowBackendConfig();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 52000);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(apiKey ? { 'x-frameflow-key': apiKey } : {}),
      },
      ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok === false) {
      const error = new Error(`FrameFlow Bedrock backend failed (${response.status})`);
      error.statusCode = response.status >= 400 && response.status < 500 ? response.status : 502;
      error.details = data?.detail || data?.details || data?.error || response.statusText;
      throw error;
    }
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('The FrameFlow creative backend took too long to respond. Please retry once or use a smaller image.');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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

  return {
    imageBase64: buffer.toString('base64'),
    contentType,
  };
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

export function handleApiError(res, error, fallbackMessage) {
  const status = Number(error?.statusCode) || 500;
  sendError(res, status, fallbackMessage, error?.details || error?.message || String(error));
}
