import {
  APPLICATION_STATUS,
  ALERT_SEVERITY,
  ALERT_TYPES,
  ACCESS_STATUS,
  RESOURCE_TYPES,
  TRUST_CONFIG,
} from '../../shared/contracts.js';

const RULES = Object.freeze({
  EXCESSIVE_ACCESS: 'R1',
  UNAUTHORIZED_RESOURCE: 'R2',
  SUSPENDED_APP_ACCESS: 'R3',
  REPEATED_RESTRICTED_ACCESS: 'R4',
  UNUSUAL_RESOURCE_COMBINATION: 'R5',
});

function uniqueEvents(event, recentEvents) {
  const priorEvents = Array.isArray(recentEvents)
    ? recentEvents.filter((candidate) => !(
      typeof event.id === 'string'
      && candidate?.id === event.id
    ))
    : [];
  const events = [...priorEvents, event];
  const seenIds = new Set();
  const result = [];

  for (const candidate of events) {
    if (!candidate || candidate.appId !== event.appId) continue;
    if (typeof candidate.id === 'string') {
      if (seenIds.has(candidate.id)) continue;
      seenIds.add(candidate.id);
    } else if (candidate === event) {
      if (result.includes(event)) continue;
    }
    result.push(candidate);
  }
  return result;
}

function eventsInWindow(event, recentEvents, windowMs) {
  const referenceTime = Date.parse(event.timestamp);
  if (!Number.isFinite(referenceTime)) return [];

  return uniqueEvents(event, recentEvents).filter((candidate) => {
    const timestamp = Date.parse(candidate.timestamp);
    return Number.isFinite(timestamp)
      && timestamp >= referenceTime - windowMs
      && timestamp <= referenceTime;
  });
}

function eventIds(events, event) {
  const ids = events.map(({ id }) => id).filter((id) => typeof id === 'string');
  if (typeof event.id === 'string') ids.push(event.id);
  return [...new Set(ids)];
}

function finding(ruleId, alertType, severity, message, relatedEventIds) {
  return { ruleId, alertType, severity, message, relatedEventIds };
}

export function analyzeEvent(event, app, recentEvents = []) {
  const findings = [];
  if (!event || !app) return { suspicious: false, findings };

  const resource = event.resource;
  const recentByResource = eventsInWindow(
    event,
    recentEvents,
    TRUST_CONFIG.EXCESSIVE_ACCESS.windowMs,
  ).filter((candidate) => candidate.resource === resource);

  if (recentByResource.length > TRUST_CONFIG.EXCESSIVE_ACCESS.maxRequests) {
    findings.push(finding(
      RULES.EXCESSIVE_ACCESS,
      ALERT_TYPES.EXCESSIVE_ACCESS,
      ALERT_SEVERITY.HIGH,
      `Application ${app.name || app.id} made ${recentByResource.length} ${resource} requests in 60 seconds (limit ${TRUST_CONFIG.EXCESSIVE_ACCESS.maxRequests}).`,
      eventIds(recentByResource, event),
    ));
  }

  if (app.status === APPLICATION_STATUS.SUSPENDED) {
    findings.push(finding(
      RULES.SUSPENDED_APP_ACCESS,
      ALERT_TYPES.SUSPENDED_APP_ACCESS,
      ALERT_SEVERITY.MEDIUM,
      `Suspended application ${app.name || app.id} attempted to access ${resource}.`,
      eventIds([event], event),
    ));
  } else if (app.permissions?.[resource]?.enabled === false) {
    findings.push(finding(
      RULES.UNAUTHORIZED_RESOURCE,
      ALERT_TYPES.UNAUTHORIZED_RESOURCE,
      ALERT_SEVERITY.MEDIUM,
      `Application ${app.name || app.id} attempted to access ${resource} while its permission is disabled.`,
      eventIds([event], event),
    ));
  }

  const restrictedEvents = eventsInWindow(
    event,
    recentEvents,
    TRUST_CONFIG.REPEATED_RESTRICTED.windowMs,
  ).filter((candidate) => candidate.status === ACCESS_STATUS.DENIED
    && candidate.denialReason === 'permission_disabled');

  if (restrictedEvents.length >= TRUST_CONFIG.REPEATED_RESTRICTED.attempts) {
    findings.push(finding(
      RULES.REPEATED_RESTRICTED_ACCESS,
      ALERT_TYPES.REPEATED_RESTRICTED_ACCESS,
      ALERT_SEVERITY.HIGH,
      `Application ${app.name || app.id} made ${restrictedEvents.length} permission-disabled requests in 5 minutes.`,
      eventIds(restrictedEvents, event),
    ));
  }

  const sensitiveResources = new Set(RESOURCE_TYPES.filter((item) => item !== 'files'));
  const combinationEvents = eventsInWindow(
    event,
    recentEvents,
    TRUST_CONFIG.COMBINATION.windowMs,
  ).filter((candidate) => sensitiveResources.has(candidate.resource));
  const distinctSensitiveResources = new Set(combinationEvents.map(({ resource: item }) => item));

  if (distinctSensitiveResources.size >= TRUST_CONFIG.COMBINATION.distinctSensitive) {
    findings.push(finding(
      RULES.UNUSUAL_RESOURCE_COMBINATION,
      ALERT_TYPES.UNUSUAL_RESOURCE_COMBINATION,
      ALERT_SEVERITY.HIGH,
      `Application ${app.name || app.id} requested ${distinctSensitiveResources.size} distinct sensitive resources in 30 seconds.`,
      eventIds(combinationEvents, event),
    ));
  }

  return { suspicious: findings.length > 0, findings };
}

export default analyzeEvent;
