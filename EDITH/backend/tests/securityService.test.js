import test from 'node:test';
import assert from 'node:assert/strict';
import { ALERT_TYPES, ACCESS_STATUS, APPLICATION_STATUS } from '../../shared/contracts.js';
import { processSecurityEvent } from '../services/securityService.js';

const time = '2026-11-09T10:00:00.000Z';

function createHarness() {
  const state = { alerts: [], events: [] };
  let counter = 0;
  const store = {
    getState: () => state,
    nextId(prefix) {
      counter += 1;
      return `${prefix}_${String(counter).padStart(4, '0')}`;
    },
  };
  const clock = { now: () => time };
  return { state, store, clock };
}

function testApp(overrides = {}) {
  return {
    id: 'app_01',
    name: 'Test App',
    status: APPLICATION_STATUS.ACTIVE,
    permissions: { location: { enabled: true } },
    ...overrides,
  };
}

function request(id, resource = 'location', overrides = {}) {
  return {
    id,
    appId: 'app_01',
    resource,
    timestamp: time,
    status: ACCESS_STATUS.ALLOWED,
    suspicious: false,
    alertId: null,
    ...overrides,
  };
}

function excessiveEvents(current) {
  return Array.from({ length: 10 }, (_, i) => ({
    ...request(`evt_${String(i + 1).padStart(4, '0')}`, current.resource),
  }));
}

test('same-key alert within 300 seconds is merged and returned separately', () => {
  const { state, store, clock } = createHarness();
  const first = request('evt_0011');
  const firstResult = processSecurityEvent(first, testApp(), excessiveEvents(first), { store, clock });
  assert.equal(firstResult.alertsCreated.length, 1);
  assert.equal(firstResult.alertsMerged.length, 0);

  const second = request('evt_0012');
  state.events.push(first);
  const secondResult = processSecurityEvent(second, testApp(), [...excessiveEvents(second), second], { store, clock });
  assert.equal(secondResult.alertsCreated.length, 0);
  assert.equal(secondResult.alertsMerged.length, 1);
  assert.equal(second.alertId, first.alertId);
  assert.equal(second.suspicious, true);
});

test('repeated event IDs are not duplicated in a merged alert', () => {
  const { state, store, clock } = createHarness();
  const first = request('evt_0011');
  processSecurityEvent(first, testApp(), excessiveEvents(first), { store, clock });
  const alert = state.alerts[0];
  const before = [...alert.relatedEventIds];

  const repeated = request('evt_0011');
  state.events.push(first);
  processSecurityEvent(repeated, testApp(), excessiveEvents(repeated), { store, clock });
  assert.deepEqual(alert.relatedEventIds, before);
});

test('resource-specific findings deduplicate independently by resource', () => {
  const { state, store, clock } = createHarness();
  const contactsApp = testApp({ permissions: { contacts: { enabled: false } } });
  const contacts = request('evt_0001', 'contacts', {
    status: ACCESS_STATUS.DENIED,
    denialReason: 'permission_disabled',
  });
  processSecurityEvent(contacts, contactsApp, [contacts], { store, clock });

  const camera = request('evt_0002', 'camera', {
    status: ACCESS_STATUS.DENIED,
    denialReason: 'permission_disabled',
  });
  processSecurityEvent(camera, testApp({ permissions: { camera: { enabled: false } } }), [camera], { store, clock });
  assert.equal(state.alerts.filter(({ type }) => type === ALERT_TYPES.UNAUTHORIZED_RESOURCE).length, 2);
});

test('R4 and R5 deduplicate using the wildcard resource', () => {
  const { state, store, clock } = createHarness();
  const repeated = [
    request('evt_0001', 'contacts', { status: ACCESS_STATUS.DENIED, denialReason: 'permission_disabled' }),
    request('evt_0002', 'camera', { status: ACCESS_STATUS.DENIED, denialReason: 'permission_disabled' }),
  ];
  const third = request('evt_0003', 'microphone', {
    status: ACCESS_STATUS.DENIED,
    denialReason: 'permission_disabled',
  });
  const result = processSecurityEvent(third, testApp(), [...repeated, third], { store, clock });
  const r4 = result.alertsCreated.find(({ type }) => type === ALERT_TYPES.REPEATED_RESTRICTED_ACCESS);
  assert.ok(r4);

  const next = request('evt_0004', 'contacts', {
    status: ACCESS_STATUS.DENIED,
    denialReason: 'permission_disabled',
  });
  state.events.push(...repeated, third);
  const merged = processSecurityEvent(next, testApp(), [...repeated, third, next], { store, clock });
  assert.ok(merged.alertsMerged.some(({ id }) => id === r4.id));

  const combo = request('evt_0010', 'camera');
  const comboRecent = [
    request('evt_0007', 'location'),
    request('evt_0008', 'contacts'),
    combo,
  ];
  const comboResult = processSecurityEvent(combo, testApp(), comboRecent, { store, clock });
  const r5 = [...comboResult.alertsCreated, ...comboResult.alertsMerged]
    .find(({ type }) => type === ALERT_TYPES.UNUSUAL_RESOURCE_COMBINATION);
  assert.ok(r5);
  assert.equal(r5.relatedEventIds.includes(combo.id), true);
});

test('an event after the dedupe interval creates a new alert', () => {
  const { state, store } = createHarness();
  let now = Date.parse(time);
  const clock = { now: () => new Date(now).toISOString() };
  const first = request('evt_0011');
  processSecurityEvent(first, testApp(), excessiveEvents(first), { store, clock });
  now += 300001;
  const second = request('evt_0012');
  const result = processSecurityEvent(second, testApp(), excessiveEvents(second), { store, clock });
  assert.equal(result.alertsCreated.length, 1);
  assert.equal(state.alerts.length, 2);
});

test('duplicate association sets the event alertId and suspicious flag without duplicate IDs', () => {
  const { state, store, clock } = createHarness();
  const first = request('evt_0011');
  processSecurityEvent(first, testApp(), excessiveEvents(first), { store, clock });
  state.events.push(first);
  const second = request('evt_0012');
  const result = processSecurityEvent(second, testApp(), excessiveEvents(second), { store, clock });
  const alert = state.alerts[0];
  assert.equal(second.alertId, alert.id);
  assert.equal(second.suspicious, true);
  assert.equal(new Set(alert.relatedEventIds).size, alert.relatedEventIds.length);
  assert.equal(result.alertsCreated.length, 0);
});
