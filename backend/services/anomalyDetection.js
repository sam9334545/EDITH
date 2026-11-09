import {
  ALERT_TYPES,
  ALERT_SEVERITY,
  SENSITIVE_RESOURCES,
} from '../../shared/contracts.js';

/**
 * Pure anomaly detection function.
 * Evaluates an AccessEvent against the 5 security rules.
 *
 * @param {Object} event - Current AccessEvent
 * @param {Object} app - Application object
 * @param {Array<Object>} recentEvents - Recent events for this app (including current)
 * @returns {{ suspicious: boolean, findings: Array<Object> }}
 */
export function analyzeEvent(event, app, recentEvents = []) {
  const findings = [];
  const eventTime = new Date(event.timestamp).getTime();

  // Events of this app within relevant time windows up to current event
  const eventsUpToNow = recentEvents.filter(
    (e) => e.appId === app.id && new Date(e.timestamp).getTime() <= eventTime
  );

  // R1: Excessive access (> 10 requests for same resource in 60s)
  const window60s = eventsUpToNow.filter(
    (e) =>
      e.resource === event.resource &&
      eventTime - new Date(e.timestamp).getTime() <= 60000
  );
  if (window60s.length > 10) {
    findings.push({
      ruleId: 'R1',
      alertType: ALERT_TYPES.EXCESSIVE_ACCESS,
      severity: ALERT_SEVERITY.HIGH,
      message: `${app.name} made ${window60s.length} ${event.resource} requests in 60s (limit 10)`,
      resource: event.resource,
      relatedEventIds: window60s.map((e) => e.id),
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
      message: `${app.name} attempted access while suspended`,
      resource: event.resource,
      relatedEventIds: [event.id],
    });
  }

  // R4: Repeated restricted (>= 3 denied attempts due to permission_disabled in 5 min)
  const window300sDenied = eventsUpToNow.filter(
    (e) =>
      e.status === 'denied' &&
      e.denialReason === 'permission_disabled' &&
      eventTime - new Date(e.timestamp).getTime() <= 300000
  );
  if (window300sDenied.length >= 3) {
    findings.push({
      ruleId: 'R4',
      alertType: ALERT_TYPES.REPEATED_RESTRICTED_ACCESS,
      severity: ALERT_SEVERITY.HIGH,
      message: `${app.name} made ${window300sDenied.length} repeated denied requests in 5m`,
      resource: '*',
      relatedEventIds: window300sDenied.map((e) => e.id),
    });
  }

  // R5: Unusual combination (>= 3 distinct SENSITIVE resources in 30s)
  const window30s = eventsUpToNow.filter(
    (e) =>
      SENSITIVE_RESOURCES.includes(e.resource) &&
      eventTime - new Date(e.timestamp).getTime() <= 30000
  );
  const distinctSensitive = new Set(window30s.map((e) => e.resource));
  if (distinctSensitive.size >= 3) {
    findings.push({
      ruleId: 'R5',
      alertType: ALERT_TYPES.UNUSUAL_RESOURCE_COMBINATION,
      severity: ALERT_SEVERITY.HIGH,
      message: `${app.name} accessed ${distinctSensitive.size} distinct sensitive resources in 30s`,
      resource: '*',
      relatedEventIds: window30s.map((e) => e.id),
    });
  }

  return {
    suspicious: findings.length > 0,
    findings,
  };
}

export default analyzeEvent;
