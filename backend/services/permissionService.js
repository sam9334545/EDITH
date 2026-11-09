// M2 Permission & Access Control Service for E.D.I.T.H.
// Owns app & permission state changes, access validation, status enforcement, and history.
import {
  RESOURCE_TYPES,
  APPLICATION_STATUS,
  ACTIVITY_EVENT_TYPES,
} from '../../shared/contracts.js';
import { store } from '../store/index.js';

/**
 * Pure function to check if an app has permission to access a resource.
 * Does not mutate the application object.
 *
 * Mandatory Decision Order:
 * 1. Validate resource type.
 * 2. If app.status === 'suspended', immediately deny with 'app_suspended'.
 * 3. If !permissions[resource].enabled, deny with 'permission_disabled'.
 * 4. Otherwise, allow with 'ok'.
 *
 * @param {Object} app - Application object
 * @param {string} resource - Requested resource name
 * @returns {{ allowed: boolean, reason: 'ok' | 'app_suspended' | 'permission_disabled' | 'resource_invalid' | 'app_not_found' }}
 */
export function checkPermission(app, resource) {
  if (!app) {
    return { allowed: false, reason: 'app_not_found' };
  }

  if (!RESOURCE_TYPES.includes(resource)) {
    return { allowed: false, reason: 'resource_invalid' };
  }

  // 1. A suspended application must always be denied before checking individual permissions
  if (app.status === APPLICATION_STATUS.SUSPENDED) {
    return { allowed: false, reason: 'app_suspended' };
  }

  // 2. Check if the specific permission exists and is enabled
  const perm = app.permissions && app.permissions[resource];
  if (!perm || !perm.enabled) {
    return { allowed: false, reason: 'permission_disabled' };
  }

  // 3. Permission is active and app is active
  return { allowed: true, reason: 'ok' };
}

/**
 * Get all registered applications, optionally filtered by status.
 *
 * @param {string} [statusFilter]
 * @returns {Array<Object>}
 */
export function getAllApps(statusFilter = null) {
  return store.getApps(statusFilter);
}

/**
 * Get an application by its unique ID.
 *
 * @param {string} id
 * @returns {Object|null}
 */
export function getAppById(id) {
  return store.getApp(id);
}

/**
 * Approve / Grant a permission for an application.
 *
 * Behaviour & Idempotency:
 * - If already enabled: preserves grantedAt, does not emit redundant history.
 * - If currently disabled: sets enabled: true, updates grantedAt to now,
 *   preserves lastAccessedAt, other permissions, trustScore, and status.
 *
 * @param {string} appId
 * @param {string} resource
 * @returns {Object} Updated application
 */
export function grantPermission(appId, resource) {
  if (!RESOURCE_TYPES.includes(resource)) {
    const err = new Error(`Resource must be one of: ${RESOURCE_TYPES.join(', ')}`);
    err.code = 'RESOURCE_INVALID';
    throw err;
  }

  const existingApp = store.getApp(appId);
  if (!existingApp) {
    const err = new Error('Application not found');
    err.code = 'APP_NOT_FOUND';
    throw err;
  }

  const currentPerm = existingApp.permissions[resource] || {
    enabled: false,
    grantedAt: null,
    lastAccessedAt: null,
  };

  // Idempotency check: if already enabled, avoid re-granting timestamp or duplicate history
  if (currentPerm.enabled) {
    return existingApp;
  }

  const now = store.clock.now();

  const updatedApp = store.updateApp(appId, (app) => ({
    ...app,
    permissions: {
      ...app.permissions,
      [resource]: {
        ...currentPerm,
        enabled: true,
        grantedAt: now,
        lastAccessedAt: currentPerm.lastAccessedAt ?? null,
      },
    },
    updatedAt: now,
  }));

  // Record history integration with structured transition metadata
  store.addHistory({
    appId,
    eventType: ACTIVITY_EVENT_TYPES.PERMISSION_GRANTED,
    description: `${resource} permission granted`,
    metadata: {
      appId,
      resource,
      previousValue: false,
      newValue: true,
    },
    timestamp: now,
  });

  return updatedApp;
}

/**
 * Restrict / Revoke a permission from an application.
 *
 * Behaviour & Idempotency:
 * - If already disabled: does nothing, preserves historical grantedAt and lastAccessedAt,
 *   does not emit redundant history.
 * - If currently enabled: sets enabled: false, preserves historical grantedAt and lastAccessedAt,
 *   preserves other permissions, trustScore, and status.
 *
 * @param {string} appId
 * @param {string} resource
 * @returns {Object} Updated application
 */
export function revokePermission(appId, resource) {
  if (!RESOURCE_TYPES.includes(resource)) {
    const err = new Error(`Resource must be one of: ${RESOURCE_TYPES.join(', ')}`);
    err.code = 'RESOURCE_INVALID';
    throw err;
  }

  const existingApp = store.getApp(appId);
  if (!existingApp) {
    const err = new Error('Application not found');
    err.code = 'APP_NOT_FOUND';
    throw err;
  }

  const currentPerm = existingApp.permissions[resource] || {
    enabled: false,
    grantedAt: null,
    lastAccessedAt: null,
  };

  // Idempotency check: if already disabled, avoid duplicate state update or history
  if (!currentPerm.enabled) {
    return existingApp;
  }

  const now = store.clock.now();

  const updatedApp = store.updateApp(appId, (app) => ({
    ...app,
    permissions: {
      ...app.permissions,
      [resource]: {
        ...currentPerm,
        enabled: false,
        grantedAt: currentPerm.grantedAt ?? null,
        lastAccessedAt: currentPerm.lastAccessedAt ?? null,
      },
    },
    updatedAt: now,
  }));

  // Record history integration with structured transition metadata
  store.addHistory({
    appId,
    eventType: ACTIVITY_EVENT_TYPES.PERMISSION_REVOKED,
    description: `${resource} permission revoked`,
    metadata: {
      appId,
      resource,
      previousValue: true,
      newValue: false,
    },
    timestamp: now,
  });

  return updatedApp;
}

/**
 * Update permission status (grant or revoke).
 *
 * @param {string} appId
 * @param {string} resource
 * @param {boolean} enabled
 * @returns {Object} Updated application
 */
export function updatePermission(appId, resource, enabled) {
  if (enabled) {
    return grantPermission(appId, resource);
  } else {
    return revokePermission(appId, resource);
  }
}

/**
 * Suspend an application.
 * Sets status to suspended without modifying individual permissions.
 *
 * Idempotency: If already suspended, returns without duplicate history.
 *
 * @param {string} appId
 * @returns {Object} Updated application
 */
export function suspendApp(appId) {
  const existingApp = store.getApp(appId);
  if (!existingApp) {
    const err = new Error('Application not found');
    err.code = 'APP_NOT_FOUND';
    throw err;
  }

  // Idempotency check: if already suspended, return existing app
  if (existingApp.status === APPLICATION_STATUS.SUSPENDED) {
    return existingApp;
  }

  const now = store.clock.now();

  const updatedApp = store.updateApp(appId, (app) => ({
    ...app,
    status: APPLICATION_STATUS.SUSPENDED,
    updatedAt: now,
  }));

  // Record history integration
  store.addHistory({
    appId,
    eventType: ACTIVITY_EVENT_TYPES.APP_SUSPENDED,
    description: `Application ${existingApp.name} suspended`,
    metadata: {
      appId,
      previousStatus: APPLICATION_STATUS.ACTIVE,
      newStatus: APPLICATION_STATUS.SUSPENDED,
    },
    timestamp: now,
  });

  return updatedApp;
}

/**
 * Reactivate an application.
 * Sets status to active without modifying individual permissions.
 *
 * Idempotency: If already active, returns without duplicate history.
 *
 * @param {string} appId
 * @returns {Object} Updated application
 */
export function reactivateApp(appId) {
  const existingApp = store.getApp(appId);
  if (!existingApp) {
    const err = new Error('Application not found');
    err.code = 'APP_NOT_FOUND';
    throw err;
  }

  // Idempotency check: if already active, return existing app
  if (existingApp.status === APPLICATION_STATUS.ACTIVE) {
    return existingApp;
  }

  const now = store.clock.now();

  const updatedApp = store.updateApp(appId, (app) => ({
    ...app,
    status: APPLICATION_STATUS.ACTIVE,
    updatedAt: now,
  }));

  // Record history integration
  store.addHistory({
    appId,
    eventType: ACTIVITY_EVENT_TYPES.APP_REACTIVATED,
    description: `Application ${existingApp.name} reactivated`,
    metadata: {
      appId,
      previousStatus: APPLICATION_STATUS.SUSPENDED,
      newStatus: APPLICATION_STATUS.ACTIVE,
    },
    timestamp: now,
  });

  return updatedApp;
}

/**
 * Update application status (active or suspended).
 *
 * @param {string} appId
 * @param {'active'|'suspended'} status
 * @returns {Object} Updated application
 */
export function updateAppStatus(appId, status) {
  if (status === APPLICATION_STATUS.SUSPENDED) {
    return suspendApp(appId);
  } else if (status === APPLICATION_STATUS.ACTIVE) {
    return reactivateApp(appId);
  } else {
    const err = new Error(`Status must be one of: ${Object.values(APPLICATION_STATUS).join(', ')}`);
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
}
