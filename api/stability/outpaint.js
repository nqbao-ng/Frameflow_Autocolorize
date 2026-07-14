import {
  callFrameFlowBackend,
  clampInteger,
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
    const prompt = validatePrompt(body.prompt, { required: false });
    const creativity = clampNumber(body.creativity, 0.1, 1, 0.5);
    const left = clampInteger(body.left, 0, 2000, 0);
    const right = clampInteger(body.right, 0, 2000, 0);
    const up = clampInteger(body.up, 0, 2000, 0);
    const down = clampInteger(body.down, 0, 2000, 0);

    if (left + right + up + down === 0) {
      const error = new Error('Choose at least one direction to expand');
      error.statusCode = 400;
      throw error;
    }

    const result = await callFrameFlowBackend('/v1/creative/outpaint', {
      payload: {
        image_base64: imageBase64,
        prompt: prompt || null,
        left,
        right,
        up,
        down,
        creativity,
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
    return handleApiError(res, error, 'Failed to expand scene with Stability AI on Amazon Bedrock');
  }
}
