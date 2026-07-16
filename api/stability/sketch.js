import {
  callFrameFlowBackend,
  ensureMethod,
  handleApiError,
  parseImageDataUrl,
  readJsonBody,
  sendJson,
} from '../../server/stability-shared.js';
import { getSupabaseAdmin, recordUsageEvent, requireUser } from '../../server/account-shared.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['GET', 'POST'])) return;
  const action = String(req.query?.action || (req.method === 'GET' ? 'status' : 'generate')).toLowerCase();
  const startedAt = Date.now();
  try {
    const user = await requireUser(req);
    if (req.method === 'GET' || action === 'status') {
      const status = await callFrameFlowBackend('/v1/creative/status', { method: 'GET' });
      return sendJson(res, 200, status);
    }
    if (action !== 'analyze') {
      const disabled = new Error('Direct image generation is disabled. Use Creative Studio so credits can be reserved, jobs can be queued, and failures can be refunded safely.');
      disabled.statusCode = 410;
      throw disabled;
    }
    const body = await readJsonBody(req);
    const { imageBase64 } = parseImageDataUrl(body.imageDataUrl);
    const result = await callFrameFlowBackend('/v1/creative/analyze-sketch', {
      payload: { image_base64: imageBase64, style_hint: body.styleHint || null },
    });
    await recordUsageEvent(getSupabaseAdmin(), {
      userId: user.id,
      eventType: 'creative_sketch_analysis_included',
      resourceType: 'included_ai_assist',
      quantity: 1,
      processingSeconds: (Date.now() - startedAt) / 1000,
      visionCallCount: 1,
      modelId: result.model_id || null,
      provider: result.provider || 'amazon-bedrock',
      metadata: { style_hint: body.styleHint || null, billed_credits: 0 },
    }).catch(() => null);
    return sendJson(res, 200, { ...result, creditCost: 0, included: true });
  } catch (error) {
    return handleApiError(res, error, action === 'analyze' ? 'Failed to analyze sketch with Amazon Nova' : 'Creative generation request failed');
  }
}
