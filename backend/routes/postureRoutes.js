import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  acknowledgeFinding,
  getApplication,
  getApplications,
  getFinding,
  getFindings,
  getIncident,
  getIncidents,
  getOverview,
  getPolicies,
  getRuntimeEvents,
  getTrends,
  resolveFinding,
  updatePolicy,
} from '../controllers/postureController.js';

const router = Router();

router.get('/overview', asyncHandler(getOverview));
router.get('/applications', asyncHandler(getApplications));
router.get('/applications/:appId', asyncHandler(getApplication));
router.get('/findings', asyncHandler(getFindings));
router.get('/findings/:id', asyncHandler(getFinding));
router.post('/findings/:id/acknowledge', asyncHandler(acknowledgeFinding));
router.post('/findings/:id/resolve', asyncHandler(resolveFinding));
router.get('/trends', asyncHandler(getTrends));
router.get('/runtime-events', asyncHandler(getRuntimeEvents));
router.get('/incidents', asyncHandler(getIncidents));
router.get('/incidents/:id', asyncHandler(getIncident));
router.get('/policies', asyncHandler(getPolicies));
router.patch('/policies/:ruleId', asyncHandler(updatePolicy));

export default router;
