import { Router } from 'express';
import {
  getApps,
  getAppById,
  updateAppPermission,
  updateAppStatus,
} from '../controllers/appController.js';

const router = Router();

router.get('/', getApps);
router.get('/:id', getAppById);
router.patch('/:id/permissions', updateAppPermission);
router.patch('/:id/status', updateAppStatus);

export default router;
