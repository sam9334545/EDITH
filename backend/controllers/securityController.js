import { ok, fail } from '../../shared/contracts.js';
import * as mongoService from '../services/mongoService.js';

export const getAlerts = async (req, res) => {
  const alerts = await mongoService.getAlerts(req.query);
  return res.status(200).json(ok(alerts, 'Alerts retrieved successfully'));
};

export const getScore = async (req, res) => {
  const view = await mongoService.getTrustScoreView(req.params.appId);
  if (!view) return res.status(404).json(fail('APP_NOT_FOUND', 'Application not found'));
  return res.status(200).json(ok(view, 'Trust score retrieved successfully'));
};

export const getRecommendations = async (req, res) => {
  const recs = await mongoService.getRecommendations(req.params.appId, req.query.status);
  return res.status(200).json(ok(recs, 'Recommendations retrieved successfully'));
};

export const applyRecommendation = async (req, res) => {
  const result = await mongoService.applyRecommendation(req.params.id);
  return res.status(200).json(ok(result, 'Recommendation applied successfully'));
};

export const acknowledgeAlert = async (req, res) => {
  const alert = await mongoService.acknowledgeAlert(req.params.id);
  return res.status(200).json(ok(alert, 'Alert acknowledged successfully'));
};

export default { getAlerts, getScore, getRecommendations, applyRecommendation, acknowledgeAlert };
