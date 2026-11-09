import store from '../store/index.js';
import recommendationService from '../services/recommendationService.js';
import { ok, fail, trustLevelFor } from '../../shared/contracts.js';

export const getAlerts = (req, res) => {
  const { appId, severity, acknowledged, limit } = req.query;
  let alerts = [...store.alerts];

  if (appId) alerts = alerts.filter((a) => a.appId === appId);
  if (severity) alerts = alerts.filter((a) => a.severity === severity);
  if (acknowledged !== undefined) {
    const isAck = acknowledged === 'true' || acknowledged === true;
    alerts = alerts.filter((a) => a.acknowledged === isAck);
  }

  alerts.sort((a, b) => {
    const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.id.localeCompare(a.id);
  });

  const parsedLimit = limit ? Math.min(Math.max(1, parseInt(limit, 10)), 200) : 100;
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
