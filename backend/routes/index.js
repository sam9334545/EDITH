import { Router } from 'express';
import { ok } from '../../shared/contracts.js';
import appsRouter from './apps.js';
import eventsRouter from './events.js';
import recommendationsRouter from './recommendations.js';

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

// Mount M2 Apps router
router.use('/apps', appsRouter);

// Mount M3 Events router
router.use('/events', eventsRouter);

// Mount M4 Recommendations router
router.use('/security/recommendations', recommendationsRouter);

export default router;
