import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import store from '../store/index.js';
import { processAccessRequest } from '../services/accessPipeline.js';
import { setGuardMode, getGuardDecisions } from '../services/runtimeGuard.js';
import { grantPermission, revokePermission, suspendApp } from '../services/permissionService.js';

const T = Date.parse('2026-11-09T10:00:00.000Z');
const req = (resource, i = 0, appId = 'app_01') => processAccessRequest({
  appId, resource, reason: 'test', timestamp: new Date(T + i * 1000).toISOString(),
});

describe('Runtime Guard', () => {
  beforeEach(() => store.resetToSeed());

  it('logs a decision for every request with the documented shape', () => {
    setGuardMode('protect');
    const r = req('location');
    const [d] = getGuardDecisions({ appId: 'app_01' });
    assert.strictEqual(r.guard.decisionId, d.decisionId);
    for (const k of ['decisionId', 'appId', 'eventId', 'decision', 'reason', 'policyTriggered', 'enforcementMode', 'severity', 'timestamp']) {
      assert.ok(k in d, `missing ${k}`);
    }
    assert.strictEqual(d.decision, 'ALLOW');
    assert.strictEqual(d.eventId, r.event.id);
  });

  for (const mode of ['monitor', 'protect', 'strict']) {
    it(`always denies a revoked permission in ${mode} mode`, () => {
      setGuardMode(mode);
      revokePermission('app_01', 'location');
      const r = req('location');
      assert.strictEqual(r.allowed, false);
      assert.strictEqual(r.event.denialReason, 'permission_disabled');
      assert.strictEqual(r.guard.decision, 'BLOCK');
      assert.strictEqual(r.guard.policyTriggered, 'PERMISSION_REVOKED');
    });
  }

  it('monitor: LOCATION_RATE_LIMIT is alert-only (still allowed, alert raised)', () => {
    setGuardMode('monitor');
    let last;
    for (let i = 0; i < 12; i += 1) last = req('location', i);
    assert.strictEqual(last.allowed, true);
    assert.strictEqual(last.guard.decision, 'ALLOW');
    assert.strictEqual(last.guard.policyTriggered, 'LOCATION_RATE_LIMIT');
    assert.ok(store.alerts.some((a) => a.type === 'excessive_access'));
  });

  for (const mode of ['protect', 'strict']) {
    it(`${mode}: LOCATION_RATE_LIMIT blocks request #11 and does not trigger repeated_restricted`, () => {
      setGuardMode(mode);
      const results = [];
      for (let i = 0; i < 14; i += 1) results.push(req('location', i));
      assert.ok(results.slice(0, 10).every((r) => r.allowed));
      assert.ok(results.slice(10).every((r) => !r.allowed && r.event.denialReason === 'rate_limit_exceeded'));
      assert.ok(!store.alerts.some((a) => a.type === 'repeated_restricted_access'));
    });
  }

  it('suspended apps are blocked in strict, observed (allowed + alert) in monitor/protect', () => {
    suspendApp('app_01');
    setGuardMode('strict');
    assert.strictEqual(req('location', 0).guard.decision, 'BLOCK');
    assert.strictEqual(req('location', 1).event.denialReason, 'app_suspended');
    setGuardMode('protect');
    const r = req('location', 2);
    assert.strictEqual(r.guard.decision, 'ALLOW');
    assert.strictEqual(r.guard.policyTriggered, 'APP_SUSPENDED');
    assert.ok(store.alerts.some((a) => a.type === 'suspended_app_access'));
  });

  it('strict blocks high-severity combination burst; protect only logs it', () => {
    ['camera', 'microphone'].forEach((r) => grantPermission('app_01', r));
    setGuardMode('protect');
    ['location', 'camera', 'microphone'].forEach((r, i) => req(r, i));
    assert.strictEqual(getGuardDecisions({ limit: 1 })[0].decision, 'ALLOW');
    store.resetToSeed();
    ['camera', 'microphone'].forEach((r) => grantPermission('app_01', r));
    setGuardMode('strict');
    const out = ['location', 'camera', 'microphone'].map((r, i) => req(r, i));
    assert.ok(out.some((r) => r.guard.policyTriggered === 'SENSITIVE_COMBINATION_BURST'));
  });
});