import { ok } from '../../shared/contracts.js';
import * as mongoService from '../services/mongoService.js';

export const getHistory = async (req, res) => {
  const history = await mongoService.getHistory(req.query);
  return res.status(200).json(ok(history, `Retrieved ${history.length} activity history records`));
};

export const getHistorySummary = async (req, res) => {
  const summary = await mongoService.getHistorySummary();
  return res.status(200).json(ok(summary, 'Activity history summary retrieved successfully'));
};

export default {
  getHistory,
  getHistorySummary,
};
