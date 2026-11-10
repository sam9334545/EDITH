import { Router } from 'express';
import { ok, fail, GUARD_DECISIONS, GUARD_MODES, validateGuardModePatch } from '../../shared/contracts.js';
import { getGuardMode, setGuardMode, getGuardDecisions } from '../services/runtimeGuard.js';

const router = Router();

/** GET /api/guard/mode -> { mode, modes } */
router.get('/mode', (req, res) => res.json(ok({ mode: getGuardMode(), modes: Object.values(GUARD_MODES) })));

/** PATCH /api/guard/mode  body { mode: monitor|protect|strict } -> { mode, previousMode, updatedAt } */
router.patch('/mode', (req, res) => {
  const body = req.body || {};
  const extra = Object.keys(body).filter((k) => k !== 'mode');
  if (extra.length > 0) {
    return res.status(400).json(fail('VALIDATION_ERROR', `Unsupported field(s): ${extra.join(', ')}`));
  }
  const error = validateGuardModePatch(body);
  if (error) return res.status(400).json(fail('VALIDATION_ERROR', error));
  try {
    return res.json(ok(setGuardMode(body.mode), `Guard mode set to ${body.mode}`));
  } catch (err) {
    return res.status(400).json(fail(err.code || 'VALIDATION_ERROR', err.message));
  }
});

/** GET /api/guard/decisions?appId&decision=ALLOW|BLOCK&limit (default 50, max 200), newest first */
router.get('/decisions', (req, res) => {
  const { appId, decision, limit } = req.query || {};
  if (decision !== undefined && !Object.values(GUARD_DECISIONS).includes(decision)) {
    return res.status(400).json(fail('VALIDATION_ERROR', `decision must be one of ${Object.values(GUARD_DECISIONS).join(', ')}`));
  }
  let parsedLimit = 50;
  if (limit !== undefined) {
    if (!/^\d+$/.test(String(limit)) || Number(limit) < 1 || Number(limit) > 200) {
      return res.status(400).json(fail('VALIDATION_ERROR', 'limit must be an integer between 1 and 200'));
    }
    parsedLimit = Number(limit);
  }
  return res.json(ok(getGuardDecisions({ appId, decision, limit: parsedLimit })));
});

export default router;