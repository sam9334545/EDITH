import { Router } from 'express';
import { ok, fail, trustLevelFor } from '../../shared/contracts.js';
import { store } from '../store/index.js';
import recommendationsRouter from './recommendations.js';

const router = Router();

// Mount recommendations sub-router under /recommendations
router.use('/recommendations', recommendationsRouter);

/**
 * GET /api/security/alerts
 * Query params: appId?, severity?, acknowledged?, limit? (default 50, max 200)
 */
router.get('/alerts', (req, res) => {
  try {
    const rawAlerts = store?.alerts || (typeof store?.getState === 'function' ? store.getState().alerts : []) || [];
    let alerts = [...rawAlerts];

    const { appId, severity, acknowledged, limit } = req.query || {};

    if (appId) {
      alerts = alerts.filter((a) => a.appId === appId);
    }

    if (severity) {
      alerts = alerts.filter((a) => a.severity === severity);
    }

    if (acknowledged !== undefined) {
      const isAck = acknowledged === 'true';
      alerts = alerts.filter((a) => Boolean(a.acknowledged) === isAck);
    }

    // Sort newest first
    alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Limit
    let parsedLimit = 50;
    if (limit !== undefined) {
      const parsed = parseInt(limit, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        parsedLimit = Math.min(parsed, 200);
      }
    }

    alerts = alerts.slice(0, parsedLimit);

    return res.json(ok(alerts));
  } catch (error) {
    return res.status(500).json(fail('INTERNAL_ERROR', error.message || 'Failed to fetch alerts'));
  }
});

/**
 * PATCH /api/security/alerts/:id/acknowledge
 * Sets acknowledged: true on the specified alert.
 */
router.patch('/alerts/:id/acknowledge', (req, res) => {
  try {
    const { id } = req.params;
    const rawAlerts = store?.alerts || (typeof store?.getState === 'function' ? store.getState().alerts : []) || [];
    const alert = rawAlerts.find((a) => a.id === id);

    if (!alert) {
      return res.status(404).json(fail('INTERNAL_ERROR', `Alert ${id} not found`));
    }

    alert.acknowledged = true;
    return res.json(ok(alert));
  } catch (error) {
    return res.status(500).json(fail('INTERNAL_ERROR', error.message || 'Failed to acknowledge alert'));
  }
});

/**
 * GET /api/security/score/:appId
 * Returns current trust score, derived level, historical records, and explanations.
 */
router.get('/score/:appId', (req, res) => {
  try {
    const { appId } = req.params;
    const rawApps = store?.apps || (typeof store?.getState === 'function' ? store.getState().apps : []) || [];
    const app = rawApps.find((a) => a.id === appId);

    if (!app) {
      return res.status(404).json(fail('APP_NOT_FOUND', `Application ${appId} not found`));
    }

    const rawTrustHistory = store?.trustHistory ||
      (typeof store?.getState === 'function' ? store.getState().trustHistory : []) || [];
    const appTsHistory = rawTrustHistory.filter((t) => t.appId === appId);

    const explanation = appTsHistory.length > 0
      ? appTsHistory.map((t) => t.changeReason)
      : [`Initial profile score ${app.trustScore}; no active penalties.`];

    return res.json(
      ok({
        appId: app.id,
        score: app.trustScore,
        level: trustLevelFor(app.trustScore),
        history: appTsHistory,
        explanation,
      })
    );
  } catch (error) {
    return res.status(500).json(fail('INTERNAL_ERROR', error.message || 'Failed to fetch score'));
  }
});

export default router;

