import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESS_STATUS,
  APPLICATION_STATUS,
} from '../../shared/contracts.js';
import { analyzeEvent } from '../services/anomalyDetection.js';

const referenceTime = Date.parse('2026-11-09T10:00:00.000Z');
const timestamp = (offsetMs = 0) => new Date(referenceTime + offsetMs).toISOString();

function application(overrides = {}) {
  return {
    id: 'app_01',
    name: 'Test application',
    status: APPLICATION_STATUS.ACTIVE,
    permissions: {
      location: { enabled: true },
      contacts: { enabled: true },
      camera: { enabled: true },
      microphone: { enabled: true },
      files: { enabled: true },
    },
    ...overrides,
  };
}

function accessEvent(id, resource = 'location', offsetMs = 0, overrides = {}) {
  return {
    id,
    appId: 'app_01',
    resource,
    timestamp: timestamp(offsetMs),
    status: ACCESS_STATUS.ALLOWED,
    suspicious: false,
    alertId: null,
    ...overrides,
  };
}

function ruleIds(result) {
  return result.findings.map((item) => item.ruleId);
}

test('R1 includes the current request and triggers only above ten same-resource requests', () => {
  const firstTen = Array.from({ length: 9 }, (_, index) => accessEvent(`evt_${index + 1}`));
  assert.equal(ruleIds(analyzeEvent(accessEvent('evt_0010'), application(), firstTen)).includes('R1'), false);

  const firstEleven = Array.from({ length: 10 }, (_, index) => accessEvent(`evt_${index + 1}`));
  assert.ok(ruleIds(analyzeEvent(accessEvent('evt_0011'), application(), firstEleven)).includes('R1'));
});

test('R1 excludes requests outside 60 seconds and includes the exact boundary', () => {
  const outside = Array.from({ length: 10 }, (_, index) => accessEvent(`evt_${index + 1}`, 'location', -60001));
  assert.equal(ruleIds(analyzeEvent(accessEvent('evt_0011'), application(), outside)).includes('R1'), false);

  const boundary = Array.from({ length: 10 }, (_, index) => accessEvent(`evt_${index + 1}`, 'location', -60000));
  assert.ok(ruleIds(analyzeEvent(accessEvent('evt_0011'), application(), boundary)).includes('R1'));
});

test('R2 detects a disabled resource permission', () => {
  const app = application({ permissions: { contacts: { enabled: false } } });
  const current = accessEvent('evt_0001', 'contacts', 0, {
    status: ACCESS_STATUS.DENIED,
    denialReason: 'permission_disabled',
  });
  const result = analyzeEvent(current, app, [current]);
  assert.ok(ruleIds(result).includes('R2'));
});

test('R3 detects suspended access before checking a disabled permission', () => {
  const app = application({
    status: APPLICATION_STATUS.SUSPENDED,
    permissions: { contacts: { enabled: false } },
  });
  const result = analyzeEvent(accessEvent('evt_0001', 'contacts', 0, {
    status: ACCESS_STATUS.DENIED,
    denialReason: 'app_suspended',
  }), app);
  assert.deepEqual(ruleIds(result), ['R3']);
});

test('R4 fires for three denied requests in five minutes, regardless of denial reason', () => {
  const prior = [
    accessEvent('evt_0001', 'contacts', -300000, {
      status: ACCESS_STATUS.DENIED,
      denialReason: 'permission_disabled',
    }),
    accessEvent('evt_0002', 'camera', -1000, {
      status: ACCESS_STATUS.DENIED,
      denialReason: 'app_suspended',
    }),
  ];
  const current = accessEvent('evt_0003', 'location', 0, {
    status: ACCESS_STATUS.DENIED,
    denialReason: 'permission_disabled',
  });
  assert.ok(ruleIds(analyzeEvent(current, application(), [...prior, current])).includes('R4'));
});

test('R4 does not fire for two denials or denials outside five minutes', () => {
  const current = accessEvent('evt_0003', 'location', 0, { status: ACCESS_STATUS.DENIED });
  const oneRecent = [
    accessEvent('evt_0001', 'contacts', -1000, { status: ACCESS_STATUS.DENIED }),
  ];
  assert.equal(ruleIds(analyzeEvent(current, application(), [...oneRecent, current])).includes('R4'), false);

  const oldDenied = Array.from({ length: 2 }, (_, index) => accessEvent(
    `evt_${index + 1}`,
    'contacts',
    -300001,
    { status: ACCESS_STATUS.DENIED },
  ));
  assert.equal(ruleIds(analyzeEvent(current, application(), [...oldDenied, current])).includes('R4'), false);
});

test('R5 detects three distinct sensitive resources in 30 seconds; files do not count', () => {
  const prior = [
    accessEvent('evt_0001', 'location', -30000),
    accessEvent('evt_0002', 'contacts', -1000),
  ];
  const current = accessEvent('evt_0003', 'camera');
  assert.ok(ruleIds(analyzeEvent(current, application(), [...prior, current])).includes('R5'));

  const withFiles = [
    accessEvent('evt_0001', 'location', -1000),
    accessEvent('evt_0002', 'contacts', -500),
  ];
  const fileCurrent = accessEvent('evt_0003', 'files');
  assert.equal(ruleIds(analyzeEvent(fileCurrent, application(), [...withFiles, fileCurrent])).includes('R5'), false);
});

test('findings are deterministic and detection does not mutate input events or app', () => {
  const app = application({ permissions: { contacts: { enabled: false } } });
  const current = accessEvent('evt_0003', 'contacts', 0, {
    status: ACCESS_STATUS.DENIED,
    denialReason: 'permission_disabled',
  });
  const recent = [
    accessEvent('evt_0001', 'contacts', -1000, { status: ACCESS_STATUS.DENIED }),
    accessEvent('evt_0002', 'location', -500, { status: ACCESS_STATUS.DENIED }),
  ];
  const snapshot = structuredClone({ app, current, recent });
  const first = analyzeEvent(current, app, recent);
  assert.deepEqual(first, analyzeEvent(current, app, recent));
  assert.deepEqual({ app, current, recent }, snapshot);
});
