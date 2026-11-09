import {
  RESOURCE_TYPES,
  APPLICATION_STATUS,
  ACTIVITY_EVENT_TYPES,
  RECOMMENDATION_STATUS,
  SUGGESTED_ACTIONS,
  trustLevelFor,
} from '../../shared/contracts.js';
import { store } from '../store/index.js';

/**
 * Checks whether an app is allowed to access a resource.
 * Pure function: Application, resource -> { allowed: boolean, reason: 'ok' | 'app_suspended' | 'permission_disabled' }
 *
 * @param {Object} app - Application entity
 * @param {string} resource - Resource name
 * @returns {{ allowed: boolean, reason: string }}
 */
export function checkPermission(app, resource) {
  if (!resource || !RESOURCE_TYPES.includes(resource)) {
    const error = new Error(`Invalid resource: ${resource}. Must be one of: ${RESOURCE_TYPES.join(', ')}`);
    error.code = 'RESOURCE_INVALID';
    throw error;
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

/**
 * Formats an application entity with its derived trust level.
 *
 * @param {Object} app
 * @returns {Object} Application with derived trustLevel
 */
export function formatApp(app) {
  if (!app) return null;
  return {
    ...app,
    trustLevel: trustLevelFor(app.trustScore),
  };
}

/**
 * Updates an app's permission (grant or revoke).
 * Side effects: updates app.permissions[resource], app.updatedAt, adds ActivityHistory entry.
 *
 * @param {string} appId
 * @param {string} resource
 * @param {boolean} enabled
 * @returns {Object} Updated Application with derived trustLevel
 */
export function updatePermission(appId, resource, enabled) {
  if (!RESOURCE_TYPES.includes(resource)) {
    const error = new Error(`resource must be one of: ${RESOURCE_TYPES.join(', ')}`);
    error.code = 'RESOURCE_INVALID';
    throw error;
  }

  if (typeof enabled !== 'boolean') {
    const error = new Error('enabled must be a boolean');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const apps = store?.apps || (typeof store?.getState === 'function' ? store.getState().apps : []);
  const app = apps.find((a) => a.id === appId);
  if (!app) {
    const error = new Error(`Application ${appId} not found`);
    error.code = 'APP_NOT_FOUND';
    throw error;
  }

  const now = store?.clock?.now ? store.clock.now() : new Date().toISOString();

  if (!app.permissions[resource]) {
    app.permissions[resource] = { enabled: false, grantedAt: null, lastAccessedAt: null };
  }

  app.permissions[resource].enabled = enabled;
  if (enabled) {
    app.permissions[resource].grantedAt = now;
  }
  app.updatedAt = now;

  // Add ActivityHistory
  const historyList = store?.history || (typeof store?.getState === 'function' ? store.getState().history : []);
  const historyId = typeof store?.nextId === 'function'
    ? store.nextId('act')
    : `act_${String((historyList?.length || 0) + 1).padStart(4, '0')}`;

  const eventType = enabled
    ? ACTIVITY_EVENT_TYPES.PERMISSION_GRANTED
    : ACTIVITY_EVENT_TYPES.PERMISSION_REVOKED;

  const historyEntry = {
    id: historyId,
    appId: app.id,
    eventType,
    description: `${resource} permission ${enabled ? 'granted' : 'revoked'}`,
    timestamp: now,
    metadata: { resource },
  };

  if (Array.isArray(historyList)) {
    historyList.push(historyEntry);
  }

  return formatApp(app);
}

/**
 * Updates an app's lifecycle status (active or suspended).
 * Side effects: updates app.status, app.updatedAt, adds ActivityHistory entry.
 *
 * @param {string} appId
 * @param {string} status - 'active' | 'suspended'
 * @returns {Object} Updated Application with derived trustLevel
 */
export function updateStatus(appId, status) {
  if (!Object.values(APPLICATION_STATUS).includes(status)) {
    const error = new Error(`status must be one of: ${Object.values(APPLICATION_STATUS).join(', ')}`);
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const apps = store?.apps || (typeof store?.getState === 'function' ? store.getState().apps : []);
  const app = apps.find((a) => a.id === appId);
  if (!app) {
    const error = new Error(`Application ${appId} not found`);
    error.code = 'APP_NOT_FOUND';
    throw error;
  }

  const now = store?.clock?.now ? store.clock.now() : new Date().toISOString();
  app.status = status;
  app.updatedAt = now;

  // Add ActivityHistory
  const historyList = store?.history || (typeof store?.getState === 'function' ? store.getState().history : []);
  const historyId = typeof store?.nextId === 'function'
    ? store.nextId('act')
    : `act_${String((historyList?.length || 0) + 1).padStart(4, '0')}`;

  const eventType = status === APPLICATION_STATUS.SUSPENDED
    ? ACTIVITY_EVENT_TYPES.APP_SUSPENDED
    : ACTIVITY_EVENT_TYPES.APP_REACTIVATED;

  const historyEntry = {
    id: historyId,
    appId: app.id,
    eventType,
    description: `app ${status === APPLICATION_STATUS.SUSPENDED ? 'suspended' : 'reactivated'}`,
    timestamp: now,
    metadata: { status },
  };

  if (Array.isArray(historyList)) {
    historyList.push(historyEntry);
  }

  return formatApp(app);
}

/**
 * Applies a security recommendation.
 * Side effects: updates permission or status, records history, marks recommendation applied.
 *
 * @param {string} recommendationId
 * @returns {{ recommendation: Object, app: Object }}
 */
export function applyRecommendation(recommendationId) {
  const recommendations = store?.recommendations ||
    (typeof store?.getState === 'function' ? store.getState().recommendations : []) || [];
  const recommendation = recommendations.find((r) => r.id === recommendationId);

  if (!recommendation) {
    const error = new Error(`Recommendation ${recommendationId} not found`);
    error.code = 'RECOMMENDATION_NOT_FOUND';
    throw error;
  }

  const apps = store?.apps || (typeof store?.getState === 'function' ? store.getState().apps : []) || [];
  const app = apps.find((a) => a.id === recommendation.appId);

  if (!app) {
    const error = new Error(`Application ${recommendation.appId} not found`);
    error.code = 'APP_NOT_FOUND';
    throw error;
  }

  // Idempotent: If already applied, return immediately unchanged
  if (recommendation.status === RECOMMENDATION_STATUS.APPLIED) {
    return {
      recommendation,
      app: formatApp(app),
    };
  }

  const now = store?.clock?.now ? store.clock.now() : new Date().toISOString();
  const historyList = store?.history || (typeof store?.getState === 'function' ? store.getState().history : []);

  // 1. Apply suggestedAction
  if (recommendation.suggestedAction === SUGGESTED_ACTIONS.REVOKE_PERMISSION && recommendation.resource) {
    const resource = recommendation.resource;
    if (app.permissions?.[resource]) {
      app.permissions[resource].enabled = false;
    }
    app.updatedAt = now;

    // Log permission_revoked
    const historyId = typeof store?.nextId === 'function'
      ? store.nextId('act')
      : `act_${String((historyList?.length || 0) + 1).padStart(4, '0')}`;

    const historyEntry = {
      id: historyId,
      appId: app.id,
      eventType: ACTIVITY_EVENT_TYPES.PERMISSION_REVOKED,
      description: `${resource} permission revoked`,
      timestamp: now,
      metadata: { resource, recommendationId: recommendation.id },
    };

    if (Array.isArray(historyList)) {
      historyList.push(historyEntry);
    }
  } else if (recommendation.suggestedAction === SUGGESTED_ACTIONS.SUSPEND_APP) {
    app.status = APPLICATION_STATUS.SUSPENDED;
    app.updatedAt = now;

    // Log app_suspended
    const historyId = typeof store?.nextId === 'function'
      ? store.nextId('act')
      : `act_${String((historyList?.length || 0) + 1).padStart(4, '0')}`;

    const historyEntry = {
      id: historyId,
      appId: app.id,
      eventType: ACTIVITY_EVENT_TYPES.APP_SUSPENDED,
      description: 'app suspended',
      timestamp: now,
      metadata: { status: 'suspended', recommendationId: recommendation.id },
    };

    if (Array.isArray(historyList)) {
      historyList.push(historyEntry);
    }
  }

  // 2. Mark recommendation applied
  recommendation.status = RECOMMENDATION_STATUS.APPLIED;

  // 3. Log recommendation_applied
  const recHistoryId = typeof store?.nextId === 'function'
    ? store.nextId('act')
    : `act_${String((historyList?.length || 0) + 1).padStart(4, '0')}`;

  const recHistoryEntry = {
    id: recHistoryId,
    appId: app.id,
    eventType: ACTIVITY_EVENT_TYPES.RECOMMENDATION_APPLIED,
    description: `Recommendation applied: ${recommendation.title}`,
    timestamp: now,
    metadata: {
      recommendationId: recommendation.id,
      suggestedAction: recommendation.suggestedAction,
      resource: recommendation.resource,
    },
  };

  if (Array.isArray(historyList)) {
    historyList.push(recHistoryEntry);
  }

  return {
    recommendation,
    app: formatApp(app),
  };
}

export default {
  checkPermission,
  formatApp,
  updatePermission,
  updateStatus,
  applyRecommendation,
};
