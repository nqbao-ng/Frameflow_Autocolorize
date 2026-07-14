import {
  callStabilityImage,
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
    const { buffer, contentType } = parseImageDataUrl(body.imageDataUrl);
    const prompt = validatePrompt(body.prompt, { required: false });
    const creativity = clampNumber(body.creativity, 0, 1, 0.45);
    const left = clampInteger(body.left, 0, 2000, 0);
    const right = clampInteger(body.right, 0, 2000, 0);
    const up = clampInteger(body.up, 0, 2000, 0);
    const down = clampInteger(body.down, 0, 2000, 0);

    if (left + right + up + down === 0) {
      const error = new Error('Choose at least one direction to expand');
      error.statusCode = 400;
      throw error;
    }

    const result = await callStabilityImage('/v2beta/stable-image/edit/outpaint', {
      image: buffer,
      contentType,
      fields: {
        prompt,
        left,
        right,
        up,
        down,
        creativity,
        output_format: 'png',
        ...(body.seed !== undefined && body.seed !== null && body.seed !== ''
          ? { seed: Math.max(0, Math.round(Number(body.seed))) }
          : {}),
      },
    });

    return sendImage(res, result);
  } catch (error) {
    return handleApiError(res, error, 'Failed to expand scene');
  }
}
