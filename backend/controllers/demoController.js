import store from '../store/index.js';
import { ok } from '../../shared/contracts.js';

export const resetDemo = (req, res) => {
  store.resetToSeed();
  return res.status(200).json(ok({ reset: true }, 'State reset to initial seed successfully'));
};

export default { resetDemo };
