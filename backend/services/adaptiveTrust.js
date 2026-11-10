import {
  TRUST_CONFIG,
  ADAPTIVE_TRUST_CONFIG,
  ACTIVITY_EVENT_TYPES,
  trustLevelFor,
} from '../../shared/contracts.js';
import { store } from '../store/index.js';
import { penaltyFor } from './trustScore.js';

const clamp = (n) => Math.min(TRUST_CONFIG.MAX, Math.max(TRUST_CONFIG.MIN, n));

/**
 * Normalizes timestamp into milliseconds.
 */
function toEpochMs(timestamp) {
  const ms = new Date(timestamp).getTime();
  return Number.isNaN(ms) ? Date.now() : ms;
}

/**
 * Calculates adaptive penalties with repeated-violation escalation.
 *
 * @param {Object} params
 * @param {Object} params.app Application entity
 * @param {Array<Object>} params.newAlerts Alerts newly created for this event
 * @param {Array<Object>} [params.priorAlerts] All alerts previously recorded
 * @param {Object} [params.config] Optional adaptive config overrides
 * @returns {Object} { totalPenalty, basePenalty, escalationPenalty, items: Array }
 */
export function calculateAdaptivePenalties({
  app,
  newAlerts = [],
  priorAlerts = [],
  config = {},
}) {
  const escalationEnabled = config.escalationEnabled ?? false; // default false for strict demo backward-compatibility
  const escalationMultiplier = config.escalationMultiplier ?? ADAPTIVE_TRUST_CONFIG.REPEATED_VIOLATION.ESCALATION_MULTIPLIER;
  const escalationWindowMs = config.escalationWindowMs ?? ADAPTIVE_TRUST_CONFIG.REPEATED_VIOLATION.WINDOW_MS;

  let basePenalty = 0;
  let escalationPenalty = 0;
  const items = [];

  for (const alert of newAlerts) {
    const base = penaltyFor(alert.severity);
    basePenalty += base;

    let extra = 0;
    let isRepeated = false;

    if (escalationEnabled && alert.timestamp) {
      const alertTime = toEpochMs(alert.timestamp);
      // Check prior alerts for same app & alert type within escalation window
      const priorSameType = priorAlerts.filter(
        (a) =>
          a.appId === app.id &&
          a.type === alert.type &&
          a.id !== alert.id &&
          Math.abs(alertTime - toEpochMs(a.timestamp)) <= escalationWindowMs
      );

      if (priorSameType.length > 0) {
        isRepeated = true;
        extra = Math.max(
          Math.round(base * (escalationMultiplier - 1.0)),
          ADAPTIVE_TRUST_CONFIG.REPEATED_VIOLATION.ADDITIONAL_PENALTY
        );
        escalationPenalty += extra;
      }
    }

    const totalForAlert = base + extra;
    items.push({
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      basePenalty: base,
      escalationPenalty: extra,
      totalPenalty: totalForAlert,
      isRepeated,
      reason: isRepeated
        ? `${String(alert.severity).toUpperCase()} alert ${alert.type} (repeated): -${totalForAlert} (-${base} base, -${extra} escalation)`
        : `${String(alert.severity).toUpperCase()} alert ${alert.type}: -${base}`,
    });
  }

  return {
    totalPenalty: basePenalty + escalationPenalty,
    basePenalty,
    escalationPenalty,
    items,
  };
}

/**
 * Calculates adaptive trust score with full adjustment breakdown.
 *
 * @param {Object} app
 * @param {Array<Object>} recentEvents
 * @param {Array<Object>} newAlerts
 * @param {Object} options
 * @returns {Object}
 */
export function calculateAdaptiveTrustScore(app, recentEvents = [], newAlerts = [], options = {}) {
  const previousScore = clamp(Number.isFinite(app?.trustScore) ? Math.round(app.trustScore) : TRUST_CONFIG.MAX);
  const priorAlerts = options.priorAlerts || (store?.alerts || []);
  const config = options.config || (typeof store?.getAdaptiveConfig === 'function' ? store.getAdaptiveConfig() : {});

  const penaltyBreakdown = calculateAdaptivePenalties({
    app,
    newAlerts,
    priorAlerts,
    config,
  });

  const penalty = penaltyBreakdown.totalPenalty;
  const newScore = clamp(previousScore - penalty);

  const explanation = penaltyBreakdown.items.map((item) => `-${item.totalPenalty}: ${item.type} (${item.alertId})`);
  if (penaltyBreakdown.items.length === 0) {
    explanation.push(`No new penalties; score unchanged at ${previousScore}`);
  } else {
    explanation.push(`Score ${newScore} = ${previousScore} - ${penalty}`);
  }

  return {
    previousScore,
    newScore,
    level: trustLevelFor(newScore),
    penalty,
    breakdown: penaltyBreakdown,
    explanation,
  };
}

/**
 * Applies configurable trust score recovery for an application.
 *
 * @param {string} appId
 * @param {number} points Positive integer points to restore
 * @param {string} reason Reason description
 * @param {Object} [storeInstance]
 * @returns {Object} { app, previousScore, newScore, pointsAwarded }
 */
export function applyAdaptiveRecovery(appId, points, reason = 'Administrative recovery', storeInstance = store) {
  const app = storeInstance.findAppById ? storeInstance.findAppById(appId) : storeInstance.getApp(appId);
  if (!app) {
    const error = new Error(`Application ${appId} not found`);
    error.code = 'APP_NOT_FOUND';
    throw error;
  }

  const previousScore = app.trustScore;
  const award = Math.max(Number(points) || 0, 0);
  const newScore = clamp(previousScore + award);
  const pointsAwarded = newScore - previousScore;

  app.trustScore = newScore;
  const now = storeInstance?.clock?.now ? storeInstance.clock.now() : new Date().toISOString();
  app.updatedAt = now;

  const tsId = typeof storeInstance.nextId === 'function'
    ? storeInstance.nextId('ts')
    : `ts_${Date.now()}`;

  const changeReason = `RECOVERY: +${pointsAwarded} (${reason})`;

  const trustRow = {
    id: tsId,
    appId,
    previousScore,
    newScore,
    changeReason,
    timestamp: now,
    alertId: null,
    penalty: -pointsAwarded,
    appliedAdjustment: pointsAwarded,
    triggeringEvent: 'recovery_action',
  };

  if (storeInstance.trustHistory) {
    storeInstance.trustHistory.push(trustRow);
  }

  const actId = typeof storeInstance.nextId === 'function'
    ? storeInstance.nextId('act')
    : `act_${Date.now()}`;

  if (storeInstance.history) {
    storeInstance.history.push({
      id: actId,
      appId,
      eventType: ACTIVITY_EVENT_TYPES.TRUST_SCORE_CHANGED,
      description: `Trust score recovered: ${previousScore} -> ${newScore} (+${pointsAwarded})`,
      timestamp: now,
      metadata: {
        previousScore,
        newScore,
        recoveryBonus: pointsAwarded,
        reason,
      },
    });
  }

  return {
    app,
    previousScore,
    newScore,
    pointsAwarded,
    changeReason,
    level: trustLevelFor(newScore),
  };
}

/**
 * Handles automatic trust score recovery when a corrective action (recommendation applied) occurs.
 *
 * @param {string} appId
 * @param {Object} recommendation
 * @param {Object} [storeInstance]
 * @returns {Object|null}
 */
export function handleCorrectiveActionRecovery(appId, recommendation, storeInstance = store) {
  const config = typeof storeInstance.getAdaptiveConfig === 'function'
    ? storeInstance.getAdaptiveConfig()
    : {};

  if (!config.autoRecoveryOnRecommendation) {
    return null; // Disabled by default for strict backward compatibility with MVP demo
  }

  const points = config.recoveryPoints || ADAPTIVE_TRUST_CONFIG.RECOVERY.ON_CORRECTIVE_ACTION;
  const reason = `Corrective action: applied recommendation ${recommendation.title || recommendation.id}`;

  return applyAdaptiveRecovery(appId, points, reason, storeInstance);
}

/**
 * Checks for sustained clean behaviour streak and awards progressive trust recovery.
 *
 * @param {string} appId
 * @param {Array<Object>} [events]
 * @param {Object} [storeInstance]
 * @returns {Object|null}
 */
export function checkCleanStreakRecovery(appId, events = null, storeInstance = store) {
  const config = typeof storeInstance.getAdaptiveConfig === 'function'
    ? storeInstance.getAdaptiveConfig()
    : {};

  const threshold = config.cleanStreakThreshold || ADAPTIVE_TRUST_CONFIG.RECOVERY.CLEAN_STREAK_THRESHOLD;
  const bonus = config.cleanStreakBonus || ADAPTIVE_TRUST_CONFIG.RECOVERY.CLEAN_STREAK_BONUS;

  const allEvents = events || storeInstance.events || [];
  const appEvents = allEvents
    .filter((e) => e.appId === appId)
    .sort((a, b) => toEpochMs(b.timestamp) - toEpochMs(a.timestamp));

  if (appEvents.length < threshold) return null;

  const streak = appEvents.slice(0, threshold);
  const allClean = streak.every((e) => e.status === 'allowed' && !e.suspicious && !e.alertId);

  if (allClean) {
    const reason = `Clean usage streak: ${threshold} consecutive permitted requests with 0 anomalies`;
    return applyAdaptiveRecovery(appId, bonus, reason, storeInstance);
  }

  return null;
}

/**
 * Builds a comprehensive Adaptive Trust profile and factor analysis for an app.
 *
 * @param {string} appId
 * @param {Object} [storeInstance]
 * @returns {Object}
 */
export function getAdaptiveTrustProfile(appId, storeInstance = store) {
  const app = storeInstance.findAppById ? storeInstance.findAppById(appId) : storeInstance.getApp(appId);
  if (!app) {
    const error = new Error(`Application ${appId} not found`);
    error.code = 'APP_NOT_FOUND';
    throw error;
  }

  const allTrustRows = (storeInstance.trustHistory || []).filter((r) => r.appId === appId);
  const allAlerts = (storeInstance.alerts || []).filter((a) => a.appId === appId);
  const activeAlerts = allAlerts.filter((a) => !a.acknowledged);

  const totalPenalties = allTrustRows
    .filter((r) => Number.isFinite(r.penalty) && r.penalty > 0)
    .reduce((sum, r) => sum + r.penalty, 0);

  const totalRecovered = allTrustRows
    .filter((r) => Number.isFinite(r.appliedAdjustment) && r.appliedAdjustment > 0)
    .reduce((sum, r) => sum + r.appliedAdjustment, 0);

  const currentScore = app.trustScore;
  const level = trustLevelFor(currentScore);

  let riskCategory = ADAPTIVE_TRUST_CONFIG.RISK_CATEGORIES.LOW_RISK;
  if (currentScore < 40) riskCategory = ADAPTIVE_TRUST_CONFIG.RISK_CATEGORIES.HIGH_RISK;
  else if (currentScore < 60) riskCategory = ADAPTIVE_TRUST_CONFIG.RISK_CATEGORIES.ELEVATED_RISK;
  else if (currentScore < 80) riskCategory = ADAPTIVE_TRUST_CONFIG.RISK_CATEGORIES.MODERATE_RISK;

  return {
    appId,
    appName: app.name,
    currentScore,
    level,
    riskCategory,
    status: app.status,
    factors: {
      activeAlertsCount: activeAlerts.length,
      totalAlertsCount: allAlerts.length,
      totalPenalties,
      totalRecovered,
      historyRowCount: allTrustRows.length,
    },
    recentAdjustments: [...allTrustRows].reverse().slice(0, 10),
    config: storeInstance.getAdaptiveConfig ? storeInstance.getAdaptiveConfig() : {},
    updatedAt: app.updatedAt,
  };
}

export default {
  calculateAdaptivePenalties,
  calculateAdaptiveTrustScore,
  applyAdaptiveRecovery,
  handleCorrectiveActionRecovery,
  checkCleanStreakRecovery,
  getAdaptiveTrustProfile,
};