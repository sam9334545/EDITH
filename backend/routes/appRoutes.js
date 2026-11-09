// M2 App & Permission Routes for E.D.I.T.H.
import { Router } from 'express';
import {
  getApps,
  getAppById,
  updatePermission,
  updateStatus,
} from '../controllers/appController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(getApps));
router.get('/:id', asyncHandler(getAppById));
router.patch('/:id/permissions', asyncHandler(updatePermission));
router.patch('/:id/status', asyncHandler(updateStatus));

export default router;