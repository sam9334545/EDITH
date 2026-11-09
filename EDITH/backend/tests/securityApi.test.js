import test from 'node:test';
import assert from 'node:assert/strict';
import { createSecurityRouter } from '../routes/securityRoutes.js';

function fixture() {
  const state = {
    alerts: [
      { id: 'alt_0001', appId: 'app_01', type: 'excessive_access', severity: 'high', timestamp: '2026-11-09T10:00:00.000Z', relatedEventIds: [], acknowledged: false },
      { id: 'alt_0002', appId: 'app_02', type: 'unauthorized_resource', severity: 'medium', timestamp: '2026-11-09T11:00:00.000Z', relatedEventIds: [], acknowledged: true },
      { id: 'alt_0003', appId: 'app_01', type: 'suspended_app_access', severity: 'medium', timestamp: '2026-11-09T12:00:00.000Z', relatedEventIds: [], acknowledged: false },
    ],
    events: [],
  };
  const store = { getState: () => state };
  const routes = new Map();
  const router = {
    get(path, handler) { routes.set(`GET ${path}`, handler); },
    patch(path, handler) { routes.set(`PATCH ${path}`, handler); },
  };
  createSecurityRouter({ Router: () => router, store });
  return { state, routes };
}

function response() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('GET validates combined filters, sorts newest first, and applies limit', () => {
  const { routes } = fixture();
  const res = response();
  routes.get('GET /alerts')({ query: { appId: 'app_01', severity: 'medium', acknowledged: 'false', limit: '1' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Alerts retrieved successfully');
  assert.deepEqual(res.body.data.alerts.map(({ id }) => id), ['alt_0003']);
});

test('GET applies the default and maximum list limit behavior', () => {
  const { routes } = fixture();
  const res = response();
  routes.get('GET /alerts')({ query: {} }, res);
  assert.equal(res.body.data.alerts.length, 3);

  const tooLarge = response();
  routes.get('GET /alerts')({ query: { limit: '201' } }, tooLarge);
  assert.equal(tooLarge.statusCode, 400);
});

test('GET rejects invalid query parameters', () => {
  const { routes } = fixture();
  for (const query of [
    { appId: '' },
    { severity: 'urgent' },
    { acknowledged: 'yes' },
    { limit: '0' },
    { limit: '1.5' },
  ]) {
    const res = response();
    routes.get('GET /alerts')({ query }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
  }
});

test('acknowledgement updates the alert and returns it', () => {
  const { state, routes } = fixture();
  const res = response();
  routes.get('PATCH /alerts/:id/acknowledge')({ params: { id: 'alt_0001' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.acknowledged, true);
  assert.equal(state.alerts[0].acknowledged, true);
});

test('invalid alert IDs return validation errors', () => {
  const { routes } = fixture();
  const res = response();
  routes.get('PATCH /alerts/:id/acknowledge')({ params: { id: 'bad-id' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('missing alerts return a 404 alert-not-found error', () => {
  const { routes } = fixture();
  const res = response();
  routes.get('PATCH /alerts/:id/acknowledge')({ params: { id: 'alt_9999' } }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, 'ALERT_NOT_FOUND');
});
