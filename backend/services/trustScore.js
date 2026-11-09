import {
  TRUST_CONFIG,
  trustLevelFor,
} from '../../shared/contracts.js';
import { store } from '../store/index.js';

/**
 * Calculates updated trust score based on new security alerts.
 * Pure function: (app, recentEvents, newAlerts) -> { previousScore, newScore, level, penalty, explanation }
 *
 * @param {Object} app - Application entity
 * @param {Array<Object>} [recentEvents] - Recent AccessEvents for context
 * @param {Array<Object>} [newAlerts] - Array of newly created SecurityAlerts
 * @returns {{ previousScore: number, newScore: number, level: string, penalty: number, explanation: Array<string> }}
 */
export function calculateTrustScore(app, recentEvents = [], newAlerts = []) {
  const previousScore = app.trustScore ?? 100;

  if (!Array.isArray(newAlerts) || newAlerts.length === 0) {
    // Generate explanation based on existing trust score history
    const trustHistory = store?.trustHistory ||
      (typeof store?.getState === 'function' ? store.getState().trustHistory : []) || [];
    const appTsHistory = trustHistory.filter((t) => t.appId === app.id);

    const explanation = appTsHistory.length > 0
      ? appTsHistory.map((t) => t.changeReason)
      : [`Initial profile score ${previousScore}; no active penalties.`];

    return {
      appId: app.id,
      previousScore,
      newScore: previousScore,
      level: trustLevelFor(previousScore),
      penalty: 0,
      explanation,
    };
  }

  let totalPenalty = 0;
  const explanations = [];

  for (const alert of newAlerts) {
    const penaltyAmount = TRUST_CONFIG.PENALTY[alert.severity] ?? 0;
    totalPenalty += penaltyAmount;
    explanations.push(`-${penaltyAmount}: ${alert.type} (${alert.id || 'new'})`);
  }

  const rawScore = previousScore - totalPenalty;
  const newScore = Math.max(TRUST_CONFIG.MIN, Math.min(TRUST_CONFIG.MAX, rawScore));
  const level = trustLevelFor(newScore);

  explanations.push(`Score ${newScore} = ${previousScore} - ${totalPenalty}`);

  return {
    appId: app.id,
    previousScore,
    newScore,
    level,
    penalty: totalPenalty,
    explanation: explanations,
  };
}

export default { calculateTrustScore };

