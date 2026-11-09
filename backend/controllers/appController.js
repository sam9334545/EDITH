// M2 App & Permission Controller for E.D.I.T.H.
import {
  RESOURCE_TYPES,
  APPLICATION_STATUS,
  validatePermissionPatch,
  validateStatusPatch,
  ok,
  fail,
} from '../../shared/contracts.js';
import * as permissionService from '../services/permissionService.js';

/**
 * GET /api/apps
 * Return all registered applications and their current permission states.
 */
export function getApps(req, res) {
  const statusFilter = req.query.status || null;
  if (statusFilter && !Object.values(APPLICATION_STATUS).includes(statusFilter)) {
    return res.status(400).json(fail('VALIDATION_ERROR', `Invalid status filter. Must be one of: ${Object.values(APPLICATION_STATUS).join(', ')}`));
  }

  const apps = permissionService.getAllApps(statusFilter);
  return res.status(200).json(ok(apps, 'Applications retrieved successfully'));
}

/**
 * GET /api/apps/:id
 * Return detailed information about one registered application.
 */
export function getAppById(req, res) {
  const { id } = req.params;
  const app = permissionService.getAppById(id);

  if (!app) {
    return res.status(404).json(fail('APP_NOT_FOUND', 'Application not found'));
  }

  return res.status(200).json(ok(app, 'Application retrieved successfully'));
}

/**
 * PATCH /api/apps/:id/permissions
 * Enable or disable an individual resource permission.
 */
export function updatePermission(req, res) {
  const { id } = req.params;
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length === 0) {
    return res.status(400).json(fail('VALIDATION_ERROR', 'Request body cannot be empty'));
  }

  // Strict field check: Reject unsupported fields (e.g. trustScore, status, etc.)
  const allowedKeys = ['resource', 'enabled'];
  const extraKeys = Object.keys(body).filter((k) => !allowedKeys.includes(k));
  if (extraKeys.length > 0) {
    return res.status(400).json(fail('VALIDATION_ERROR', `Unsupported fields in request body: ${extraKeys.join(', ')}`));
  }

  // Validate resource and enabled
  if (body.resource === undefined) {
    return res.status(400).json(fail('VALIDATION_ERROR', 'resource is required'));
  }
  if (!RESOURCE_TYPES.includes(body.resource)) {
    return res.status(400).json(fail('RESOURCE_INVALID', `resource must be one of: ${RESOURCE_TYPES.join(', ')}`));
  }
  if (body.enabled === undefined) {
    return res.status(400).json(fail('VALIDATION_ERROR', 'enabled is required'));
  }
  if (typeof body.enabled !== 'boolean') {
    return res.status(400).json(fail('VALIDATION_ERROR', 'enabled must be boolean'));
  }

  // Double check with shared contracts validator
  const validationError = validatePermissionPatch(body);
  if (validationError) {
    return res.status(400).json(fail('VALIDATION_ERROR', validationError));
  }

  try {
    const updatedApp = permissionService.updatePermission(id, body.resource, body.enabled);
    return res.status(200).json(ok(updatedApp, 'Permission updated successfully'));
  } catch (err) {
    if (err.code === 'APP_NOT_FOUND') {
      return res.status(404).json(fail('APP_NOT_FOUND', 'Application not found'));
    }
    if (err.code === 'RESOURCE_INVALID') {
      return res.status(400).json(fail('RESOURCE_INVALID', err.message));
    }
    return res.status(500).json(fail('INTERNAL_ERROR', 'Internal server error'));
  }
}

/**
 * PATCH /api/apps/:id/status
 * Update application status (active or suspended).
 */
export function updateStatus(req, res) {
  const { id } = req.params;
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length === 0) {
    return res.status(400).json(fail('VALIDATION_ERROR', 'Request body cannot be empty'));
  }

  // Strict field check: Only 'status' allowed
  const allowedKeys = ['status'];
  const extraKeys = Object.keys(body).filter((k) => !allowedKeys.includes(k));
  if (extraKeys.length > 0) {
    return res.status(400).json(fail('VALIDATION_ERROR', `Unsupported fields in request body: ${extraKeys.join(', ')}`));
  }

  const validationError = validateStatusPatch(body);
  if (validationError) {
    return res.status(400).json(fail('VALIDATION_ERROR', validationError));
  }

  try {
    const updatedApp = permissionService.updateAppStatus(id, body.status);
    return res.status(200).json(ok(updatedApp, 'Application status updated successfully'));
  } catch (err) {
    if (err.code === 'APP_NOT_FOUND') {
      return res.status(404).json(fail('APP_NOT_FOUND', 'Application not found'));
    }
    return res.status(500).json(fail('INTERNAL_ERROR', 'Internal server error'));
  }
}
