import {
  ALERT_TYPES,
  ALERT_SEVERITY,
  SENSITIVE_RESOURCES,
  APPLICATION_STATUS,
  ACCESS_STATUS,
  TRUST_CONFIG,
} from '../../shared/contracts.js';

/**
 * Analyzes an access event against security detection rules.
 * Pure function: (event, app, recentEvents) -> { suspicious: boolean, findings: Array }
 *
 * @param {Object} event
 * @param {Object} app
 * @param {Array<Object>} recentEvents
 * @returns {{ suspicious: boolean, findings: Array<Object> }}
 */
export function analyzeEvent(event, app, recentEvents = []) {
  const findings = [];
  const eventTime = new Date(event.timestamp).getTime();

  // Include the current event even when callers pass only previously recorded events.
  const priorEvents = Array.isArray(recentEvents)
    ? recentEvents.filter((candidate) => !(
      candidate === event
      || (typeof event.id === 'string' && candidate.id === event.id)
    ))
    : [];
  const appEvents = [...priorEvents, event].filter(
    (candidate) => candidate.appId === app.id
      && new Date(candidate.timestamp).getTime() <= eventTime,
  );

  // R1: Excessive access (>10 requests for same resource in 60s)
  const window60s = eventTime - 60000;
  const sameResourceEvents60s = appEvents.filter(
    (e) => e.resource === event.resource && new Date(e.timestamp).getTime() >= window60s
  );

  if (sameResourceEvents60s.length > TRUST_CONFIG.EXCESSIVE_ACCESS.maxRequests) {
    findings.push({
      ruleId: 'R1',
      alertType: ALERT_TYPES.EXCESSIVE_ACCESS,
      severity: ALERT_SEVERITY.HIGH,
      resource: event.resource,
      message: `${app.name} made ${sameResourceEvents60s.length} ${event.resource} requests in 60s (limit ${TRUST_CONFIG.EXCESSIVE_ACCESS.maxRequests})`,
      relatedEventIds: sameResourceEvents60s.map((e) => e.id),
    });
  }

  // R3 takes precedence over an individual permission state.
  if (app.status === APPLICATION_STATUS.SUSPENDED) {
    findings.push({
      ruleId: 'R3',
      alertType: ALERT_TYPES.SUSPENDED_APP_ACCESS,
      severity: ALERT_SEVERITY.MEDIUM,
      resource: event.resource,
      message: `${app.name} attempted resource access while app is suspended`,
      relatedEventIds: [event.id],
    });
  } else if (app.permissions?.[event.resource]?.enabled === false) {
    findings.push({
      ruleId: 'R2',
      alertType: ALERT_TYPES.UNAUTHORIZED_RESOURCE,
      severity: ALERT_SEVERITY.MEDIUM,
      resource: event.resource,
      message: `${app.name} attempted unauthorized access to disabled resource: ${event.resource}`,
      relatedEventIds: [event.id],
    });
  }

  // R4: Repeated restricted (>=3 denied attempts in 5 min)
  const window300s = eventTime - 300000;
  const deniedAttempts5m = appEvents.filter(
    (e) => e.status === ACCESS_STATUS.DENIED &&
      // Guard policy blocks (rate limit etc.) are not "restricted resource" attempts.
      e.denialReason !== 'rate_limit_exceeded' &&
      e.denialReason !== 'policy_violation' &&
      e.denialReason !== 'app_suspended' &&
      new Date(e.timestamp).getTime() >= window300s
  );

  if (deniedAttempts5m.length >= TRUST_CONFIG.REPEATED_RESTRICTED.attempts) {
    findings.push({
      ruleId: 'R4',
      alertType: ALERT_TYPES.REPEATED_RESTRICTED_ACCESS,
      severity: ALERT_SEVERITY.HIGH,
      resource: '*',
      message: `${app.name} made ${deniedAttempts5m.length} repeated denied access requests in 5 minutes`,
      relatedEventIds: deniedAttempts5m.map((e) => e.id),
    });
  }

  // R5: Unusual combination (>=3 distinct SENSITIVE resources requested within 30s)
  const window30s = eventTime - 30000;
  const recentEvents30s = appEvents.filter(
    (e) => new Date(e.timestamp).getTime() >= window30s && SENSITIVE_RESOURCES.includes(e.resource)
  );
  const distinctSensitive = new Set(recentEvents30s.map((e) => e.resource));

  if (distinctSensitive.size >= TRUST_CONFIG.COMBINATION.distinctSensitive) {
    findings.push({
      ruleId: 'R5',
      alertType: ALERT_TYPES.UNUSUAL_RESOURCE_COMBINATION,
      severity: ALERT_SEVERITY.HIGH,
      resource: '*',
      message: `${app.name} accessed ${distinctSensitive.size} distinct sensitive resources in 30s (${Array.from(distinctSensitive).join(', ')})`,
      relatedEventIds: recentEvents30s.map((e) => e.id),
    });
  }

  return {
    suspicious: findings.length > 0,
    findings,
  };
}

export default { analyzeEvent };