import {
  ensureMethod,
  getStabilityApiKey,
  handleApiError,
  requireUser,
  sendJson,
} from './_shared.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['GET'])) return;

  try {
    await requireUser(req);
    const apiKey = getStabilityApiKey();
    const response = await fetch('https://api.stability.ai/v1/user/balance', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'stability-client-id': 'FrameFlow',
      },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(`Stability AI balance check failed (${response.status})`);
      error.statusCode = response.status === 401 ? 502 : response.status;
      error.details = data?.message || data || response.statusText;
      throw error;
    }

    return sendJson(res, 200, { ok: true, credits: Number(data?.credits ?? 0) });
  } catch (error) {
    return handleApiError(res, error, 'Unable to verify Stability AI connection');
  }
}
