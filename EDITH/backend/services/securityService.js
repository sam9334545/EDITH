import { ALERT_TYPES, TRUST_CONFIG } from '../../shared/contracts.js';
import { analyzeEvent } from './anomalyDetection.js';

const WILDCARD_RESOURCE_RULES = new Set([
  ALERT_TYPES.REPEATED_RESTRICTED_ACCESS,
  ALERT_TYPES.UNUSUAL_RESOURCE_COMBINATION,
]);

function dedupeResource(type, event) {
  return WILDCARD_RESOURCE_RULES.has(type) ? '*' : event.resource;
}

function relatedResource(alert, events) {
  for (const eventId of alert.relatedEventIds || []) {
    const relatedEvent = events.find((event) => event.id === eventId);
    if (relatedEvent) return relatedEvent.resource;
  }
  return null;
}

function findDuplicateAlert(alerts, events, event, type, resource, nowMs) {
  return alerts.find((alert) => {
    if (alert.appId !== event.appId || alert.type !== type) return false;
    if (resource !== '*' && relatedResource(alert, events) !== resource) return false;
    const alertTime = Date.parse(alert.timestamp);
    const age = nowMs - alertTime;
    return Number.isFinite(alertTime) && age >= 0 && age <= TRUST_CONFIG.DEDUPE_WINDOW_MS;
  });
}

function appendUnique(target, ids) {
  for (const id of ids) {
    if (typeof id === 'string' && !target.includes(id)) target.push(id);
  }
}

export function processSecurityEvent(event, app, recentEvents, { store, clock }) {
  if (!store || typeof store.getState !== 'function' || typeof store.nextId !== 'function') {
    throw new TypeError('store must provide getState() and nextId(prefix)');
  }
  if (!clock || typeof clock.now !== 'function') {
    throw new TypeError('clock must provide now()');
  }

  const analysis = analyzeEvent(event, app, recentEvents);
  const alertsCreated = [];
  const alertsMerged = [];
  if (!analysis.suspicious) {
    return { ...analysis, alertsCreated, alertsMerged };
  }

  const state = store.getState();
  const alerts = state.alerts;
  const events = state.events;
  if (!Array.isArray(alerts) || !Array.isArray(events)) {
    throw new TypeError('store state must provide alerts and events arrays');
  }

  const now = clock.now();
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) throw new TypeError('clock.now() must return a valid timestamp');

  for (const item of analysis.findings) {
    const resource = dedupeResource(item.alertType, event);
    const duplicate = findDuplicateAlert(
      alerts,
      events,
      event,
      item.alertType,
      resource,
      nowMs,
    );

    if (duplicate) {
      if (typeof event.id === 'string') appendUnique(duplicate.relatedEventIds, [event.id]);
      alertsMerged.push(duplicate);
      if (event.alertId == null) event.alertId = duplicate.id;
    } else {
      const relatedEventIds = [];
      appendUnique(relatedEventIds, item.relatedEventIds);
      if (typeof event.id === 'string') appendUnique(relatedEventIds, [event.id]);

      const alert = {
        id: store.nextId('alt'),
        appId: event.appId,
        type: item.alertType,
        severity: item.severity,
        message: item.message,
        timestamp: now,
        relatedEventIds,
        recommendationId: null,
        acknowledged: false,
      };
      alerts.push(alert);
      alertsCreated.push(alert);
      if (event.alertId == null) event.alertId = alert.id;
    }
  }

  event.suspicious = true;
  return { ...analysis, alertsCreated, alertsMerged };
}

export function listAlerts(store, filters = {}) {
  const alerts = store.getState().alerts;
  return alerts
    .map((alert, index) => ({ alert, index }))
    .filter(({ alert }) => filters.appId === undefined || alert.appId === filters.appId)
    .filter(({ alert }) => filters.severity === undefined || alert.severity === filters.severity)
    .filter(({ alert }) => filters.acknowledged === undefined || alert.acknowledged === filters.acknowledged)
    .sort((left, right) => {
      const difference = Date.parse(right.alert.timestamp) - Date.parse(left.alert.timestamp);
      return Number.isNaN(difference) || difference === 0
        ? left.index - right.index
        : difference;
    })
    .slice(0, filters.limit ?? 50)
    .map(({ alert }) => alert);
}

export function acknowledgeAlert(store, alertId) {
  const alert = store.getState().alerts.find(({ id }) => id === alertId);
  if (!alert) return null;
  alert.acknowledged = true;
  return alert;
}
