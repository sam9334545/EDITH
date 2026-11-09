import { ok, fail, isIsoTimestamp, validateAccessPayload } from '../../shared/contracts.js';
import * as mongoService from '../services/mongoService.js';

export const getEvents = async (req, res) => {
  const events = await mongoService.getEvents(req.query);
  return res.status(200).json(ok(events, 'Events retrieved successfully'));
};

export const simulateEvents = async (req, res) => {
  const payload = req.body;
  const validationError = validateAccessPayload(payload);
  if (validationError) {
    return res.status(400).json(fail('VALIDATION_ERROR', validationError));
  }

  const count = payload.count || 1;
  if (payload.startTime !== undefined && !isIsoTimestamp(payload.startTime)) {
    return res.status(400).json(fail('VALIDATION_ERROR', 'startTime must be a valid ISO 8601 timestamp'));
  }
  const startTime = payload.startTime ? new Date(payload.startTime).getTime() : Date.now();

  const generatedEvents = [];
  const allAlertsCreated = [];
  let latestApp = null;
  let latestTrustScore = null;
  const allRecommendations = [];

  let allowedCount = 0;
  let deniedCount = 0;

  for (let i = 0; i < count; i++) {
    const itemTimestamp = new Date(startTime + i * 2000).toISOString();
    const result = await mongoService.processAccessRequest({
      appId: payload.appId,
      resource: payload.resource,
      reason: payload.reason || 'Simulated request',
      timestamp: itemTimestamp,
    });

    generatedEvents.push(result.event);
    if (result.event.status === 'allowed') allowedCount++;
    else deniedCount++;

    if (result.alertsCreated.length) allAlertsCreated.push(...result.alertsCreated);
    if (result.recommendations.length) allRecommendations.push(...result.recommendations);

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
};

export default {
  getEvents,
  simulateEvents,
};
