import { ok } from '../../shared/contracts.js';
import { resetDemoData } from '../services/mongoService.js';

export const resetDemo = async (req, res) => {
  const result = await resetDemoData();
  return res.status(200).json(ok(result, 'State reset to initial seed successfully'));
};

export default { resetDemo };
