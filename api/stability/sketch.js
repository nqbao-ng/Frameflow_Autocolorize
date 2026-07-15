import {
  callFrameFlowBackend,
  clampNumber,
  ensureMethod,
  handleApiError,
  parseImageDataUrl,
  readJsonBody,
  requireUser,
  sendImage,
  sendJson,
  validatePrompt,
} from '../../server/stability-shared.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['GET', 'POST'])) return;

  const action = String(req.query?.action || (req.method === 'GET' ? 'status' : 'generate')).toLowerCase();

  try {
    await requireUser(req);

    if (req.method === 'GET' || action === 'status') {
      const status = await callFrameFlowBackend('/v1/creative/status', { method: 'GET' });
      return sendJson(res, 200, status);
    }

    const body = await readJsonBody(req);
    const { imageBase64 } = parseImageDataUrl(body.imageDataUrl);

    if (action === 'analyze') {
      const result = await callFrameFlowBackend('/v1/creative/analyze-sketch', {
        payload: {
          image_base64: imageBase64,
          style_hint: body.styleHint || null,
        },
      });
      return sendJson(res, 200, result);
    }

    const prompt = validatePrompt(body.prompt);
    const negativePrompt = validatePrompt(body.negativePrompt, { required: false });
    const controlStrength = clampNumber(body.controlStrength, 0, 1, 0.78);

    const result = await callFrameFlowBackend('/v1/creative/sketch', {
      payload: {
        image_base64: imageBase64,
        prompt,
        negative_prompt: negativePrompt || null,
        control_strength: controlStrength,
        style_preset: body.stylePreset || null,
        seed: body.seed !== undefined && body.seed !== null && body.seed !== ''
          ? Math.max(0, Math.round(Number(body.seed)))
          : null,
      },
    });

    return sendImage(res, {
      imageBase64: result.image_base64,
      mimeType: result.mime_type,
      seed: result.seed,
      finishReason: result.finish_reason,
      modelId: result.model_id,
    });
  } catch (error) {
    const fallback = action === 'analyze'
      ? 'Failed to analyze sketch with Amazon Nova'
      : action === 'status'
        ? 'Unable to verify Amazon Bedrock Stability Image Services'
        : 'Failed to generate sketch concept with Stability AI on Amazon Bedrock';
    return handleApiError(res, error, fallback);
  }
}
