import {
  callFrameFlowBackend,
  ensureMethod,
  handleApiError,
  requireUser,
  sendJson,
} from './_shared.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['GET'])) return;

  try {
    await requireUser(req);
    const status = await callFrameFlowBackend('/v1/creative/status', { method: 'GET' });
    return sendJson(res, 200, status);
  } catch (error) {
    return handleApiError(res, error, 'Unable to verify Amazon Bedrock Stability Image Services');
  }
}
