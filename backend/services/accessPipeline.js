import store from '../store/index.js';
import permissionService from './permissionService.js';
import eventService from './eventService.js';
import historyService from './historyService.js';
import analyzeEvent from './anomalyDetection.js';
import calculateTrustScore from './trustScore.js';
import generateRecommendations from './recommendations.js';
import {
  validateAccessPayload,
  ACTIVITY_EVENT_TYPES,
  trustLevelFor,
} from '../../shared/contracts.js';

export class AccessPipeline {
  /**
   * Orchestrates the security pipeline for a single access request.
   *
   * @param {Object} payload
   * @param {string} payload.appId
   * @param {string} payload.resource
   * @param {string} [payload.reason]
   * @param {string} [payload.timestamp]
   * @returns {Object} { event, alertsCreated, app, trustScore, recommendations }
   */
  processAccessRequest(payload) {
    // 1 & 2: Validate
    const validationError = validateAccessPayload(payload);
    if (validationError) {
      const err = new Error(validationError);
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    // 3: Find app
    const app = store.findAppById(payload.appId);
    if (!app) {
      const err = new Error(`Application with ID ${payload.appId} not found`);
      err.code = 'APP_NOT_FOUND';
      throw err;
    }

    const timestamp = payload.timestamp || store.clock.now();

    // 4 & 5 & 6: Check permission (checks suspended first, then enabled)
    const decision = permissionService.checkPermission(app, payload.resource);

    // 7: Create event (automatically emits access_allowed or access_denied history)
    const event = eventService.createEvent({
      app,
      resource: payload.resource,
      reason: payload.reason || 'Simulated request',
      timestamp,
      decision,
    });

    // 8: Analyze event with security engine
    const analysis = analyzeEvent(event, app, store.events);

    const newAlerts = [];
    const eventTime = new Date(timestamp).getTime();

    // 9: Deduplicate & create alerts
    if (analysis.findings && analysis.findings.length > 0) {
      for (const finding of analysis.findings) {
        const dedupeResource = finding.resource || '*';
        // Check if an alert with same appId, alertType, and resource exists within 300s
        const existingAlert = store.alerts.find((alt) => {
          if (alt.appId !== app.id || alt.type !== finding.alertType) {
            return false;
          }
          const altResource = alt.resource || '*';
          if (altResource !== dedupeResource) {
            return false;
          }
          const altTime = new Date(alt.timestamp).getTime();
          return Math.abs(eventTime - altTime) <= 300000;
        });

        if (existingAlert) {
          // Deduplicated: append event ID to existing alert, no new alert, no new penalty
          if (!existingAlert.relatedEventIds.includes(event.id)) {
            existingAlert.relatedEventIds.push(event.id);
          }
          event.alertId = existingAlert.id;
          event.suspicious = true;
        } else {
          // New alert created
          const alertId = store.nextId('alt');
          const alert = {
            id: alertId,
            appId: app.id,
            type: finding.alertType,
            severity: finding.severity,
            message: finding.message,
            timestamp,
            resource: dedupeResource,
            relatedEventIds: finding.relatedEventIds || [event.id],
            recommendationId: null,
            acknowledged: false,
            ruleId: finding.ruleId,
          };

          store.alerts.push(alert);
          newAlerts.push(alert);

          event.alertId = alert.id;
          event.suspicious = true;

          // Automatically record alert_created history
          historyService.recordActivity({
            appId: app.id,
            eventType: ACTIVITY_EVENT_TYPES.ALERT_CREATED,
            description: `Security alert: ${alert.message}`,
            timestamp,
            metadata: {
              alertId: alert.id,
              alertType: alert.type,
              severity: alert.severity,
              ruleId: finding.ruleId,
            },
          });
        }
      }
    }

    // 10: Calculate trust score if there are new alerts
    let trustResult = {
      previousScore: app.trustScore,
      newScore: app.trustScore,
      level: trustLevelFor(app.trustScore),
      penalty: 0,
      changeReason: 'No penalty',
      explanation: [`Current score: ${app.trustScore} (${trustLevelFor(app.trustScore)})`],
    };

    if (newAlerts.length > 0) {
      trustResult = calculateTrustScore(app, newAlerts);
      if (trustResult.newScore !== trustResult.previousScore) {
        const previousScore = app.trustScore;
        app.trustScore = trustResult.newScore;
        app.updatedAt = timestamp;

        // Record TrustScoreHistory row
        const tsId = store.nextId('ts');
        const tsRow = {
          id: tsId,
          appId: app.id,
          previousScore,
          newScore: trustResult.newScore,
          changeReason: trustResult.changeReason,
          timestamp,
          alertId: newAlerts[0]?.id || null,
          penalty: trustResult.penalty,
        };
        store.trustHistory.push(tsRow);

        // Automatically record trust_score_changed in Activity History
        historyService.recordActivity({
          appId: app.id,
          eventType: ACTIVITY_EVENT_TYPES.TRUST_SCORE_CHANGED,
          description: `Trust score changed from ${previousScore} to ${trustResult.newScore} (${trustResult.changeReason})`,
          timestamp,
          metadata: {
            previousScore,
            newScore: trustResult.newScore,
            penalty: trustResult.penalty,
            alertId: newAlerts[0]?.id || null,
            changeReason: trustResult.changeReason,
          },
        });
      }
    }

    // 11: Generate recommendations for new alerts
    const candidateRecs = generateRecommendations(
      app,
      newAlerts,
      store.recommendations,
      timestamp
    );
    const createdRecs = [];

    for (const recCandidate of candidateRecs) {
      const recId = store.nextId('rec');
      const rec = {
        id: recId,
        ...recCandidate,
      };
      store.recommendations.push(rec);
      createdRecs.push(rec);

      // Link alert to recommendation
      if (rec.alertId) {
        const relatedAlert = store.alerts.find((a) => a.id === rec.alertId);
        if (relatedAlert) {
          relatedAlert.recommendationId = rec.id;
        }
      }

      // Automatically record recommendation_created in Activity History
      historyService.recordActivity({
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

    return {
      event,
      alertsCreated: newAlerts,
      app: {
        ...app,
        trustLevel: trustLevelFor(app.trustScore),
      },
      trustScore: {
        appId: app.id,
        score: app.trustScore,
        level: trustLevelFor(app.trustScore),
        explanation: trustResult.explanation,
      },
      recommendations: createdRecs,
    };
  }
}

export const accessPipeline = new AccessPipeline();
export default accessPipeline;
