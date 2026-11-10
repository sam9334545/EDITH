import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  getAlerts,
  getScore,
  getRecommendations,
  applyRecommendation,
  acknowledgeAlert,
} from '../controllers/securityController.js';

const router = Router();

// Trust score view specific route (from main)
router.get('/score/:appId', asyncHandler(getScore));

// General controller security routes (from HEAD)
router.get('/alerts', asyncHandler(getAlerts));
router.get('/recommendations/:appId', asyncHandler(getRecommendations));
router.post('/recommendations/:id/apply', asyncHandler(applyRecommendation));
router.patch('/alerts/:id/acknowledge', asyncHandler(acknowledgeAlert));

export default router;