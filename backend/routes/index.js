import { Router } from 'express';
import { ok, ACCESS_STATUS } from '../../shared/contracts.js';
import { store } from '../store/index.js';
import appsRouter from './apps.js';
import eventsRouter from './events.js';
import recommendationsRouter from './recommendations.js';
import historyRouter from './history.js';
import securityRouter from './security.js';

const router = Router();

/**
 * GET /api/health
 * Returns server health status, uptime, and simulated environment indicator.
 */
router.get(['/health', '/api/health'], (req, res) => {
  return res.json(
    ok({
      status: 'ok',
      uptime: process.uptime(),
      simulated: true,
    })
  );
});

/**
 * GET /api/stats
 * Aggregate dashboard statistics.
 */
router.get('/stats', (req, res) => {
  const apps = store?.apps || (typeof store?.getState === 'function' ? store.getState().apps : []) || [];
  const events = store?.events || (typeof store?.getState === 'function' ? store.getState().events : []) || [];
  const alerts = store?.alerts || (typeof store?.getState === 'function' ? store.getState().alerts : []) || [];

  const totalApps = apps.length;
  const allowedRequests = events.filter((e) => e.status === ACCESS_STATUS.ALLOWED).length;
  const deniedRequests = events.filter((e) => e.status === ACCESS_STATUS.DENIED).length;
  const activeAlerts = alerts.filter((a) => !a.acknowledged).length;

  const totalScore = apps.reduce((sum, a) => sum + (a.trustScore || 0), 0);
  const averageTrustScore = totalApps > 0 ? Math.round(totalScore / totalApps) : 0;

  return res.json(
    ok({
      totalApps,
      allowedRequests,
      deniedRequests,
      activeAlerts,
      averageTrustScore,
    })
  );
});

/**
 * POST /api/demo/reset
 * Resets the in-memory store to initial deterministic seed data.
 */
router.post('/demo/reset', (req, res) => {
  if (typeof store.resetToSeed === 'function') {
    store.resetToSeed();
  }
  return res.json(ok({ reset: true }));
});

// Mount M2 Apps router
router.use('/apps', appsRouter);

// Mount M3 Events router
router.use('/events', eventsRouter);

// Mount M3 History router
router.use('/history', historyRouter);

// Mount M4 Security & Recommendations routers
router.use('/security/recommendations', recommendationsRouter);
router.use('/security', securityRouter);

export default router;
