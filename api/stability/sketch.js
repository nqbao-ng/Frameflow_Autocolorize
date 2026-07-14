import {
  callFrameFlowBackend,
  clampNumber,
  ensureMethod,
  handleApiError,
  parseImageDataUrl,
  readJsonBody,
  requireUser,
  sendImage,
  validatePrompt,
} from './_shared.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['POST'])) return;

  try {
    await requireUser(req);
    const body = await readJsonBody(req);
    const { imageBase64 } = parseImageDataUrl(body.imageDataUrl);
    const prompt = validatePrompt(body.prompt);
    const negativePrompt = validatePrompt(body.negativePrompt, { required: false });
    const controlStrength = clampNumber(body.controlStrength, 0, 1, 0.78);

    const result = await callFrameFlowBackend('/v1/creative/sketch', {
      payload: {
        image_base64: imageBase64,
        prompt,
        negative_prompt: negativePrompt || null,
        control_strength: controlStrength,
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
    return handleApiError(res, error, 'Failed to generate sketch concept with Stability AI on Amazon Bedrock');
  }
}
