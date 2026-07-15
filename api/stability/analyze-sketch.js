import {
  callFrameFlowBackend,
  ensureMethod,
  handleApiError,
  parseImageDataUrl,
  readJsonBody,
  requireUser,
  sendJson,
} from './_shared.js';

export const config = { maxDuration: 45 };

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['POST'])) return;

  try {
    await requireUser(req);
    const body = await readJsonBody(req);
    const { imageBase64 } = parseImageDataUrl(body.imageDataUrl);

    const result = await callFrameFlowBackend('/v1/creative/analyze-sketch', {
      payload: {
        image_base64: imageBase64,
        style_hint: body.styleHint || null,
      },
    });

    return sendJson(res, 200, result);
  } catch (error) {
    return handleApiError(res, error, 'Failed to analyze sketch with Amazon Nova');
  }
}
