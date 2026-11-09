import { Router } from 'express';
import {
  getAlerts,
  getScore,
  getRecommendations,
  applyRecommendation,
  acknowledgeAlert,
} from '../controllers/securityController.js';

const router = Router();

router.get('/alerts', getAlerts);
router.get('/score/:appId', getScore);
router.get('/recommendations/:appId', getRecommendations);
router.post('/recommendations/:id/apply', applyRecommendation);
router.patch('/alerts/:id/acknowledge', acknowledgeAlert);

export default router;
