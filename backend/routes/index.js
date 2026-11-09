import { Router } from 'express';
import { ok } from '../../shared/contracts.js';
import eventsRouter from './events.js';

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

// Mount M3 events router
router.use('/events', eventsRouter);

export default router;

