// M1 Central Access Pipeline for E.D.I.T.H.
// Orchestrates access validation, event recording, and security pipeline steps.
import {
  validateAccessPayload,
  ACCESS_STATUS,
  ACTIVITY_EVENT_TYPES,
} from '../../shared/contracts.js';
import { store } from '../store/index.js';
import { checkPermission } from './permissionService.js';

/**
 * Process a simulated access request from an application.
 *
 * @param {Object} payload - { appId, resource, reason?, count?, timestamp? }
 * @returns {Object} { event, app, allowed, denialReason }
 */
export function processAccessRequest(payload) {
  // 1 & 2: Validate payload
  const error = validateAccessPayload(payload);
  if (error) {
    const err = new Error(error);
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const { appId, resource, reason = 'Simulated request', timestamp } = payload;
  const eventTime = timestamp || store.clock.now();

  // 3: Find app
  const app = store.getApp(appId);
  if (!app) {
    const err = new Error('Application not found');
    err.code = 'APP_NOT_FOUND';
    throw err;
  }

  // 4 & 5: Check permission (checkPermission checks status first, then permission)
  const decision = checkPermission(app, resource);
  const isAllowed = decision.allowed;
  const denialReason = isAllowed ? null : decision.reason;

  // 6: If allowed, update permissions[resource].lastAccessedAt
  let updatedApp = app;
  if (isAllowed) {
    updatedApp = store.updateApp(appId, (a) => ({
      ...a,
      permissions: {
        ...a.permissions,
        [resource]: {
          ...a.permissions[resource],
          lastAccessedAt: eventTime,
        },
      },
      updatedAt: eventTime,
    }));
  }

  // 7: Create access event
  const accessEvent = store.addEvent({
    appId,
    resource,
    reason,
    timestamp: eventTime,
    status: isAllowed ? ACCESS_STATUS.ALLOWED : ACCESS_STATUS.DENIED,
    suspicious: false,
    alertId: null,
    ...(denialReason ? { denialReason } : {}),
  });

  // 8: History entry
  store.addHistory({
    appId,
    eventType: isAllowed ? ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED : ACTIVITY_EVENT_TYPES.ACCESS_DENIED,
    description: `${resource} access ${isAllowed ? 'allowed' : 'denied'}${denialReason ? ` (${denialReason})` : ''}`,
    timestamp: eventTime,
    metadata: {
      resource,
      eventId: accessEvent.id,
      ...(denialReason ? { denialReason } : {}),
    },
  });

  return {
    event: accessEvent,
    app: updatedApp,
    allowed: isAllowed,
    denialReason,
  };
}
