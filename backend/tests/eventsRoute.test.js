import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../store/index.js';
import { getEvents, simulateEvents } from '../routes/events.js';

// Helper to mock Express req and res
function createMockReqRes({ query = {}, body = {} } = {}) {
  let statusCode = 200;
  let jsonBody = null;

  const req = { query, body };
  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      jsonBody = data;
      return res;
    },
    getStatusCode: () => statusCode,
    getBody: () => jsonBody,
  };

  return { req, res };
}

describe('M3 - events routes & controllers', () => {
  beforeEach(() => {
    store.resetToSeed();
  });

  describe('GET /api/events', () => {
    test('returns seeded events sorted newest first with success envelope', async () => {
      const { req, res } = createMockReqRes();
      await getEvents(req, res);

      assert.equal(res.getStatusCode(), 200);
      const body = res.getBody();
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data));
      assert.equal(body.data.length, 5);

      // Verify newest first
      for (let i = 0; i < body.data.length - 1; i++) {
        const t1 = new Date(body.data[i].timestamp).getTime();
        const t2 = new Date(body.data[i + 1].timestamp).getTime();
        assert.ok(t1 >= t2, `Expected ${t1} >= ${t2}`);
      }
    });

    test('filters by appId', async () => {
      const { req, res } = createMockReqRes({ query: { appId: 'app_01' } });
      await getEvents(req, res);

      const body = res.getBody();
      assert.equal(body.success, true);
      assert.equal(body.data.length, 3);
      assert.ok(body.data.every((e) => e.appId === 'app_01'));
    });

    test('filters by resource', async () => {
      const { req, res } = createMockReqRes({ query: { resource: 'camera' } });
      await getEvents(req, res);

      const body = res.getBody();
      assert.equal(body.success, true);
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].resource, 'camera');
    });

    test('filters by status and suspicious', async () => {
      const { req, res } = createMockReqRes({ query: { status: 'allowed', suspicious: 'false' } });
      await getEvents(req, res);

      const body = res.getBody();
      assert.equal(body.success, true);
      assert.equal(body.data.length, 5);
      assert.ok(body.data.every((e) => e.status === 'allowed' && e.suspicious === false));
    });

    test('respects limit query param (custom limit and max 200)', async () => {
      const { req, res } = createMockReqRes({ query: { limit: '2' } });
      await getEvents(req, res);

      const body = res.getBody();
      assert.equal(body.success, true);
      assert.equal(body.data.length, 2);
    });
  });

  describe('POST /api/events/simulate', () => {
    test('validates missing required payload fields', async () => {
      const { req, res } = createMockReqRes({ body: {} });
      await simulateEvents(req, res);

      assert.equal(res.getStatusCode(), 400);
      const body = res.getBody();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    });

    test('validates invalid resource', async () => {
      const { req, res } = createMockReqRes({
        body: { appId: 'app_01', resource: 'unsupported' },
      });
      await simulateEvents(req, res);

      assert.equal(res.getStatusCode(), 400);
      const body = res.getBody();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    });

    test('validates non-existent appId', async () => {
      const { req, res } = createMockReqRes({
        body: { appId: 'app_unknown', resource: 'location', count: 1 },
      });
      await simulateEvents(req, res);

      assert.equal(res.getStatusCode(), 404);
      const body = res.getBody();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'APP_NOT_FOUND');
    });

    test('simulates count=3 requests spaced 2 seconds apart', async () => {
      const startTime = '2026-11-09T10:00:00.000Z';
      const { req, res } = createMockReqRes({
        body: {
          appId: 'app_01',
          resource: 'location',
          reason: 'Background simulation test',
          count: 3,
          startTime,
        },
      });

      await simulateEvents(req, res);

      assert.equal(res.getStatusCode(), 200);
      const body = res.getBody();
      assert.equal(body.success, true);

      const { events, summary, app, trustScore } = body.data;
      assert.equal(events.length, 3);
      assert.deepEqual(summary, { total: 3, allowed: 3, denied: 0 });
      assert.equal(app.id, 'app_01');
      assert.equal(trustScore.appId, 'app_01');

      // Verify timestamps spaced 2000 ms apart
      assert.equal(events[0].timestamp, '2026-11-09T10:00:00.000Z');
      assert.equal(events[1].timestamp, '2026-11-09T10:00:02.000Z');
      assert.equal(events[2].timestamp, '2026-11-09T10:00:04.000Z');

      // Verify IDs generated and formatted
      assert.equal(events[0].id, 'evt_0006');
      assert.equal(events[1].id, 'evt_0007');
      assert.equal(events[2].id, 'evt_0008');

      // Verify pushed to central store
      assert.equal(store.events.length, 5 + 3);
    });

    test('simulates denied request when resource is not enabled', async () => {
      const { req, res } = createMockReqRes({
        body: {
          appId: 'app_01',
          resource: 'contacts',
          reason: 'Accessing disabled contacts',
          count: 1,
        },
      });

      await simulateEvents(req, res);

      assert.equal(res.getStatusCode(), 200);
      const body = res.getBody();
      assert.equal(body.success, true);
      assert.deepEqual(body.data.summary, { total: 1, allowed: 0, denied: 1 });
      assert.equal(body.data.events[0].status, 'denied');
      assert.equal(body.data.events[0].denialReason, 'permission_disabled');
    });
  });
});

