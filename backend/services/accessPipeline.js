import {
  APPLICATION_STATUS,
  ACCESS_STATUS,
  ALERT_TYPES,
  ACTIVITY_EVENT_TYPES,
  TRUST_CONFIG,
  validateAccessPayload,
  trustLevelFor,
} from '../../shared/contracts.js';
import { store } from '../store/index.js';
import { formatApp } from './permissionService.js';
import { evaluate as evaluateGuard, recordDecision } from './runtimeGuard.js';
import { createEvent } from './eventService.js';
import { analyzeEvent } from './anomalyDetection.js';
import { calculateTrustScore } from './trustScore.js';
import { generateRecommendations } from './recommendations.js';

/**
 * Access pipeline orchestrator.
 */
export function processAccessRequest(payload) {
  // 1. Validate payload
  const validationError = validateAccessPayload(payload);
  if (validationError) {
    const error = new Error(validationError);
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  // 2. Find application
  const apps = store?.apps || (typeof store?.getState === 'function' ? store.getState().apps : []);
  const app = apps.find((a) => a.id === payload.appId);
  if (!app) {
    const error = new Error(`Application ${payload.appId} not found`);
    error.code = 'APP_NOT_FOUND';
    throw error;
  }

  // 3. Runtime Guard (RASP-inspired): app -> status -> permission -> behavioural inspection ->
  //    policy evaluation -> ALLOW | BLOCK. Every request passes through here and is logged below.
  const priorEvents = store?.events || (typeof store?.getState === 'function' ? store.getState().events : []) || [];
  const guardResult = evaluateGuard({
    app,
    resource: payload.resource,
    timestamp: payload.timestamp || (store?.clock?.now ? store.clock.now() : new Date().toISOString()),
    recentEvents: priorEvents,
  });
  const decision = { allowed: guardResult.allowed, reason: guardResult.reason };
  const isAllowed = decision.allowed;
  const denialReason = isAllowed ? null : decision.reason;

  // 5. Create event (M3)
  const event = createEvent({
    app,
    resource: payload.resource,
    reason: payload.reason,
    timestamp: payload.timestamp,
    decision,
  });

  // 3b. Log the guard decision (decision log + event + access history metadata)
  const guardDecision = recordDecision({ result: guardResult, app, event });

  // If allowed, update lastAccessedAt
  if (isAllowed && app.permissions?.[payload.resource]) {
    app.permissions[payload.resource].lastAccessedAt = event.timestamp;
  }

  const allEvents = store?.events || (typeof store?.getState === 'function' ? store.getState().events : []) || [];
  const allAlerts = store?.alerts || (typeof store?.getState === 'function' ? store.getState().alerts : []) || [];
  const historyList = store?.history || (typeof store?.getState === 'function' ? store.getState().history : []) || [];
  const trustHistory = store?.trustHistory || (typeof store?.getState === 'function' ? store.getState().trustHistory : []) || [];



  // 6. Analyze event (M4 anomaly detection)
  const analysis = analyzeEvent(event, app, allEvents);

  const alertsCreated = [];
  const eventTime = new Date(event.timestamp).getTime();

  // 7. Create or deduplicate alerts
  if (analysis.suspicious && analysis.findings.length > 0) {
    for (const finding of analysis.findings) {
      const isWildcardResource =
        finding.alertType === ALERT_TYPES.REPEATED_RESTRICTED_ACCESS ||
        finding.alertType === ALERT_TYPES.UNUSUAL_RESOURCE_COMBINATION;

      const resourceKey = isWildcardResource ? '*' : (finding.resource || event.resource);

      const dedupeWindowMs = TRUST_CONFIG.DEDUPE_WINDOW_MS || 300000;
      const existingAlert = allAlerts.find(
        (a) =>
          a.appId === app.id &&
          a.type === finding.alertType &&
          (a.resource || '*') === resourceKey &&
          Math.abs(eventTime - new Date(a.timestamp).getTime()) <= dedupeWindowMs
      );

      if (existingAlert) {
        if (!existingAlert.relatedEventIds.includes(event.id)) {
          existingAlert.relatedEventIds.push(event.id);
        }
        event.alertId = existingAlert.id;
        event.suspicious = true;
      } else {
        const alertId = typeof store?.nextId === 'function'
          ? store.nextId('alt')
          : `alt_${String((allAlerts.length + 1)).padStart(4, '0')}`;

        const newAlert = {
          id: alertId,
          appId: app.id,
          type: finding.alertType,
          severity: finding.severity,
          message: finding.message,
          timestamp: event.timestamp,
          relatedEventIds: [...finding.relatedEventIds],
          recommendationId: null,
          acknowledged: false,
          resource: resourceKey,
        };

        allAlerts.push(newAlert);
        alertsCreated.push(newAlert);

        event.alertId = alertId;
        event.suspicious = true;

        const alertActId = typeof store?.nextId === 'function'
          ? store.nextId('act')
          : `act_${String((historyList.length + 1)).padStart(4, '0')}`;

        historyList.push({
          id: alertActId,
          appId: app.id,
          eventType: ACTIVITY_EVENT_TYPES.ALERT_CREATED,
          description: `Security alert: ${newAlert.type} (${newAlert.severity})`,
          timestamp: event.timestamp,
          metadata: {
            alertId: newAlert.id,
            alertType: newAlert.type,
            severity: newAlert.severity,
          },
        });
      }
    }
  }

  // 8. Calculate Trust Score
  let trustResult = calculateTrustScore(app, allEvents, alertsCreated);
  if (alertsCreated.length > 0) {
    const previousScore = app.trustScore;
    app.trustScore = trustResult.newScore;
    app.updatedAt = event.timestamp;

    const tsId = typeof store?.nextId === 'function'
      ? store.nextId('ts')
      : `ts_${String((trustHistory.length + 1)).padStart(4, '0')}`;

    const changeReason = alertsCreated
      .map((a) => `${a.severity.toUpperCase()} alert ${a.type}: -${TRUST_CONFIG.PENALTY[a.severity]}`)
      .join(', ');

    trustHistory.push({
      id: tsId,
      appId: app.id,
      previousScore,
      newScore: trustResult.newScore,
      changeReason,
      timestamp: event.timestamp,
      alertId: alertsCreated[0].id,
      penalty: trustResult.penalty,
    });

    const actTsId = typeof store?.nextId === 'function'
      ? store.nextId('act')
      : `act_${String((historyList.length + 1)).padStart(4, '0')}`;

    historyList.push({
      id: actTsId,
      appId: app.id,
      eventType: ACTIVITY_EVENT_TYPES.TRUST_SCORE_CHANGED,
      description: `Trust score changed: ${previousScore} -> ${trustResult.newScore} (-${trustResult.penalty})`,
      timestamp: event.timestamp,
      metadata: {
        previousScore,
        newScore: trustResult.newScore,
        penalty: trustResult.penalty,
      },
    });
  }

  // 9. Generate Recommendations
  let newRecommendations = [];
  if (alertsCreated.length > 0) {
    newRecommendations = generateRecommendations(app, alertsCreated, allEvents);
    for (const rec of newRecommendations) {
      const recActId = typeof store?.nextId === 'function'
        ? store.nextId('act')
        : `act_${String((historyList.length + 1)).padStart(4, '0')}`;

      historyList.push({
        id: recActId,
        appId: app.id,
        eventType: ACTIVITY_EVENT_TYPES.RECOMMENDATION_CREATED,
        description: `Recommendation: ${rec.title}`,
        timestamp: rec.createdAt,
        metadata: {
          recommendationId: rec.id,
          type: rec.type,
          suggestedAction: rec.suggestedAction,
          resource: rec.resource,
          alertId: rec.alertId,
        },
      });
    }
  }

  // 10. Return standard aggregated result
  return {
    event,
    alertsCreated,
    app: formatApp(app),
    trustScore: {
      appId: app.id,
      score: app.trustScore,
      level: trustLevelFor(app.trustScore),
      explanation: trustResult.explanation,
    },
    recommendations: newRecommendations,
    allowed: isAllowed,
    denialReason: denialReason,
    guard: guardDecision,
  };
}

export default { processAccessRequest };