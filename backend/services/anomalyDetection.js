// M4 Anomaly Detection Engine for E.D.I.T.H.
// Deterministic rules R1 to R5 and deduplication key generation.
import {
  ALERT_TYPES,
  ALERT_SEVERITY,
  SENSITIVE_RESOURCES,
  TRUST_CONFIG,
} from '../../shared/contracts.js';

/**
 * Pure function to analyze an event against behavioral security rules.
 *
 * @param {Object} event - Current AccessEvent
 * @param {Object} app - Application object
 * @param {Array<Object>} recentEvents - Recent events for the same app including current event
 * @returns {{ suspicious: boolean, findings: Array<Object> }}
 */
export function analyzeEvent(event, app, recentEvents = []) {
  const findings = [];
  const eventTime = new Date(event.timestamp).getTime();

  // Helper to filter events within a time window ending at the current event
  const eventsInWindow = (windowMs) =>
    recentEvents.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return t <= eventTime && t >= eventTime - windowMs;
    });

  // R1: Excessive access (> 10 requests for the same resource in 60s)
  const window60sEvents = eventsInWindow(TRUST_CONFIG.EXCESSIVE_ACCESS.windowMs);
  const sameResourceEvents = window60sEvents.filter((e) => e.resource === event.resource);
  if (sameResourceEvents.length > TRUST_CONFIG.EXCESSIVE_ACCESS.maxRequests) {
    findings.push({
      ruleId: 'R1',
      alertType: ALERT_TYPES.EXCESSIVE_ACCESS,
      severity: ALERT_SEVERITY.HIGH,
      message: `${app.name} made ${sameResourceEvents.length} ${event.resource} requests in 60s (limit ${TRUST_CONFIG.EXCESSIVE_ACCESS.maxRequests})`,
      resource: event.resource,
      relatedEventIds: [event.id],
    });
  }

  // R2: Unauthorized resource (request while permission disabled)
  if (event.status === 'denied' && event.denialReason === 'permission_disabled') {
    findings.push({
      ruleId: 'R2',
      alertType: ALERT_TYPES.UNAUTHORIZED_RESOURCE,
      severity: ALERT_SEVERITY.MEDIUM,
      message: `${app.name} attempted unauthorized access to ${event.resource} (permission disabled)`,
      resource: event.resource,
      relatedEventIds: [event.id],
    });
  }

  // R3: Suspended app (request while app suspended)
  if (event.status === 'denied' && event.denialReason === 'app_suspended') {
    findings.push({
      ruleId: 'R3',
      alertType: ALERT_TYPES.SUSPENDED_APP_ACCESS,
      severity: ALERT_SEVERITY.MEDIUM,
      message: `Suspended app ${app.name} attempted to access ${event.resource}`,
      resource: event.resource,
      relatedEventIds: [event.id],
    });
  }

  // R4: Repeated restricted (>= 3 denied attempts with permission_disabled in 5 min)
  const window300sEvents = eventsInWindow(TRUST_CONFIG.REPEATED_RESTRICTED.windowMs);
  const permissionDeniedEvents = window300sEvents.filter(
    (e) => e.status === 'denied' && e.denialReason === 'permission_disabled'
  );
  if (permissionDeniedEvents.length >= TRUST_CONFIG.REPEATED_RESTRICTED.attempts) {
    findings.push({
      ruleId: 'R4',
      alertType: ALERT_TYPES.REPEATED_RESTRICTED_ACCESS,
      severity: ALERT_SEVERITY.HIGH,
      message: `${app.name} made ${permissionDeniedEvents.length} denied access attempts in 5 minutes`,
      resource: '*',
      relatedEventIds: permissionDeniedEvents.map((e) => e.id),
    });
  }

  // R5: Unusual combination (>= 3 distinct sensitive resources in 30s)
  const window30sEvents = eventsInWindow(TRUST_CONFIG.COMBINATION.windowMs);
  const sensitiveResourcesFound = new Set(
    window30sEvents
      .filter((e) => SENSITIVE_RESOURCES.includes(e.resource))
      .map((e) => e.resource)
  );
  if (sensitiveResourcesFound.size >= TRUST_CONFIG.COMBINATION.distinctSensitive) {
    findings.push({
      ruleId: 'R5',
      alertType: ALERT_TYPES.UNUSUAL_RESOURCE_COMBINATION,
      severity: ALERT_SEVERITY.HIGH,
      message: `${app.name} requested ${sensitiveResourcesFound.size} sensitive resources in 30s (${[...sensitiveResourcesFound].join(', ')})`,
      resource: '*',
      relatedEventIds: window30sEvents
        .filter((e) => SENSITIVE_RESOURCES.includes(e.resource))
        .map((e) => e.id),
    });
  }

  return {
    suspicious: findings.length > 0,
    findings,
  };
}

/**
 * Deduplication helper.
 * Dedupe key = appId|alertType|resource.
 * Returns existing alert if found within dedupe window (300s), else null.
 */
export function findDedupeAlert(existingAlerts, appId, alertType, resource, currentTimestamp) {
  const currentTime = new Date(currentTimestamp).getTime();
  const windowMs = TRUST_CONFIG.DEDUPE_WINDOW_MS;

  return existingAlerts.find((a) => {
    if (a.appId !== appId || a.type !== alertType) return false;
    const aResource = a.resource || '*';
    if (aResource !== resource) return false;
    const alertTime = new Date(a.timestamp).getTime();
    return currentTime >= alertTime && currentTime - alertTime <= windowMs;
  });
}
