import {
  RESOURCE_TYPES,
  APPLICATION_STATUS,
  ACTIVITY_EVENT_TYPES,
  RECOMMENDATION_STATUS,
  SUGGESTED_ACTIONS,
  trustLevelFor,
} from '../../shared/contracts.js';
import { store } from '../store/index.js';

export function checkPermission(app, resource) {
  if (!app) {
    return { allowed: false, reason: 'app_not_found' };
  }

  if (!resource || !RESOURCE_TYPES.includes(resource)) {
    return { allowed: false, reason: 'resource_invalid' };
  }

  if (app.status === APPLICATION_STATUS.SUSPENDED) {
    return { allowed: false, reason: 'app_suspended' };
  }

  const permission = app.permissions?.[resource];
  if (!permission || !permission.enabled) {
    return { allowed: false, reason: 'permission_disabled' };
  }

  return { allowed: true, reason: 'ok' };
}

export function formatApp(app) {
  if (!app) return null;
  return {
    ...app,
    trustLevel: trustLevelFor(app.trustScore),
  };
}

export function getAllApps(statusFilter = null) {
  return store.getApps(statusFilter);
}

export function getAppById(id) {
  return store.getApp(id);
}

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

export function updatePermission(appId, resource, enabled) {
  if (typeof enabled !== 'boolean') {
    const error = new Error('enabled must be a boolean');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  if (enabled) {
    return grantPermission(appId, resource);
  } else {
    return revokePermission(appId, resource);
  }
}

export function suspendApp(appId) {
  const existingApp = store.getApp(appId);
  if (!existingApp) {
    const err = new Error('Application not found');
    err.code = 'APP_NOT_FOUND';
    throw err;
  }

  if (existingApp.status === APPLICATION_STATUS.SUSPENDED) {
    return existingApp;
  }

  const now = store.clock.now();

  const updatedApp = store.updateApp(appId, (app) => ({
    ...app,
    status: APPLICATION_STATUS.SUSPENDED,
    updatedAt: now,
  }));

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

export function reactivateApp(appId) {
  const existingApp = store.getApp(appId);
  if (!existingApp) {
    const err = new Error('Application not found');
    err.code = 'APP_NOT_FOUND';
    throw err;
  }

  if (existingApp.status === APPLICATION_STATUS.ACTIVE) {
    return existingApp;
  }

  const now = store.clock.now();

  const updatedApp = store.updateApp(appId, (app) => ({
    ...app,
    status: APPLICATION_STATUS.ACTIVE,
    updatedAt: now,
  }));

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

export function updateStatus(appId, status) {
  return updateAppStatus(appId, status);
}

export function applyRecommendation(recommendationId) {
  const recommendations = store?.recommendations ||
    (typeof store?.getState === 'function' ? store.getState().recommendations : []) || [];
  const recommendation = recommendations.find((r) => r.id === recommendationId);

  if (!recommendation) {
    const error = new Error(`Recommendation ${recommendationId} not found`);
    error.code = 'RECOMMENDATION_NOT_FOUND';
    throw error;
  }

  const app = store.getApp(recommendation.appId);
  if (!app) {
    const error = new Error(`Application ${recommendation.appId} not found`);
    error.code = 'APP_NOT_FOUND';
    throw error;
  }

  if (recommendation.status === RECOMMENDATION_STATUS.APPLIED) {
    return {
      recommendation,
      app: formatApp(app),
    };
  }

  const now = store?.clock?.now ? store.clock.now() : new Date().toISOString();

  if (recommendation.suggestedAction === SUGGESTED_ACTIONS.REVOKE_PERMISSION && recommendation.resource) {
    revokePermission(app.id, recommendation.resource);
  } else if (recommendation.suggestedAction === SUGGESTED_ACTIONS.SUSPEND_APP) {
    suspendApp(app.id);
  }

  recommendation.status = RECOMMENDATION_STATUS.APPLIED;

  store.addHistory({
    appId: app.id,
    eventType: ACTIVITY_EVENT_TYPES.RECOMMENDATION_APPLIED,
    description: `Recommendation applied: ${recommendation.title}`,
    timestamp: now,
    metadata: {
      recommendationId: recommendation.id,
      suggestedAction: recommendation.suggestedAction,
      resource: recommendation.resource,
    },
  });

  const updatedApp = store.getApp(app.id);

  return {
    recommendation,
    app: formatApp(updatedApp),
  };
}

export default {
  checkPermission,
  formatApp,
  getAllApps,
  getAppById,
  grantPermission,
  revokePermission,
  updatePermission,
  suspendApp,
  reactivateApp,
  updateAppStatus,
  updateStatus,
  applyRecommendation,
};