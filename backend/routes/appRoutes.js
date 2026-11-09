// M2 App & Permission Routes for E.D.I.T.H.
import { Router } from 'express';
import {
  getApps,
  getAppById,
  updatePermission,
  updateStatus,
} from '../controllers/appController.js';

const router = Router();

router.get('/', getApps);
router.get('/:id', getAppById);
router.patch('/:id/permissions', updatePermission);
router.patch('/:id/status', updateStatus);

export default router;