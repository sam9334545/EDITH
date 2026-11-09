import { Router } from 'express';
import { ok, fail } from '../../shared/contracts.js';
import { store } from '../store/index.js';

const router = Router();

/**
 * GET /api/history
 * Query params: appId?, type?, limit? (default 100)
 * Returns activity history sorted newest first.
 */
router.get('/', (req, res) => {
  try {
    const rawHistory = store?.history || (typeof store?.getState === 'function' ? store.getState().history : []) || [];
    let history = [...rawHistory];

    const { appId, type, limit } = req.query || {};

    if (appId) {
      history = history.filter((h) => h.appId === appId);
    }

    if (type) {
      history = history.filter((h) => h.eventType === type);
    }

    // Sort newest first
    history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply limit
    let parsedLimit = 100;
    if (limit !== undefined) {
      const parsed = parseInt(limit, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        parsedLimit = Math.min(parsed, 500);
      }
    }

    history = history.slice(0, parsedLimit);

    return res.json(ok(history));
  } catch (error) {
    return res.status(500).json(fail('INTERNAL_ERROR', error.message || 'Failed to fetch history'));
  }
});

export default router;

