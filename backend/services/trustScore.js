import {
  TRUST_CONFIG,
  trustLevelFor,
} from '../../shared/contracts.js';

/**
 * Pure trust score calculation function.
 *
 * @param {Object} app - Application object
 * @param {Array<Object>} newAlerts - Newly created alerts for this app in this cycle
 * @returns {{ previousScore: number, newScore: number, level: string, penalty: number, changeReason: string, explanation: string[] }}
 */
export function calculateTrustScore(app, newAlerts = []) {
  const previousScore = app.trustScore;

  let totalPenalty = 0;
  const reasons = [];

  for (const alert of newAlerts) {
    const penalty = TRUST_CONFIG.PENALTY[alert.severity] || 0;
    totalPenalty += penalty;
    reasons.push(`${alert.severity.toUpperCase()} alert ${alert.type}: -${penalty}`);
  }

  const rawScore = previousScore - totalPenalty;
  const newScore = Math.max(TRUST_CONFIG.MIN, Math.min(TRUST_CONFIG.MAX, rawScore));
  const level = trustLevelFor(newScore);

  const changeReason = reasons.join('; ') || 'No penalty';

  const explanation = [
    `Current score: ${newScore} (${level})`,
    ...reasons.map((r) => `Deduction: ${r}`),
  ];

  return {
    previousScore,
    newScore,
    level,
    penalty: totalPenalty,
    changeReason,
    explanation,
  };
}

export default calculateTrustScore;
