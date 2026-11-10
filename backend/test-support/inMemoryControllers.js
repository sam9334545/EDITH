import store from '../store/index.js';
import permissionService from '../services/permissionService.js';
import historyService from '../services/historyService.js';
import accessPipeline from '../services/accessPipeline.js';
import { validateAccessPayload, ok, fail } from '../../shared/contracts.js';

export function getHistory(req, res) {
  const result = historyService.getHistory(req.query);
  return res.status(result.success ? 200 : 400).json(result);
}

export function getHistorySummary(req, res) {
  return res.status(200).json(ok(historyService.getSummary()));
}

export function simulateEvents(req, res) {
  const payload = req.body;
  const validationError = validateAccessPayload(payload);
  if (validationError) return res.status(400).json(fail('VALIDATION_ERROR', validationError));

  const count = payload.count || 1;
  const start = payload.startTime ? Date.parse(payload.startTime) : Date.now();
  const events = [];
  const alertsCreated = [];
  let latest = null;
  let latestTrustScore = null;
  const recommendations = [];
  let allowed = 0;

  try {
    for (let index = 0; index < count; index += 1) {
      const result = accessPipeline.processAccessRequest({
        ...payload,
        timestamp: new Date(start + index * 2000).toISOString(),
      });
      events.push(result.event);
      if (result.allowed) allowed += 1;
      alertsCreated.push(...result.alertsCreated);
      recommendations.push(...result.recommendations);
      latest = result.app;
      latestTrustScore = result.trustScore;
    }
    return res.status(200).json(ok({
      events,
      summary: { total: count, allowed, denied: count - allowed },
      alertsCreated,
      app: latest,
      trustScore: latestTrustScore,
      recommendations,
    }));
  } catch (error) {
    const status = error.code === 'APP_NOT_FOUND' ? 404 : 400;
    return res.status(status).json(fail(error.code || 'INTERNAL_ERROR', error.message));
  }
}

export function updateAppPermission(req, res) {
  try {
    return res.status(200).json(ok(permissionService.updatePermission(
      req.params.id,
      req.body?.resource,
      req.body?.enabled,
    )));
  } catch (error) {
    const status = error.code === 'APP_NOT_FOUND' ? 404 : 400;
    return res.status(status).json(fail(error.code || 'INTERNAL_ERROR', error.message));
  }
}

export function updateAppStatus(req, res) {
  try {
    return res.status(200).json(ok(permissionService.updateAppStatus(req.params.id, req.body?.status)));
  } catch (error) {
    const status = error.code === 'APP_NOT_FOUND' ? 404 : 400;
    return res.status(status).json(fail(error.code || 'INTERNAL_ERROR', error.message));
  }
}

export { store };
