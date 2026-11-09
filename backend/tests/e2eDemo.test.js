import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../store/index.js';
import { simulateEvents } from '../routes/events.js';
import { applyRecommendation } from '../services/permissionService.js';

function createMockReqRes({ body = {} } = {}) {
  let statusCode = 200;
  let jsonBody = null;

  const req = { body };
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

describe('E2E Demo Scenario (references/testing-checklist.md)', () => {
  beforeEach(() => {
    store.resetToSeed();
  });

  test('runs complete 7-step scenario matching exact scores (94 -> 79 -> 71 -> 63)', async () => {
    const T = new Date('2026-11-09T10:00:00.000Z').getTime();

    // Verify initial Fitness app (app_01) score is 94
    const initialApp = store.apps.find((a) => a.id === 'app_01');
    assert.equal(initialApp.trustScore, 94);

    // Step 1: location x3 at T
    const step1Req = createMockReqRes({
      body: {
        appId: 'app_01',
        resource: 'location',
        count: 3,
        startTime: new Date(T).toISOString(),
      },
    });
    await simulateEvents(step1Req.req, step1Req.res);
    const step1Res = step1Req.res.getBody();
    assert.equal(step1Res.success, true);
    assert.equal(step1Res.data.summary.allowed, 3);
    assert.equal(step1Res.data.alertsCreated.length, 0);
    assert.equal(step1Res.data.trustScore.score, 94);

    // Step 2: location x25 at T + 120s
    // 25 allowed; ONE excessive_access alert (high) fired at 11th event; requests 12-25 appended to it; score 79 (moderate); rec "Restrict location"
    const step2Req = createMockReqRes({
      body: {
        appId: 'app_01',
        resource: 'location',
        count: 25,
        startTime: new Date(T + 120000).toISOString(),
      },
    });
    await simulateEvents(step2Req.req, step2Req.res);
    const step2Res = step2Req.res.getBody();
    assert.equal(step2Res.success, true);
    assert.equal(step2Res.data.summary.allowed, 25);
    assert.equal(step2Res.data.alertsCreated.length, 1);
    assert.equal(step2Res.data.alertsCreated[0].type, 'excessive_access');
    assert.equal(step2Res.data.trustScore.score, 79);
    assert.equal(step2Res.data.trustScore.level, 'moderate');

    const restrictRec = store.recommendations.find(
      (r) => r.appId === 'app_01' && r.type === 'restrict_permission' && r.resource === 'location'
    );
    assert.ok(restrictRec, 'Restrict location recommendation should exist');
    assert.equal(restrictRec.status, 'pending');

    // Step 3: contacts x1 at T + 240s
    // denied (permission_disabled); unauthorized_resource alert (medium); score 71 (moderate); rec "Keep contacts disabled"
    const step3Req = createMockReqRes({
      body: {
        appId: 'app_01',
        resource: 'contacts',
        count: 1,
        startTime: new Date(T + 240000).toISOString(),
      },
    });
    await simulateEvents(step3Req.req, step3Req.res);
    const step3Res = step3Req.res.getBody();
    assert.equal(step3Res.success, true);
    assert.equal(step3Res.data.summary.denied, 1);
    assert.equal(step3Res.data.alertsCreated.length, 1);
    assert.equal(step3Res.data.alertsCreated[0].type, 'unauthorized_resource');
    assert.equal(step3Res.data.trustScore.score, 71);
    assert.equal(step3Res.data.trustScore.level, 'moderate');

    const keepDisabledRec = store.recommendations.find(
      (r) => r.appId === 'app_01' && r.type === 'keep_disabled' && r.resource === 'contacts'
    );
    assert.ok(keepDisabledRec);

    // Step 4: UI shows score explanation
    assert.ok(step3Res.data.trustScore.explanation.some((e) => e.includes('unauthorized_resource')));

    // Step 5: apply rec "Restrict location"
    // location.enabled = false; history permission_revoked + recommendation_applied
    const applyResult = applyRecommendation(restrictRec.id);
    assert.equal(applyResult.recommendation.status, 'applied');
    assert.equal(applyResult.app.permissions.location.enabled, false);

    // Step 6: location x1 at T + 300s
    // denied (permission_disabled), event recorded; new alert unauthorized_resource (resource location, medium); score 63 (moderate). R4 does NOT fire (only 2 denials in 5 min)
    const step6Req = createMockReqRes({
      body: {
        appId: 'app_01',
        resource: 'location',
        count: 1,
        startTime: new Date(T + 300000).toISOString(),
      },
    });
    await simulateEvents(step6Req.req, step6Req.res);
    const step6Res = step6Req.res.getBody();
    assert.equal(step6Res.success, true);
    assert.equal(step6Res.data.summary.denied, 1);
    assert.equal(step6Res.data.alertsCreated.length, 1);
    assert.equal(step6Res.data.alertsCreated[0].type, 'unauthorized_resource');
    assert.equal(step6Res.data.trustScore.score, 63);
    assert.equal(step6Res.data.trustScore.level, 'moderate');

    // Final checks
    const finalFitnessApp = store.apps.find((a) => a.id === 'app_01');
    assert.equal(finalFitnessApp.trustScore, 63);

    // 3 alerts created for app_01 during the scenario
    const appAlerts = store.alerts.filter((a) => a.appId === 'app_01');
    assert.equal(appAlerts.length, 3);
  });
});

