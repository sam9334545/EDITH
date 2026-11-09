// M1 Central Access Pipeline for E.D.I.T.H.
// Orchestrates access validation, event recording, and security pipeline integration.
import {
  validateAccessPayload,
  ACCESS_STATUS,
  ACTIVITY_EVENT_TYPES,
} from '../../shared/contracts.js';
import { store } from '../store/index.js';
import { checkPermission } from './permissionService.js';
import { analyzeEvent, findDedupeAlert } from './anomalyDetection.js';

/**
 * Process a simulated access request from an application.
 *
 * Mandatory Decision Order:
 * 1. Validate payload (appId, resource).
 * 2. Retrieve latest application state from store.
 * 3. Check status: if suspended, deny immediately ('app_suspended').
 * 4. Check permission: if disabled, deny ('permission_disabled').
 * 5. If allowed: update permissions[resource].lastAccessedAt.
 * 6. Record AccessEvent in store.
 * 7. Pass into security anomaly detection pipeline.
 * 8. Return backend decision.
 *
 * @param {Object} payload - { appId, resource, reason?, count?, timestamp? }
 * @returns {Object} { event, app, allowed, denialReason, alertsCreated }
 */
export function processAccessRequest(payload) {
  // 1. Validate payload
  const error = validateAccessPayload(payload);
  if (error) {
    const err = new Error(error);
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const { appId, resource, reason = 'Simulated request', timestamp } = payload;
  const eventTime = timestamp || store.clock.now();

  // 2. Retrieve latest application state
  const app = store.getApp(appId);
  if (!app) {
    const err = new Error('Application not found');
    err.code = 'APP_NOT_FOUND';
    throw err;
  }

  // 3 & 4. Enforce Access Control decision via checkPermission
  // checkPermission checks status first, then individual permission
  const decision = checkPermission(app, resource);
  const isAllowed = decision.allowed;
  const denialReason = isAllowed ? null : decision.reason;

  // 5. Update lastAccessedAt ONLY for successful accesses
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

  // 6. Record Access Event
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

  // 7. Security Anomaly Detection Pipeline
  const recentEvents = store.getEvents({ appId });
  const analysis = analyzeEvent(accessEvent, updatedApp, recentEvents);
  const alertsCreated = [];

  if (analysis.suspicious && analysis.findings.length > 0) {
    accessEvent.suspicious = true;

    for (const finding of analysis.findings) {
      const existingAlerts = store.getAlerts({ appId });
      const dedupeAlert = findDedupeAlert(
        existingAlerts,
        appId,
        finding.alertType,
        finding.resource,
        eventTime
      );

      if (dedupeAlert) {
        // Deduplicate: append event to existing alert, no new alert
        store.updateAlert(dedupeAlert.id, (alt) => ({
          ...alt,
          relatedEventIds: [...alt.relatedEventIds, accessEvent.id],
        }));
        accessEvent.alertId = dedupeAlert.id;
      } else {
        // Create new alert
        const newAlert = store.addAlert({
          appId,
          type: finding.alertType,
          severity: finding.severity,
          message: finding.message,
          timestamp: eventTime,
          relatedEventIds: [accessEvent.id],
          resource: finding.resource,
          acknowledged: false,
        });
        accessEvent.alertId = newAlert.id;
        alertsCreated.push(newAlert);
      }
    }
  }

  // 8. Record Access Activity History
  store.addHistory({
    appId,
    eventType: isAllowed ? ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED : ACTIVITY_EVENT_TYPES.ACCESS_DENIED,
    description: `${resource} access ${isAllowed ? 'allowed' : 'denied'}${denialReason ? ` (${denialReason})` : ''}`,
    timestamp: eventTime,
    metadata: {
      appId,
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
    alertsCreated,
  };
}
