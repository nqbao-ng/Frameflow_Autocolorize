import { ensureMethod, sendError, sendJson } from '../../server/stability-shared.js';
import { getEntitlements, getSupabaseAdmin, requireUser } from '../../server/account-shared.js';

export const config = { maxDuration: 20 };

export default async function handler(req, res) {
  if (!ensureMethod(req, res, ['GET'])) return;
  try {
    const user = await requireUser(req);
    const supabase = getSupabaseAdmin();
    const entitlements = await getEntitlements(supabase, user.id);
    return sendJson(res, 200, { ok: true, entitlements });
  } catch (error) {
    return sendError(res, Number(error?.statusCode) || 500, 'Unable to load account entitlements', error?.details || error?.message || String(error));
  }
}
