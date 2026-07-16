import { ensureMethod, handleApiError } from '../../server/stability-shared.js';
import { requireUser } from '../../server/account-shared.js';

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['POST'])) return;
  try {
    await requireUser(req);
    const error = new Error('Direct outpaint is disabled. Create an asynchronous Creative Studio job so credits are reserved and automatically refunded if processing fails.');
    error.statusCode = 410;
    throw error;
  } catch (error) {
    return handleApiError(res, error, 'Direct outpaint is unavailable');
  }
}
