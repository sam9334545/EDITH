import { Router } from 'express';
import {
  ok,
  fail,
  validatePermissionPatch,
  validateStatusPatch,
} from '../../shared/contracts.js';
import { store } from '../store/index.js';
import {
  formatApp,
  updatePermission,
  updateStatus,
} from '../services/permissionService.js';

const router = Router();

/**
 * GET /api/apps
 * Query: status? ('active' | 'suspended')
 * Returns list of applications with derived trustLevel.
 */
router.get('/', (req, res) => {
  try {
    const rawApps = store?.apps || (typeof store?.getState === 'function' ? store.getState().apps : []) || [];
    let apps = [...rawApps];

    const { status } = req.query || {};
    if (status) {
      apps = apps.filter((a) => a.status === status);
    }

    const formatted = apps.map(formatApp);
    return res.json(ok(formatted));
  } catch (error) {
    return res.status(500).json(fail('INTERNAL_ERROR', error.message || 'Failed to fetch applications'));
  }
});

/**
 * GET /api/apps/:id
 * Returns a single application by ID with derived trustLevel.
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const rawApps = store?.apps || (typeof store?.getState === 'function' ? store.getState().apps : []) || [];
    const app = rawApps.find((a) => a.id === id);

    if (!app) {
      return res.status(404).json(fail('APP_NOT_FOUND', `Application ${id} not found`));
    }

    return res.json(ok(formatApp(app)));
  } catch (error) {
    return res.status(500).json(fail('INTERNAL_ERROR', error.message || 'Failed to fetch application'));
  }
});

/**
 * PATCH /api/apps/:id/permissions
 * Body: { resource: string, enabled: boolean }
 */
router.patch('/:id/permissions', (req, res) => {
  try {
    const { id } = req.params;
    const validationError = validatePermissionPatch(req.body);
    if (validationError) {
      return res.status(400).json(fail('VALIDATION_ERROR', validationError));
    }

    const { resource, enabled } = req.body;
    const updated = updatePermission(id, resource, enabled);
    return res.json(ok(updated));
  } catch (error) {
    if (error.code === 'APP_NOT_FOUND') {
      return res.status(404).json(fail('APP_NOT_FOUND', error.message));
    }
    if (error.code === 'RESOURCE_INVALID' || error.code === 'VALIDATION_ERROR') {
      return res.status(400).json(fail(error.code, error.message));
    }
    return res.status(500).json(fail('INTERNAL_ERROR', error.message || 'Failed to update permission'));
  }
});

/**
 * PATCH /api/apps/:id/status
 * Body: { status: 'active' | 'suspended' }
 */
router.patch('/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const validationError = validateStatusPatch(req.body);
    if (validationError) {
      return res.status(400).json(fail('VALIDATION_ERROR', validationError));
    }

    const { status } = req.body;
    const updated = updateStatus(id, status);
    return res.json(ok(updated));
  } catch (error) {
    if (error.code === 'APP_NOT_FOUND') {
      return res.status(404).json(fail('APP_NOT_FOUND', error.message));
    }
    if (error.code === 'VALIDATION_ERROR') {
      return res.status(400).json(fail(error.code, error.message));
    }
    return res.status(500).json(fail('INTERNAL_ERROR', error.message || 'Failed to update status'));
  }
});

export default router;

