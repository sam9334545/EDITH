import { Router } from 'express';
import {
  getApps,
  getAppById,
  updatePermission,
  updateStatus,
} from '../controllers/appController.js';
import { raspParamGuard } from '../middleware/raspMiddleware.js';

const router = Router();

// Route parameter RASP inspection guard
if (typeof raspParamGuard === 'function') {
  router.param('id', raspParamGuard);
}

/**
 * GET /api/apps
 * Query: status? ('active' | 'suspended')
 * Returns list of applications with derived trustLevel.
 */
router.get('/', getApps);

/**
 * GET /api/apps/:id
 * Returns a single application by ID with derived trustLevel.
 */
router.get('/:id', getAppById);

/**
 * PATCH /api/apps/:id/permissions
 * Body: { resource: string, enabled: boolean }
 */
router.patch('/:id/permissions', updatePermission);

/**
 * PATCH /api/apps/:id/status
 * Body: { status: 'active' | 'suspended' }
 */
router.patch('/:id/status', updateStatus);

export default router;
