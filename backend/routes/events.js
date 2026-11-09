import { Router } from 'express';
import {
  ok,
  fail,
  ACCESS_STATUS,
  validateAccessPayload,
  isIsoTimestamp,
} from '../../shared/contracts.js';
import { store } from '../store/index.js';
import { processAccessRequest } from '../services/accessPipeline.js';

const router = Router();

/**
 * Controller: GET /api/events
 * Query params: appId, resource, status, suspicious, limit (default 50, max 200)
 */
export async function getEvents(req, res) {
  try {
    const rawEvents = store?.events || (typeof store?.getState === 'function' ? store.getState().events : []) || [];
    let filtered = [...rawEvents];

    const { appId, resource, status, suspicious, limit } = req.query || {};

    if (appId) {
      filtered = filtered.filter((e) => e.appId === appId);
    }

    if (resource) {
      filtered = filtered.filter((e) => e.resource === resource);
    }

    if (status) {
      filtered = filtered.filter((e) => e.status === status);
    }

    if (suspicious !== undefined) {
      const isSuspicious = suspicious === 'true';
      filtered = filtered.filter((e) => Boolean(e.suspicious) === isSuspicious);
    }

    // Sort newest first
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply limit: default 50, max 200
    let parsedLimit = 50;
    if (limit !== undefined) {
      const parsed = parseInt(limit, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        parsedLimit = Math.min(parsed, 200);
      }
    }

    filtered = filtered.slice(0, parsedLimit);

    return res.json(ok(filtered));
  } catch (error) {
    return res.status(500).json(fail('INTERNAL_ERROR', error.message || 'Failed to retrieve events'));
  }
}

/**
 * Controller: POST /api/events/simulate
 * Body: { appId, resource, reason?, count?, startTime? }
 */
export async function simulateEvents(req, res) {
  try {
    const { appId, resource, reason, count: rawCount, startTime } = req.body || {};

    const count = rawCount !== undefined ? rawCount : 1;

    // Validate access payload
    const validationError = validateAccessPayload({
      appId,
      resource,
      reason,
      count,
    });
    if (validationError) {
      return res.status(400).json(fail('VALIDATION_ERROR', validationError));
    }

    if (startTime !== undefined && !isIsoTimestamp(startTime)) {
      return res.status(400).json(fail('VALIDATION_ERROR', 'startTime must be a valid ISO 8601 string'));
    }

    const requestReason = reason || 'Simulated request';
    const startMs = startTime ? new Date(startTime).getTime() : Date.now();

    const events = [];
    const alertsCreated = [];
    let latestApp = null;
    let latestTrustScore = null;
    const recommendationsMap = new Map();
    let allowedCount = 0;
    let deniedCount = 0;

    for (let i = 0; i < count; i++) {
      const iterationTimestamp = new Date(startMs + i * 2000).toISOString();
      const payload = {
        appId,
        resource,
        reason: requestReason,
        timestamp: iterationTimestamp,
      };

      const result = await processAccessRequest(payload);

      if (result.event) {
        events.push(result.event);
        if (result.event.status === ACCESS_STATUS.ALLOWED) {
          allowedCount++;
        } else {
          deniedCount++;
        }
      }

      if (Array.isArray(result.alertsCreated)) {
        for (const alert of result.alertsCreated) {
          alertsCreated.push(alert);
        }
      }

      if (result.app) {
        latestApp = result.app;
      }

      if (result.trustScore) {
        latestTrustScore = result.trustScore;
      }

      if (Array.isArray(result.recommendations)) {
        for (const rec of result.recommendations) {
          if (rec && rec.id) {
            recommendationsMap.set(rec.id, rec);
          }
        }
      }
    }

    const responseData = {
      events,
      summary: {
        total: events.length,
        allowed: allowedCount,
        denied: deniedCount,
      },
      alertsCreated,
      app: latestApp,
      trustScore: latestTrustScore,
      recommendations: Array.from(recommendationsMap.values()),
    };

    return res.json(ok(responseData));
  } catch (error) {
    if (error.code === 'APP_NOT_FOUND' || error.message?.includes('not found')) {
      return res.status(404).json(fail('APP_NOT_FOUND', error.message || `Application ${req.body?.appId} not found`));
    }
    if (error.code === 'VALIDATION_ERROR' || error.code === 'RESOURCE_INVALID') {
      return res.status(400).json(fail(error.code, error.message));
    }
    return res.status(500).json(fail('INTERNAL_ERROR', error.message || 'Simulation execution failed'));
  }
}

router.get(['/', '/events'], getEvents);
router.post(['/simulate', '/events/simulate'], simulateEvents);

export { router };
export default router;
