import { Router } from 'express';
import { ok, fail } from '../../shared/contracts.js';
import { getTrustScoreView } from '../services/securityService.js';
import {
  getAlerts,
  getScore,
  getRecommendations,
  applyRecommendation,
  acknowledgeAlert,
} from '../controllers/securityController.js';

const router = Router();

// Trust score view specific route (from main)
router.get('/score/:appId', (req, res, next) => {
  try {
    const view = getTrustScoreView(req.params.appId);
    if (!view) return res.status(404).json(fail('APP_NOT_FOUND', 'Application not found'));
    return res.status(200).json(ok(view, 'Trust score retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

// General controller security routes (from HEAD)
router.get('/alerts', getAlerts);
router.get('/recommendations/:appId', getRecommendations);
router.post('/recommendations/:id/apply', applyRecommendation);
router.patch('/alerts/:id/acknowledge', acknowledgeAlert);

export default router;