import { Router } from 'express';
import { ok, fail } from '../../shared/contracts.js';
import { store } from '../store/index.js';
import { applyRecommendation } from '../services/permissionService.js';
import { raspParamGuard } from '../middleware/raspMiddleware.js';

const router = Router();

// Route parameter RASP inspection guard
if (typeof raspParamGuard === 'function') {
  router.param('appId', raspParamGuard);
  router.param('id', raspParamGuard);
}

/**
 * Controller: GET recommendations for an application.
 * Query params: status? ('pending' | 'applied' | 'dismissed')
 */
export async function getRecommendations(req, res) {
  try {
    const { appId } = req.params;
    const { status } = req.query || {};

    const rawRecs = store?.recommendations ||
      (typeof store?.getState === 'function' ? store.getState().recommendations : []) || [];

    let filtered = rawRecs.filter((r) => r.appId === appId);

    if (status) {
      filtered = filtered.filter((r) => r.status === status);
    }

    // Sort newest first
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json(ok(filtered));
  } catch (error) {
    return res.status(500).json(fail('INTERNAL_ERROR', error.message || 'Failed to fetch recommendations'));
  }
}

/**
 * Controller: POST apply a recommendation by ID.
 */
export async function applyRecommendationHandler(req, res) {
  try {
    const { id } = req.params;
    const result = applyRecommendation(id);
    return res.json(ok(result));
  } catch (error) {
    if (error.code === 'RECOMMENDATION_NOT_FOUND') {
      return res.status(404).json(fail('RECOMMENDATION_NOT_FOUND', error.message));
    }
    if (error.code === 'APP_NOT_FOUND') {
      return res.status(404).json(fail('APP_NOT_FOUND', error.message));
    }
    return res.status(500).json(fail('INTERNAL_ERROR', error.message || 'Failed to apply recommendation'));
  }
}

// Support both direct mount (router.use('/recommendations', ...)) and nested mount
router.get(['/:appId', '/recommendations/:appId'], getRecommendations);
router.post(['/:id/apply', '/recommendations/:id/apply'], applyRecommendationHandler);

export { router };
export default router;
