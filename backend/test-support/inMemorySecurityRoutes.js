import { Router } from 'express';
import { ok, fail, ALERT_SEVERITY, trustLevelFor } from '../../shared/contracts.js';
import { store } from '../store/index.js';
import recommendationService from '../services/recommendationService.js';
import { getTrustScoreView } from '../services/securityService.js';

const router = Router();

router.get('/alerts', (req, res) => {
  const { appId, severity, acknowledged, limit } = req.query;
  if (appId !== undefined && !appId.trim()) return res.status(400).json(fail('VALIDATION_ERROR', 'appId must be a non-empty string'));
  if (severity !== undefined && !Object.values(ALERT_SEVERITY).includes(severity)) {
    return res.status(400).json(fail('VALIDATION_ERROR', 'Invalid severity'));
  }
  if (acknowledged !== undefined && !['true', 'false'].includes(acknowledged)) {
    return res.status(400).json(fail('VALIDATION_ERROR', 'acknowledged must be true or false'));
  }
  const parsedLimit = limit === undefined ? 50 : Number(limit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 200) {
    return res.status(400).json(fail('VALIDATION_ERROR', 'limit must be an integer between 1 and 200'));
  }
  let alerts = [...store.alerts];
  if (appId !== undefined) alerts = alerts.filter((alert) => alert.appId === appId);
  if (severity !== undefined) alerts = alerts.filter((alert) => alert.severity === severity);
  if (acknowledged !== undefined) alerts = alerts.filter((alert) => alert.acknowledged === (acknowledged === 'true'));
  alerts.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp) || b.id.localeCompare(a.id));
  return res.json(ok(alerts.slice(0, parsedLimit), 'Alerts retrieved successfully'));
});

router.patch('/alerts/:id/acknowledge', (req, res) => {
  const alert = store.alerts.find((item) => item.id === req.params.id);
  if (!alert) return res.status(404).json(fail('ALERT_NOT_FOUND', `Alert ${req.params.id} not found`));
  alert.acknowledged = true;
  return res.json(ok(alert, 'Alert acknowledged successfully'));
});

router.get('/score/:appId', (req, res) => {
  const score = getTrustScoreView(req.params.appId);
  if (!score) return res.status(404).json(fail('APP_NOT_FOUND', `Application ${req.params.appId} not found`));
  const rows = store.trustHistory.filter((item) => item.appId === req.params.appId);
  const history = rows.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const deductions = history.filter((row) => row.penalty > 0)
    .map((row) => `-${row.penalty}: ${row.changeReason} (${row.alertId || row.id})`);
  const explanation = deductions.length
    ? [`Current score: ${score.score} (${trustLevelFor(score.score)})`, ...deductions]
    : [`Initial profile score ${score.score}; no penalties applied.`];
  return res.json(ok({ ...score, history, explanation }, 'Trust score retrieved successfully'));
});

router.get('/recommendations/:appId', (req, res) => {
  return res.json(ok(recommendationService.getRecommendations(req.params.appId, req.query.status)));
});

router.post('/recommendations/:id/apply', (req, res) => {
  try {
    return res.json(ok(recommendationService.applyRecommendation(req.params.id)));
  } catch (error) {
    return res.status(error.code === 'RECOMMENDATION_NOT_FOUND' ? 404 : 500)
      .json(fail(error.code || 'INTERNAL_ERROR', error.message));
  }
});

export default router;
