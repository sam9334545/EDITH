import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { raspMiddleware, createRaspMiddleware } from '../middleware/raspMiddleware.js';
import { store } from '../store/index.js';
import { ACTIVITY_EVENT_TYPES } from '../../shared/contracts.js';

function createMockReqRes({ method = 'POST', path = '/api/events/simulate', body = {}, query = {}, params = {} } = {}) {
  let statusCode = 200;
  let headers = {};
  let jsonBody = null;
  let nextCalled = false;

  const req = { method, path, originalUrl: path, url: path, body, query, params };
  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    set(header, value) {
      headers[header] = value;
      return res;
    },
    json(data) {
      jsonBody = data;
      return res;
    },
    getStatusCode: () => statusCode,
    getBody: () => jsonBody,
    getHeaders: () => headers,
  };
  const next = () => {
    nextCalled = true;
  };

  return { req, res, next, isNextCalled: () => nextCalled };
}

describe('RASP Middleware Direct Unit Tests', () => {
  beforeEach(() => {
    store.resetToSeed();
  });

  test('allows benign traffic through without blocking or side effects', () => {
    const { req, res, next, isNextCalled } = createMockReqRes({
      body: { appId: 'app_01', resource: 'location', reason: 'Normal jogging route tracking' },
    });

    raspMiddleware(req, res, next);
    assert.equal(isNextCalled(), true);
    assert.equal(res.getStatusCode(), 200);
    assert.equal(res.getBody(), null);
  });

  test('blocks SQL injection in req.body with 403 and fail("RASP_VIOLATION")', () => {
    const { req, res, next, isNextCalled } = createMockReqRes({
      body: { appId: 'app_01', resource: 'location', reason: "' OR 1=1 --" },
    });

    raspMiddleware(req, res, next);
    assert.equal(isNextCalled(), false);
    assert.equal(res.getStatusCode(), 403);

    const body = res.getBody();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'RASP_VIOLATION');
    assert.ok(res.getHeaders()['X-RASP-Violation-Id']);
  });

  test('blocks SQL injection in req.query with 403', () => {
    const { req, res, next, isNextCalled } = createMockReqRes({
      method: 'GET',
      path: '/api/events',
      query: { resource: "location' UNION SELECT null, null, null--" },
    });

    raspMiddleware(req, res, next);
    assert.equal(isNextCalled(), false);
    assert.equal(res.getStatusCode(), 403);
    assert.equal(res.getBody().error.code, 'RASP_VIOLATION');
  });

  test('blocks path traversal in URL and body with 403', () => {
    const { req, res, next, isNextCalled } = createMockReqRes({
      method: 'GET',
      path: '/api/apps/../../etc/passwd',
    });

    raspMiddleware(req, res, next);
    assert.equal(isNextCalled(), false);
    assert.equal(res.getStatusCode(), 403);
    assert.equal(res.getBody().error.code, 'RASP_VIOLATION');
  });

  test('blocks command injection in req.body with 403', () => {
    const { req, res, next, isNextCalled } = createMockReqRes({
      body: { appId: 'app_01', resource: 'location', reason: 'test; cat /etc/passwd' },
    });

    raspMiddleware(req, res, next);
    assert.equal(isNextCalled(), false);
    assert.equal(res.getStatusCode(), 403);
    assert.equal(res.getBody().error.code, 'RASP_VIOLATION');
  });

  test('logs violation to historyService with ACCESS_DENIED and ALERT_CREATED for high severity', () => {
    const initialHistoryLength = store.history.length;
    const { req, res, next } = createMockReqRes({
      body: { appId: 'app_01', resource: 'location', reason: "'; DROP TABLE users; --" },
    });

    raspMiddleware(req, res, next);

    assert.ok(store.history.length > initialHistoryLength);
    const deniedEntry = store.history.find(
      (h) => h.eventType === ACTIVITY_EVENT_TYPES.ACCESS_DENIED && h.metadata?.source === 'rasp'
    );
    assert.ok(deniedEntry, 'ACCESS_DENIED history entry must be logged');

    const alertEntry = store.history.find(
      (h) => h.eventType === ACTIVITY_EVENT_TYPES.ALERT_CREATED && h.metadata?.source === 'rasp'
    );
    assert.ok(alertEntry, 'ALERT_CREATED history entry must be logged for critical/high severity');
  });

  test('penalizes app trust score when request is attributed to a valid app', () => {
    const appBefore = store.getApp('app_01');
    const initialScore = appBefore.trustScore;

    // Use zero cooldown for predictable testing
    const strictRasp = createRaspMiddleware({ penaltyCooldownMs: 0 });
    const { req, res, next } = createMockReqRes({
      body: { appId: 'app_01', resource: 'location', reason: 'test; whoami' },
    });

    strictRasp(req, res, next);
    assert.equal(res.getStatusCode(), 403);

    const appAfter = store.getApp('app_01');
    assert.ok(appAfter.trustScore < initialScore, `Expected ${appAfter.trustScore} < ${initialScore}`);
  });
});

