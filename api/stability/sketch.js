import {
  callStabilityImage,
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
    const { buffer, contentType } = parseImageDataUrl(body.imageDataUrl);
    const prompt = validatePrompt(body.prompt);
    const negativePrompt = validatePrompt(body.negativePrompt, { required: false });
    const controlStrength = clampNumber(body.controlStrength, 0, 1, 0.78);

    const result = await callStabilityImage('/v2beta/stable-image/control/sketch', {
      image: buffer,
      contentType,
      fields: {
        prompt,
        negative_prompt: negativePrompt,
        control_strength: controlStrength,
        output_format: 'png',
        ...(body.seed !== undefined && body.seed !== null && body.seed !== ''
          ? { seed: Math.max(0, Math.round(Number(body.seed))) }
          : {}),
      },
    });

    return sendImage(res, result);
  } catch (error) {
    return handleApiError(res, error, 'Failed to generate sketch concept');
  }
}
