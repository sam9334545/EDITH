// M2 Permission Service for E.D.I.T.H.
// Owns app & permission state changes, access validation, and permission-related history.
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
 * @param {Object} app - Application object
 * @param {string} resource - Requested resource name
 * @returns {{ allowed: boolean, reason: 'ok' | 'app_suspended' | 'permission_disabled' | 'resource_invalid' }}
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
 * Grant a permission to an application.
 * Enables the resource, updates grantedAt to current timestamp,
 * preserves lastAccessedAt, other permissions, trustScore, and status.
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

  const now = store.clock.now();

  const updatedApp = store.updateApp(appId, (app) => {
    const currentPerm = app.permissions[resource] || {
      enabled: false,
      grantedAt: null,
      lastAccessedAt: null,
    };

    return {
      ...app,
      permissions: {
        ...app.permissions,
        [resource]: {
          ...currentPerm,
          enabled: true,
          grantedAt: now,
          // preserve lastAccessedAt
          lastAccessedAt: currentPerm.lastAccessedAt ?? null,
        },
      },
      updatedAt: now,
    };
  });

  // Record history integration
  store.addHistory({
    appId,
    eventType: ACTIVITY_EVENT_TYPES.PERMISSION_GRANTED,
    description: `${resource} permission granted`,
    metadata: { resource },
    timestamp: now,
  });

  return updatedApp;
}

/**
 * Revoke a permission from an application.
 * Disables the resource, preserves historical grantedAt,
 * preserves lastAccessedAt, other permissions, trustScore, and status.
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

  const now = store.clock.now();

  const updatedApp = store.updateApp(appId, (app) => {
    const currentPerm = app.permissions[resource] || {
      enabled: false,
      grantedAt: null,
      lastAccessedAt: null,
    };

    return {
      ...app,
      permissions: {
        ...app.permissions,
        [resource]: {
          ...currentPerm,
          enabled: false,
          // preserve historical grantedAt
          grantedAt: currentPerm.grantedAt ?? null,
          // preserve lastAccessedAt
          lastAccessedAt: currentPerm.lastAccessedAt ?? null,
        },
      },
      updatedAt: now,
    };
  });

  // Record history integration
  store.addHistory({
    appId,
    eventType: ACTIVITY_EVENT_TYPES.PERMISSION_REVOKED,
    description: `${resource} permission revoked`,
    metadata: { resource },
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
    metadata: { status: APPLICATION_STATUS.SUSPENDED },
    timestamp: now,
  });

  return updatedApp;
}

/**
 * Reactivate an application.
 * Sets status to active without modifying individual permissions.
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
    metadata: { status: APPLICATION_STATUS.ACTIVE },
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
