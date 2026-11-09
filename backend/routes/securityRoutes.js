// Security routes - Trust Score endpoint (API #9). Mounted by M1 at /api/security.
import { Router } from 'express';
import { ok, fail } from '../../shared/contracts.js';
import { getTrustScoreView } from '../services/securityService.js';

const router = Router();

// GET /api/security/score/:appId -> { appId, score, level, history[], explanation[] }
router.get('/score/:appId', (req, res) => {
  try {
    const view = getTrustScoreView(req.params.appId);
    if (!view) return res.status(404).json(fail('APP_NOT_FOUND', 'Application not found'));
    return res.status(200).json(ok(view, 'Trust score retrieved successfully'));
  } catch (err) {
    return res.status(500).json(fail('INTERNAL_ERROR', err.message));
  }
});

export default router;