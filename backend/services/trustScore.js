// Trust Score (Feature 3) - PURE, deterministic functions. No store access, no I/O.
// Constants come from TRUST_CONFIG in shared/contracts.js. Do not redefine them here.
import { TRUST_CONFIG, trustLevelFor } from '../../shared/contracts.js';

const clamp = (n) => Math.min(TRUST_CONFIG.MAX, Math.max(TRUST_CONFIG.MIN, n));

/** Penalty (positive integer) for one alert severity. Unknown severity -> 0. */
export function penaltyFor(severity) {
  return TRUST_CONFIG.PENALTY[severity] ?? 0;
}

/** "HIGH alert excessive_access: -15" - the changeReason format used in TrustScoreHistory. */
export function changeReasonFor(alert) {
  return `${String(alert.severity).toUpperCase()} alert ${alert.type}: -${penaltyFor(alert.severity)}`;
}

/**
 * Contract: calculateTrustScore(app, recentEvents, alerts)
 *   app         Application (uses app.trustScore as the previous score)
 *   recentEvents same-app events (unused in MVP: no recovery, penalties come from alerts only)
 *   alerts      NEW alerts only (deduped alerts must NOT be passed in -> no double penalty)
 * Returns { previousScore, newScore, level, penalty, explanation[] }.
 * newScore = clamp(previousScore - sum(penalties), 0, 100).
 */
export function calculateTrustScore(app, recentEvents = [], alerts = []) {
  const previousScore = clamp(Number.isFinite(app?.trustScore) ? Math.round(app.trustScore) : TRUST_CONFIG.MAX);
  const newAlerts = Array.isArray(alerts) ? alerts : [];
  const penalty = newAlerts.reduce((sum, a) => sum + penaltyFor(a.severity), 0);
  const newScore = clamp(previousScore - penalty);

  const explanation = newAlerts.map((a) => `-${penaltyFor(a.severity)}: ${a.type} (${a.id})`);
  if (newAlerts.length === 0) {
    explanation.push(`No new penalties; score unchanged at ${previousScore}`);
  } else {
    const raw = previousScore - penalty;
    explanation.push(
      raw < TRUST_CONFIG.MIN
        ? `Score ${newScore} = max(${TRUST_CONFIG.MIN}, ${previousScore} - ${penalty}) (floor applied)`
        : `Score ${newScore} = ${previousScore} - ${penalty}`
    );
  }
  return { previousScore, newScore, level: trustLevelFor(newScore), penalty, explanation };
}

/**
 * Builds the user-facing explanation for the CURRENT score from the app's trust history.
 * Rows that carry a `penalty` are listed one by one; the last line shows the arithmetic, e.g.
 *   ["Initial profile score: 94", "-15: HIGH alert excessive_access (alt_0001)",
 *    "-8: MEDIUM alert unauthorized_resource (alt_0002)", "Score 71 = 94 - 15 - 8"]
 * `historyRows` = TrustScoreHistory[] for ONE app (any order).
 */
export function buildScoreExplanation(historyRows = [], currentScore) {
  const rows = [...historyRows].sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.id < b.id ? -1 : 1));
  const penalties = rows.filter((r) => Number.isFinite(r.penalty) && r.penalty > 0);
  const baseRow = rows.find((r) => !(Number.isFinite(r.penalty) && r.penalty > 0));
  const base = baseRow ? baseRow.newScore : (penalties[0] ? penalties[0].previousScore : currentScore);

  if (penalties.length === 0) {
    return [`Initial profile score ${base}; no penalties applied.`];
  }
  const lines = [`Initial profile score: ${base}`];
  for (const r of penalties) {
    // changeReason looks like "HIGH alert excessive_access: -15" -> strip the trailing ": -15"
    const what = String(r.changeReason || '').replace(/:\s*-\d+\s*$/, '');
    lines.push(`-${r.penalty}: ${what}${r.alertId ? ` (${r.alertId})` : ''}`);
  }
  const total = penalties.reduce((s, r) => s + r.penalty, 0);
  const raw = base - total;
  lines.push(
    raw < TRUST_CONFIG.MIN
      ? `Score ${currentScore} = max(${TRUST_CONFIG.MIN}, ${base} - ${penalties.map((r) => r.penalty).join(' - ')}) (floor applied)`
      : `Score ${currentScore} = ${base} - ${penalties.map((r) => r.penalty).join(' - ')}`
  );
  return lines;
}

export default { penaltyFor, changeReasonFor, calculateTrustScore, buildScoreExplanation };