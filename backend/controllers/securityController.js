import store from '../store/index.js';
import recommendationService from '../services/recommendationService.js';
import { ALERT_SEVERITY, ok, fail, trustLevelFor } from '../../shared/contracts.js';

const severityValues = new Set(Object.values(ALERT_SEVERITY));

function invalidAlertQuery(res, message) {
  return res.status(400).json(fail('VALIDATION_ERROR', message));
}

export const getAlerts = (req, res) => {
  const { appId, severity, acknowledged, limit } = req.query;
  let alerts = [...store.alerts];

  if (appId !== undefined) {
    if (typeof appId !== 'string' || !appId.trim()) {
      return invalidAlertQuery(res, 'appId must be a non-empty string');
    }
    alerts = alerts.filter((a) => a.appId === appId);
  }
  if (severity !== undefined) {
    if (typeof severity !== 'string' || !severityValues.has(severity)) {
      return invalidAlertQuery(res, `severity must be one of ${[...severityValues].join(', ')}`);
    }
    alerts = alerts.filter((a) => a.severity === severity);
  }
  if (acknowledged !== undefined) {
    if (acknowledged !== 'true' && acknowledged !== 'false') {
      return invalidAlertQuery(res, 'acknowledged must be true or false');
    }
    const isAck = acknowledged === 'true';
    alerts = alerts.filter((a) => a.acknowledged === isAck);
  }

  alerts.sort((a, b) => {
    const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.id.localeCompare(a.id);
  });

  let parsedLimit = 50;
  if (limit !== undefined) {
    if (typeof limit !== 'string' || !/^\d+$/.test(limit)) {
      return invalidAlertQuery(res, 'limit must be an integer between 1 and 200');
    }
    parsedLimit = Number(limit);
    if (!Number.isSafeInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 200) {
      return invalidAlertQuery(res, 'limit must be an integer between 1 and 200');
    }
  }
  return res.status(200).json(ok(alerts.slice(0, parsedLimit), 'Alerts retrieved successfully'));
};

export const getScore = (req, res) => {
  const { appId } = req.params;
  const app = store.findAppById(appId);
  if (!app) {
    return res.status(404).json(fail('APP_NOT_FOUND', `Application ${appId} not found`));
  }

  const history = store.trustHistory
    .filter((th) => th.appId === appId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const deductions = history
    .filter((h) => h.penalty && h.penalty > 0)
    .map((h) => `-${h.penalty}: ${h.changeReason} (${h.alertId || h.id})`);

  const explanation = deductions.length > 0
    ? [`Current score: ${app.trustScore} (${trustLevelFor(app.trustScore)})`, ...deductions]
    : [`Initial profile score ${app.trustScore}; no penalties applied.`];

  return res.status(200).json(
    ok(
      {
        appId: app.id,
        score: app.trustScore,
        level: trustLevelFor(app.trustScore),
        history,
        explanation,
      },
      'Trust score retrieved successfully'
    )
  );
};

export const getRecommendations = (req, res) => {
  const { appId } = req.params;
  const { status } = req.query;

  const recs = recommendationService.getRecommendations(appId, status);
  return res.status(200).json(ok(recs, 'Recommendations retrieved successfully'));
};

export const applyRecommendation = (req, res) => {
  const { id } = req.params;
  try {
    const result = recommendationService.applyRecommendation(id);
    return res.status(200).json(ok(result, 'Recommendation applied successfully'));
  } catch (error) {
    const code = error.code || 'INTERNAL_ERROR';
    const status = error.code === 'RECOMMENDATION_NOT_FOUND' ? 404 : 500;
    return res.status(status).json(fail(code, error.message));
  }
};

export const acknowledgeAlert = (req, res) => {
  const { id } = req.params;
  const alert = store.alerts.find((a) => a.id === id);
  if (!alert) {
    return res.status(404).json(fail('ALERT_NOT_FOUND', `Alert ${id} not found`));
  }
  alert.acknowledged = true;
  return res.status(200).json(ok(alert, 'Alert acknowledged successfully'));
};

export default {
  getAlerts,
  getScore,
  getRecommendations,
  applyRecommendation,
  acknowledgeAlert,
};
