import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCESS_STATUS, APPLICATION_STATUS } from '../../shared/contracts.js';
import { analyzeEvent } from '../services/anomalyDetection.js';

const baseTime = Date.parse('2026-11-09T10:00:00.000Z');
const iso = (offsetMs = 0) => new Date(baseTime + offsetMs).toISOString();
const app = (overrides = {}) => ({
  id: 'app_01',
  name: 'Test App',
  status: APPLICATION_STATUS.ACTIVE,
  permissions: {
    location: { enabled: true },
    contacts: { enabled: true },
    camera: { enabled: true },
    microphone: { enabled: true },
    files: { enabled: true },
  },
  ...overrides,
});
const event = (id, resource = 'location', offsetMs = 0, overrides = {}) => ({
  id,
  appId: 'app_01',
  resource,
  timestamp: iso(offsetMs),
  status: ACCESS_STATUS.ALLOWED,
  ...overrides,
});
const ruleIds = (result) => result.findings.map(({ ruleId }) => ruleId);

test('R1 does not fire for exactly 10 same-resource requests including current', () => {
  const current = event('evt_0010');
  const recent = Array.from({ length: 9 }, (_, i) => event(`evt_${String(i + 1).padStart(4, '0')}`));
  assert.equal(analyzeEvent(current, app(), recent).findings.some(({ ruleId }) => ruleId === 'R1'), false);
});

test('R1 fires for 11 same-resource requests including current', () => {
  const current = event('evt_0011');
  const recent = Array.from({ length: 10 }, (_, i) => event(`evt_${String(i + 1).padStart(4, '0')}`));
  assert.ok(ruleIds(analyzeEvent(current, app(), recent)).includes('R1'));
});

test('R1 excludes requests older than 60 seconds and includes the exact boundary', () => {
  const current = event('evt_0011', 'location', 60001);
  const outside = Array.from({ length: 10 }, (_, i) => event(`evt_${String(i + 1).padStart(4, '0')}`, 'location', 0));
  assert.equal(ruleIds(analyzeEvent(current, app(), outside)).includes('R1'), false);

  const boundaryEvents = Array.from({ length: 10 }, (_, i) => event(
    `evt_${String(i + 1).padStart(4, '0')}`,
    'location',
    -60000,
  ));
  assert.ok(ruleIds(analyzeEvent(event('evt_0011'), app(), boundaryEvents)).includes('R1'));
});

test('R2 detects a disabled permission', () => {
  const current = event('evt_0001', 'contacts', 0, {
    status: ACCESS_STATUS.DENIED,
    denialReason: 'permission_disabled',
  });
  assert.ok(ruleIds(analyzeEvent(current, app({
    permissions: { contacts: { enabled: false } },
  }))).includes('R2'));
});

test('R3 detects a suspended application', () => {
  assert.ok(ruleIds(analyzeEvent(
    event('evt_0001'),
    app({ status: APPLICATION_STATUS.SUSPENDED }),
  )).includes('R3'));
});

test('R4 fires for three permission-disabled denials within five minutes', () => {
  const current = event('evt_0003', 'camera', 0, {
    status: ACCESS_STATUS.DENIED,
    denialReason: 'permission_disabled',
  });
  const recent = [-300000, -1000].map((time, i) => event(`evt_000${i + 1}`, 'contacts', time, {
    status: ACCESS_STATUS.DENIED,
    denialReason: 'permission_disabled',
  }));
  assert.ok(ruleIds(analyzeEvent(current, app(), recent)).includes('R4'));
});

test('R4 does not fire for only two permission-disabled denials', () => {
  const current = event('evt_0002', 'camera', 0, {
    status: ACCESS_STATUS.DENIED,
    denialReason: 'permission_disabled',
  });
  const recent = [event('evt_0001', 'contacts', -1000, {
    status: ACCESS_STATUS.DENIED,
    denialReason: 'permission_disabled',
  })];
  assert.equal(ruleIds(analyzeEvent(current, app(), recent)).includes('R4'), false);
});

test('R5 fires for three distinct sensitive resources in 30 seconds', () => {
  const recent = [
    event('evt_0001', 'location', -30000),
    event('evt_0002', 'contacts', -1000),
  ];
  assert.ok(ruleIds(analyzeEvent(event('evt_0003', 'camera'), app(), recent)).includes('R5'));
});

test('files do not count as a sensitive resource', () => {
  const recent = [
    event('evt_0001', 'location', -1000),
    event('evt_0002', 'contacts', -500),
  ];
  assert.equal(ruleIds(analyzeEvent(event('evt_0003', 'files'), app(), recent)).includes('R5'), false);
});

test('one event can produce multiple findings, but a rule is not duplicated', () => {
  const current = event('evt_0011', 'contacts', 0, {
    status: ACCESS_STATUS.DENIED,
    denialReason: 'permission_disabled',
  });
  const recent = Array.from({ length: 10 }, (_, i) => event(
    `evt_${String(i + 1).padStart(4, '0')}`,
    'contacts',
    -1000,
    { status: ACCESS_STATUS.DENIED, denialReason: 'permission_disabled' },
  ));
  const result = analyzeEvent(current, app({ permissions: { contacts: { enabled: false } } }), recent);
  assert.ok(result.findings.length > 1);
  assert.equal(new Set(ruleIds(result)).size, result.findings.length);
});

test('empty recent events do not produce frequency findings', () => {
  assert.deepEqual(analyzeEvent(event('evt_0001'), app(), {}).findings, []);
});

test('missing or invalid timestamps skip time-window rules without throwing', () => {
  for (const timestamp of [undefined, 'not-a-date']) {
    const current = event('evt_0001', 'contacts', 0, { timestamp });
    const result = analyzeEvent(current, app({ permissions: { contacts: { enabled: false } } }), [
      event('evt_0002', 'contacts', -1000),
    ]);
    assert.ok(ruleIds(result).includes('R2'));
    assert.equal(result.findings.some(({ ruleId }) => ['R1', 'R4', 'R5'].includes(ruleId)), false);
  }
});

test('missing permission configuration does not imply a disabled permission', () => {
  const result = analyzeEvent(event('evt_0001', 'contacts'), app({ permissions: {} }));
  assert.equal(ruleIds(result).includes('R2'), false);
});

test('suspended status takes precedence over disabled permission', () => {
  const result = analyzeEvent(
    event('evt_0001', 'contacts'),
    app({
      status: APPLICATION_STATUS.SUSPENDED,
      permissions: { contacts: { enabled: false } },
    }),
  );
  assert.deepEqual(ruleIds(result), ['R3']);
});

test('identical inputs produce identical findings and detection does not mutate inputs', () => {
  const current = event('evt_0003', 'camera', 0, {
    status: ACCESS_STATUS.DENIED,
    denialReason: 'permission_disabled',
  });
  const recent = [
    event('evt_0001', 'contacts', -1000, {
      status: ACCESS_STATUS.DENIED,
      denialReason: 'permission_disabled',
    }),
    event('evt_0002', 'location', -500),
  ];
  const application = app({ permissions: { camera: { enabled: false } } });
  const original = structuredClone({ current, recent, application });
  const first = analyzeEvent(current, application, recent);
  const second = analyzeEvent(current, application, recent);
  assert.deepEqual(first, second);
  assert.deepEqual({ current, recent, application }, original);
});
