import { ok } from '../../shared/contracts.js';
import * as mongoService from '../services/mongoService.js';

export const getStats = async (req, res) => {
  const stats = await mongoService.getStats();
  return res.status(200).json(ok(stats, 'Dashboard stats retrieved successfully'));
};

export default { getStats };
