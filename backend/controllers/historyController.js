import historyService from '../services/historyService.js';
import { ok } from '../../shared/contracts.js';

export const getHistory = (req, res) => {
  const result = historyService.getHistory(req.query);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.status(200).json(result);
};

export const getHistorySummary = (req, res) => {
  const summary = historyService.getSummary();
  return res.status(200).json(ok(summary, 'Activity history summary retrieved successfully'));
};

export default {
  getHistory,
  getHistorySummary,
};
