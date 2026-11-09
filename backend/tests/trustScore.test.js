// Pure trust-score tests. Run: cd backend && node --test tests/trustScore.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTrustScore, buildScoreExplanation, penaltyFor, changeReasonFor } from '../services/trustScore.js';

const app = (trustScore) => ({ id: 'app_01', trustScore });
const alert = (id, severity, type) => ({ id, appId: 'app_01', severity, type });

test('penalties match the contract', () => {
  assert.deepEqual([penaltyFor('low'), penaltyFor('medium'), penaltyFor('high'), penaltyFor('critical')], [3, 8, 15, 25]);
  assert.equal(penaltyFor('nonsense'), 0);
});

test('demo step 2: 94 - high alert = 79 (moderate)', () => {
  const r = calculateTrustScore(app(94), [], [alert('alt_0001', 'high', 'excessive_access')]);
  assert.equal(r.previousScore, 94);
  assert.equal(r.newScore, 79);
  assert.equal(r.level, 'moderate');
  assert.equal(r.penalty, 15);
  assert.deepEqual(r.explanation, ['-15: excessive_access (alt_0001)', 'Score 79 = 94 - 15']);
});

test('demo step 3: 79 - medium alert = 71 (moderate)', () => {
  const r = calculateTrustScore(app(79), [], [alert('alt_0002', 'medium', 'unauthorized_resource')]);
  assert.equal(r.newScore, 71);
  assert.equal(r.level, 'moderate');
});

test('no new alerts -> score unchanged, zero penalty', () => {
  const r = calculateTrustScore(app(94), [], []);
  assert.equal(r.newScore, 94);
  assert.equal(r.penalty, 0);
  assert.match(r.explanation[0], /No new penalties/);
});

test('level boundaries: 80 high, 79 moderate, 60 moderate, 59 low, 40 low, 39 critical', () => {
  const lvl = (from, sev) => calculateTrustScore(app(from), [], [alert('a', sev, 't')]).level;
  assert.equal(lvl(83, 'low'), 'high');       // 80
  assert.equal(lvl(94, 'high'), 'moderate');  // 79
  assert.equal(lvl(75, 'high'), 'moderate');  // 60
  assert.equal(lvl(74, 'high'), 'low');       // 59
  assert.equal(lvl(55, 'high'), 'low');       // 40
  assert.equal(lvl(54, 'high'), 'critical');  // 39
});

test('score never goes below 0 or above 100', () => {
  const many = Array.from({ length: 10 }, (_, i) => alert(`alt_${i}`, 'critical', 'x'));
  const r = calculateTrustScore(app(20), [], many);
  assert.equal(r.newScore, 0);
  assert.equal(r.level, 'critical');
  assert.match(r.explanation.at(-1), /floor applied/);
  assert.equal(calculateTrustScore(app(500), [], []).newScore, 100);
  assert.equal(calculateTrustScore(app(-5), [], []).newScore, 0);
});

test('deterministic: same input, same output', () => {
  const a = [alert('alt_0001', 'high', 'excessive_access')];
  assert.deepEqual(calculateTrustScore(app(94), [], a), calculateTrustScore(app(94), [], a));
});

test('changeReasonFor uses the contract format', () => {
  assert.equal(changeReasonFor(alert('alt_0001', 'high', 'excessive_access')), 'HIGH alert excessive_access: -15');
});

test('buildScoreExplanation shows each penalty and the arithmetic', () => {
  const rows = [
    { id: 'ts_0001', appId: 'app_01', previousScore: 100, newScore: 94, changeReason: 'Initial profile score (location + files)', timestamp: '2026-11-01T09:00:00.000Z' },
    { id: 'ts_0004', appId: 'app_01', previousScore: 94, newScore: 79, changeReason: 'HIGH alert excessive_access: -15', timestamp: '2026-11-09T10:00:22.000Z', alertId: 'alt_0001', penalty: 15 },
    { id: 'ts_0005', appId: 'app_01', previousScore: 79, newScore: 71, changeReason: 'MEDIUM alert unauthorized_resource: -8', timestamp: '2026-11-09T10:04:00.000Z', alertId: 'alt_0002', penalty: 8 },
  ];
  assert.deepEqual(buildScoreExplanation([...rows].reverse(), 71), [
    'Initial profile score: 94',
    '-15: HIGH alert excessive_access (alt_0001)',
    '-8: MEDIUM alert unauthorized_resource (alt_0002)',
    'Score 71 = 94 - 15 - 8',
  ]);
});

test('buildScoreExplanation with no penalties', () => {
  const rows = [{ id: 'ts_0001', appId: 'app_01', previousScore: 100, newScore: 94, changeReason: 'Initial', timestamp: '2026-11-01T09:00:00.000Z' }];
  assert.deepEqual(buildScoreExplanation(rows, 94), ['Initial profile score 94; no penalties applied.']);
});