import applyCorrection from '../server/routes/colorization/apply-correction.js';
import cancel from '../server/routes/colorization/cancel.js';
import continueColorization from '../server/routes/colorization/continue.js';
import maskRepair from '../server/routes/colorization/mask-repair.js';
import reviewState from '../server/routes/colorization/review-state.js';
import start from '../server/routes/colorization/start.js';
import state from '../server/routes/colorization/state.js';
import visionSuggest from '../server/routes/colorization/vision-suggest.js';

const ROUTES = Object.freeze({
  'apply-correction': applyCorrection,
  cancel,
  continue: continueColorization,
  'mask-repair': maskRepair,
  'review-state': reviewState,
  start,
  state,
  'vision-suggest': visionSuggest,
});

function getAction(req) {
  const value = req.query?.action;
  if (Array.isArray(value)) return String(value[0] || '').trim().toLowerCase();
  return String(value || '').trim().toLowerCase();
}

export default async function handler(req, res) {
  const action = getAction(req);
  const route = ROUTES[action];

  if (!route) {
    res.status(404).json({
      ok: false,
      error: 'Unknown colorization action',
      supportedActions: Object.keys(ROUTES),
    });
    return;
  }

  return route(req, res);
}
