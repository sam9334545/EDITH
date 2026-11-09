// Security service - Trust Score part (Feature 3). Persists score changes and serves the score view.
// Works with any M1 store that exposes getState(), nextId(prefix) and clock.now().
import { ACTIVITY_EVENT_TYPES, trustLevelFor } from '../../shared/contracts.js';
import { store } from '../store/index.js';
import { calculateTrustScore, changeReasonFor, buildScoreExplanation, penaltyFor } from './trustScore.js';

const byNewest = (a, b) => (a.timestamp === b.timestamp ? (a.id < b.id ? 1 : -1) : a.timestamp < b.timestamp ? 1 : -1);

function findApp(appId) {
  return store.getState().apps.find((a) => a.id === appId) || null;
}

/**
 * Called by the access pipeline (step 10) with the NEW alerts of the current request.
 * For each alert that has not been penalised before it: lowers app.trustScore, appends a
 * TrustScoreHistory row (one per alert) and an ActivityHistory `trust_score_changed` entry.
 * Safe to call repeatedly: an alert id that already has a history row is skipped.
 * Returns exactly the API's trustScore shape { appId, score, level, explanation[] } (API #7), or null
 * if the app is unknown. M1 can put the result directly into the `trustScore` field of the response.
 */
export function applyTrustPenalties(appId, newAlerts = []) {
  const state = store.getState();
  const app = findApp(appId);
  if (!app) return null;

  const alreadyPenalised = new Set(state.trustHistory.filter((r) => r.appId === appId && r.alertId).map((r) => r.alertId));
  const startScore = app.trustScore;
  const changes = [];
  const explanation = [];
  let totalPenalty = 0;

  for (const alert of newAlerts) {
    if (alert.appId !== appId || alreadyPenalised.has(alert.id)) continue; // duplicate prevention
    const result = calculateTrustScore(app, [], [alert]);
    const timestamp = alert.timestamp || store.clock.now();

    const row = {
      id: store.nextId('ts'), appId, previousScore: result.previousScore, newScore: result.newScore,
      changeReason: changeReasonFor(alert), timestamp, alertId: alert.id, penalty: penaltyFor(alert.severity),
    };
    state.trustHistory.push(row);
    state.history.push({
      id: store.nextId('act'), appId, eventType: ACTIVITY_EVENT_TYPES.TRUST_SCORE_CHANGED,
      description: `Trust score ${result.previousScore} -> ${result.newScore} (${row.changeReason})`,
      timestamp, metadata: { alertId: alert.id, previousScore: result.previousScore, newScore: result.newScore, penalty: row.penalty },
    });

    app.trustScore = result.newScore;
    app.updatedAt = timestamp;
    alreadyPenalised.add(alert.id);
    totalPenalty += result.penalty;
    explanation.push(...result.explanation.slice(0, -1)); // keep per-alert lines, summary is rebuilt below
    changes.push(row);
  }

  if (changes.length === 0) {
    explanation.push(`No new penalties; score unchanged at ${startScore}`);
  } else {
    explanation.push(`Score ${app.trustScore} = ${startScore} - ${totalPenalty}`);
  }
  return { appId, score: app.trustScore, level: trustLevelFor(app.trustScore), explanation };
}

/** GET /api/security/score/:appId payload. Returns null if the app does not exist. */
export function getTrustScoreView(appId) {
  const app = findApp(appId);
  if (!app) return null;
  const rows = store.getState().trustHistory.filter((r) => r.appId === appId);
  return {
    appId,
    score: app.trustScore,
    level: trustLevelFor(app.trustScore),
    history: [...rows].sort(byNewest), // newest first, like every other list in the API
    explanation: buildScoreExplanation(rows, app.trustScore),
  };
}

export default { applyTrustPenalties, getTrustScoreView };