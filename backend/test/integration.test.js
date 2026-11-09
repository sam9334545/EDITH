import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import store from '../store/index.js';
import { getHistory, getHistorySummary } from '../controllers/historyController.js';
import { simulateEvents } from '../controllers/eventController.js';
import { updateAppPermission, updateAppStatus } from '../controllers/appController.js';
import { ACTIVITY_EVENT_TYPES } from '../../shared/contracts.js';

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

describe('Controller & API Integration: GET /api/history and End-to-End Triggers', () => {
  beforeEach(() => {
    store.resetToSeed();
  });

  it('GET /api/history returns 200 with reverse chronological activity history', () => {
    const req = { query: {} };
    const res = createMockRes();

    getHistory(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0);

    // Verify schema of first item
    const first = res.body.data[0];
    assert.ok(first.id.startsWith('act_'));
    assert.ok(first.appId);
    assert.ok(first.eventType);
    assert.ok(first.description);
    assert.ok(first.timestamp);
    assert.ok(first.metadata);

    // Verify reverse chronological order
    for (let i = 0; i < res.body.data.length - 1; i++) {
      const t1 = new Date(res.body.data[i].timestamp).getTime();
      const t2 = new Date(res.body.data[i + 1].timestamp).getTime();
      assert.ok(t1 >= t2, `Item ${i} must be >= Item ${i + 1}`);
    }
  });

  it('GET /api/history?appId=app_02 filters by application ID', () => {
    const req = { query: { appId: 'app_02' } };
    const res = createMockRes();

    getHistory(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.length > 0);
    assert.ok(res.body.data.every((item) => item.appId === 'app_02'));
  });

  it('GET /api/history?eventType=access_allowed filters by event type', () => {
    const req = { query: { eventType: ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED } };
    const res = createMockRes();

    getHistory(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.length > 0);
    assert.ok(res.body.data.every((item) => item.eventType === ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED));
  });

  it('GET /api/history?limit=2 applies limit correctly', () => {
    const req = { query: { limit: '2' } };
    const res = createMockRes();

    getHistory(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.length, 2);
  });

  it('GET /api/history returns 400 with VALIDATION_ERROR on invalid eventType', () => {
    const req = { query: { eventType: 'non_existent_event_type' } };
    const res = createMockRes();

    getHistory(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('GET /api/history returns 400 with VALIDATION_ERROR on invalid limit', () => {
    const req = { query: { limit: 'invalid' } };
    const res = createMockRes();

    getHistory(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('GET /api/history/summary returns aggregated summary metrics', () => {
    const req = {};
    const res = createMockRes();

    getHistorySummary(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(typeof res.body.data.totalActivities === 'number');
    assert.ok(typeof res.body.data.allowedRequests === 'number');
    assert.ok(typeof res.body.data.deniedRequests === 'number');
    assert.ok(typeof res.body.data.securityAlerts === 'number');
  });

  it('Allowed simulation automatically generates access_allowed history via API', () => {
    const simReq = {
      body: {
        appId: 'app_01',
        resource: 'location',
        reason: 'HTTP test: allowed route',
        count: 1,
      },
    };
    const simRes = createMockRes();

    simulateEvents(simReq, simRes);

    assert.strictEqual(simRes.statusCode, 200);
    const eventId = simRes.body.data.events[0].id;

    // Verify history endpoint has this event
    const histReq = { query: { limit: 5 } };
    const histRes = createMockRes();
    getHistory(histReq, histRes);

    const match = histRes.body.data.find((h) => h.metadata?.eventId === eventId);
    assert.ok(match, 'History must contain the simulated event');
    assert.strictEqual(match.eventType, ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED);
  });

  it('Denied simulation automatically generates access_denied history via API', () => {
    const simReq = {
      body: {
        appId: 'app_01',
        resource: 'contacts',
        reason: 'HTTP test: denied contacts',
        count: 1,
      },
    };
    const simRes = createMockRes();

    simulateEvents(simReq, simRes);

    assert.strictEqual(simRes.statusCode, 200);
    const eventId = simRes.body.data.events[0].id;

    const histReq = { query: { limit: 5 } };
    const histRes = createMockRes();
    getHistory(histReq, histRes);

    const match = histRes.body.data.find((h) => h.metadata?.eventId === eventId);
    assert.ok(match, 'History must contain the denied event');
    assert.strictEqual(match.eventType, ACTIVITY_EVENT_TYPES.ACCESS_DENIED);
  });

  it('Permission PATCH automatically generates permission_revoked history via API', () => {
    const patchReq = {
      params: { id: 'app_01' },
      body: {
        resource: 'files',
        enabled: false,
      },
    };
    const patchRes = createMockRes();

    updateAppPermission(patchReq, patchRes);

    assert.strictEqual(patchRes.statusCode, 200);

    const histReq = { query: { limit: 5 } };
    const histRes = createMockRes();
    getHistory(histReq, histRes);

    const match = histRes.body.data.find(
      (h) =>
        h.appId === 'app_01' &&
        h.eventType === ACTIVITY_EVENT_TYPES.PERMISSION_REVOKED &&
        h.metadata.resource === 'files'
    );
    assert.ok(match, 'History must contain the permission_revoked record');
  });

  it('Status PATCH automatically generates app_suspended and app_reactivated history via API', () => {
    // Suspend
    const suspendReq = {
      params: { id: 'app_02' },
      body: { status: 'suspended' },
    };
    const suspendRes = createMockRes();

    updateAppStatus(suspendReq, suspendRes);
    assert.strictEqual(suspendRes.statusCode, 200);

    let histReq = { query: { limit: 5 } };
    let histRes = createMockRes();
    getHistory(histReq, histRes);

    let match = histRes.body.data.find(
      (h) => h.appId === 'app_02' && h.eventType === ACTIVITY_EVENT_TYPES.APP_SUSPENDED
    );
    assert.ok(match, 'History must contain app_suspended record');

    // Reactivate
    const reactivateReq = {
      params: { id: 'app_02' },
      body: { status: 'active' },
    };
    const reactivateRes = createMockRes();

    updateAppStatus(reactivateReq, reactivateRes);
    assert.strictEqual(reactivateRes.statusCode, 200);

    histReq = { query: { limit: 5 } };
    histRes = createMockRes();
    getHistory(histReq, histRes);

    match = histRes.body.data.find(
      (h) => h.appId === 'app_02' && h.eventType === ACTIVITY_EVENT_TYPES.APP_REACTIVATED
    );
    assert.ok(match, 'History must contain app_reactivated record');
  });
});
