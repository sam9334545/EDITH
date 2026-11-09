import eventService from '../services/eventService.js';
import accessPipeline from '../services/accessPipeline.js';
import store from '../store/index.js';
import { ok, fail, validateAccessPayload } from '../../shared/contracts.js';

export const getEvents = (req, res) => {
  const events = eventService.getEvents(req.query);
  return res.status(200).json(ok(events, 'Events retrieved successfully'));
};

export const simulateEvents = (req, res) => {
  const payload = req.body;
  const validationError = validateAccessPayload(payload);
  if (validationError) {
    return res.status(400).json(fail('VALIDATION_ERROR', validationError));
  }

  const count = payload.count || 1;
  const startTime = payload.startTime ? new Date(payload.startTime).getTime() : Date.now();

  const generatedEvents = [];
  const allAlertsCreated = [];
  let latestApp = null;
  let latestTrustScore = null;
  const allRecommendations = [];

  let allowedCount = 0;
  let deniedCount = 0;

  try {
    for (let i = 0; i < count; i++) {
      // 2000 ms apart
      const itemTimestamp = new Date(startTime + i * 2000).toISOString();
      const result = accessPipeline.processAccessRequest({
        appId: payload.appId,
        resource: payload.resource,
        reason: payload.reason || 'Simulated request',
        timestamp: itemTimestamp,
      });

      generatedEvents.push(result.event);
      if (result.event.status === 'allowed') {
        allowedCount++;
      } else {
        deniedCount++;
      }

      if (result.alertsCreated && result.alertsCreated.length > 0) {
        allAlertsCreated.push(...result.alertsCreated);
      }

      if (result.recommendations && result.recommendations.length > 0) {
        allRecommendations.push(...result.recommendations);
      }

      latestApp = result.app;
      latestTrustScore = result.trustScore;
    }

    return res.status(200).json(
      ok(
        {
          events: generatedEvents,
          summary: {
            total: count,
            allowed: allowedCount,
            denied: deniedCount,
          },
          alertsCreated: allAlertsCreated,
          app: latestApp,
          trustScore: latestTrustScore,
          recommendations: allRecommendations,
        },
        `Simulated ${count} access requests successfully`
      )
    );
  } catch (error) {
    const code = error.code || 'INTERNAL_ERROR';
    const status = error.code === 'APP_NOT_FOUND' ? 404 : error.code === 'VALIDATION_ERROR' ? 400 : 500;
    return res.status(status).json(fail(code, error.message));
  }
};

export default {
  getEvents,
  simulateEvents,
};
