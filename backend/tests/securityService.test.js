// Trust-score service + endpoint tests. Needs M1's store (backend/store/index.js) and express.
// Run: cd backend && node --test tests/securityService.test.js
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { store } from '../store/index.js';
import { applyTrustPenalties, getTrustScoreView } from '../services/securityService.js';
import securityRoutes from '../test-support/inMemorySecurityRoutes.js';

const A1 = { id: 'alt_0001', appId: 'app_01', type: 'excessive_access', severity: 'high', timestamp: '2026-11-09T10:00:22.000Z' };
const A2 = { id: 'alt_0002', appId: 'app_01', type: 'unauthorized_resource', severity: 'medium', timestamp: '2026-11-09T10:04:00.000Z' };
const A3 = { id: 'alt_0003', appId: 'app_01', type: 'unauthorized_resource', severity: 'medium', timestamp: '2026-11-09T10:05:00.000Z' };
const appScore = (id = 'app_01') => store.getState().apps.find((a) => a.id === id).trustScore;

beforeEach(() => store.resetToSeed());

test('applyTrustPenalties returns exactly the API trustScore shape', () => {
  const r = applyTrustPenalties('app_01', [A1]);
  assert.deepEqual(Object.keys(r).sort(), ['appId', 'explanation', 'level', 'score']);
  assert.deepEqual(r.explanation, ['-15: excessive_access (alt_0001)', 'Score 79 = 94 - 15']);
});

test('demo scenario scores: 94 -> 79 -> 71 -> 63', () => {
  assert.equal(applyTrustPenalties('app_01', [A1]).score, 79);
  assert.equal(applyTrustPenalties('app_01', [A2]).score, 71);
  const last = applyTrustPenalties('app_01', [A3]);
  assert.equal(last.score, 63);
  assert.equal(last.level, 'moderate');
  assert.equal(appScore(), 63);
});

test('writes one TrustScoreHistory row and one trust_score_changed entry per alert', () => {
  const histBefore = store.getState().history.length;
  applyTrustPenalties('app_01', [A1, A2, A3]);
  const rows = store.getState().trustHistory.filter((r) => r.appId === 'app_01' && r.alertId);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => [r.previousScore, r.newScore, r.penalty]), [[94, 79, 15], [79, 71, 8], [71, 63, 8]]);
  assert.equal(rows[0].changeReason, 'HIGH alert excessive_access: -15');
  assert.deepEqual(rows.map((r) => r.id), ['ts_0004', 'ts_0005', 'ts_0006']);
  const added = store.getState().history.slice(histBefore);
  assert.equal(added.filter((h) => h.eventType === 'trust_score_changed').length, 3);
});

test('same alert is never penalised twice (repeat Simulate / re-run pipeline)', () => {
  applyTrustPenalties('app_01', [A1]);
  const again = applyTrustPenalties('app_01', [A1]);
  assert.equal(again.score, 79);
  assert.match(again.explanation[0], /No new penalties/);
  assert.equal(appScore(), 79);
  assert.equal(store.getState().trustHistory.filter((r) => r.alertId === 'alt_0001').length, 1);
});

test('empty alert list changes nothing', () => {
  const r = applyTrustPenalties('app_01', []);
  assert.equal(r.score, 94);
  assert.equal(store.getState().trustHistory.length, 3);
});

test('alerts for another app are ignored; unknown app returns null', () => {
  assert.equal(applyTrustPenalties('app_02', [A1]).score, 91);
  assert.equal(appScore('app_02'), 91);
  assert.equal(applyTrustPenalties('app_99', [A1]), null);
});

test('score stays within 0-100 under repeated critical alerts', () => {
  const alerts = Array.from({ length: 8 }, (_, i) => ({ id: `alt_x${i}`, appId: 'app_03', type: 'x', severity: 'critical', timestamp: `2026-11-09T10:0${i}:00.000Z` }));
  const r = applyTrustPenalties('app_03', alerts);
  assert.equal(r.score, 0);
  assert.equal(r.level, 'critical');
  assert.ok(store.getState().trustHistory.every((t) => t.newScore >= 0 && t.newScore <= 100));
});

test('getTrustScoreView: shape, newest-first history, cumulative explanation', () => {
  applyTrustPenalties('app_01', [A1]);
  applyTrustPenalties('app_01', [A2]);
  const v = getTrustScoreView('app_01');
  assert.equal(v.score, 71);
  assert.equal(v.level, 'moderate');
  assert.equal(v.history[0].alertId, 'alt_0002');
  assert.equal(v.history.at(-1).id, 'ts_0001');
  assert.deepEqual(v.explanation, [
    'Initial profile score: 94',
    '-15: HIGH alert excessive_access (alt_0001)',
    '-8: MEDIUM alert unauthorized_resource (alt_0002)',
    'Score 71 = 94 - 15 - 8',
  ]);
  assert.equal(getTrustScoreView('nope'), null);
});

test('GET /api/security/score/:appId over HTTP (envelope, 200 and 404)', async () => {
  const server = express().use('/api/security', securityRoutes).listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/security/score`;
  try {
    applyTrustPenalties('app_01', [A1]);
    const okRes = await fetch(`${base}/app_01`);
    const okBody = await okRes.json();
    assert.equal(okRes.status, 200);
    assert.equal(okBody.success, true);
    assert.deepEqual(Object.keys(okBody.data).sort(), ['appId', 'explanation', 'history', 'level', 'score']);
    assert.equal(okBody.data.score, 79);

    const missing = await fetch(`${base}/app_99`);
    const missingBody = await missing.json();
    assert.equal(missing.status, 404);
    assert.equal(missingBody.error.code, 'APP_NOT_FOUND');
  } finally {
    server.close();
  }
});