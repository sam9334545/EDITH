import { Router } from 'express';
import { ok, fail } from '../../shared/contracts.js';
import { store } from '../store/index.js';
import {
  getAdaptiveTrustProfile,
  applyAdaptiveRecovery,
  checkCleanStreakRecovery,
} from '../services/adaptiveTrust.js';

const router = Router();

/**
 * GET /api/adaptive/config
 * Returns current adaptive trust configuration.
 */
router.get('/config', (req, res) => {
  const config = store.getAdaptiveConfig ? store.getAdaptiveConfig() : {};
  return res.json(ok(config));
});

/**
 * PATCH /api/adaptive/config
 * Updates configurable adaptive trust settings.
 */
router.patch('/config', (req, res) => {
  const patch = req.body || {};
  if (typeof store.updateAdaptiveConfig === 'function') {
    const updated = store.updateAdaptiveConfig(patch);
    return res.json(ok(updated, 'Adaptive trust configuration updated'));
  }
  return res.status(500).json(fail('INTERNAL_ERROR', 'Store does not support adaptive configuration update'));
});

/**
 * GET /api/adaptive/:appId
 * Detailed adaptive trust profile with multi-factor risk indicators.
 */
router.get('/:appId', (req, res) => {
  const { appId } = req.params;
  try {
    const profile = getAdaptiveTrustProfile(appId, store);
    return res.json(ok(profile));
  } catch (err) {
    const status = err.code === 'APP_NOT_FOUND' ? 404 : 400;
    return res.status(status).json(fail(err.code || 'VALIDATION_ERROR', err.message));
  }
});

/**
 * POST /api/adaptive/:appId/recover
 * Manually or programmatically triggers configurable recovery points for an application.
 * Body: { points: number, reason?: string }
 */
router.post('/:appId/recover', (req, res) => {
  const { appId } = req.params;
  const { points = 5, reason = 'Administrative recovery' } = req.body || {};

  if (!Number.isInteger(Number(points)) || Number(points) <= 0) {
    return res.status(400).json(fail('VALIDATION_ERROR', 'points must be a positive integer'));
  }

  try {
    const result = applyAdaptiveRecovery(appId, Number(points), reason, store);
    return res.json(ok(result, `Recovered ${result.pointsAwarded} trust points for ${appId}`));
  } catch (err) {
    const status = err.code === 'APP_NOT_FOUND' ? 404 : 400;
    return res.status(status).json(fail(err.code || 'VALIDATION_ERROR', err.message));
  }
});

/**
 * POST /api/adaptive/:appId/streak-check
 * Evaluates recent access events for sustained clean behavior and awards streak bonus.
 */
router.post('/:appId/streak-check', (req, res) => {
  const { appId } = req.params;
  const app = store.findAppById ? store.findAppById(appId) : store.getApp(appId);
  if (!app) {
    return res.status(404).json(fail('APP_NOT_FOUND', `Application ${appId} not found`));
  }

  const result = checkCleanStreakRecovery(appId, store.events, store);
  if (result) {
    return res.json(ok(result, 'Clean usage streak bonus awarded'));
  }
  return res.json(ok({
    appId,
    score: app.trustScore,
    streakAwarded: false,
    message: 'Clean usage streak threshold not reached yet or unpermitted requests present in window',
  }));
});

export default router;
