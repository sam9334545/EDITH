import { describe, it } from 'node:test';
import assert from 'node:assert';
import store from '../store/index.js';
import accessPipeline from '../services/accessPipeline.js';
import recommendationService from '../services/recommendationService.js';
import historyService from '../services/historyService.js';
import { ACTIVITY_EVENT_TYPES } from '../../shared/contracts.js';

describe('E2E Demo Scenario & Activity History Audit Trail', () => {
  it('Executes the 7-step scenario and validates exact scores and activity history audit trail', () => {
    store.resetToSeed();
    const T = Date.parse('2026-11-09T10:00:00.000Z');

    // Step 1: location x3 at T
    for (let i = 0; i < 3; i++) {
      accessPipeline.processAccessRequest({
        appId: 'app_01',
        resource: 'location',
        reason: 'Workout tracking',
        timestamp: new Date(T + i * 2000).toISOString(),
      });
    }
    let app = store.findAppById('app_01');
    assert.strictEqual(app.trustScore, 94);
    assert.strictEqual(store.alerts.filter((a) => a.appId === 'app_01').length, 0);

    // Step 2: location x25 at T+120s
    const T2 = T + 120000;
    for (let i = 0; i < 25; i++) {
      accessPipeline.processAccessRequest({
        appId: 'app_01',
        resource: 'location',
        reason: 'Workout tracking',
        timestamp: new Date(T2 + i * 2000).toISOString(),
      });
    }
    app = store.findAppById('app_01');
    assert.strictEqual(app.trustScore, 79, 'Fitness score should drop from 94 to 79 after excessive_access alert');
    const alertsAfterStep2 = store.alerts.filter((a) => a.appId === 'app_01');
    assert.strictEqual(alertsAfterStep2.length, 1);
    assert.strictEqual(alertsAfterStep2[0].type, 'excessive_access');

    // Step 3: contacts x1 at T+240s
    const T3 = T + 240000;
    const step3Res = accessPipeline.processAccessRequest({
      appId: 'app_01',
      resource: 'contacts',
      reason: 'Sync contacts',
      timestamp: new Date(T3).toISOString(),
    });
    assert.strictEqual(step3Res.event.status, 'denied');
    app = store.findAppById('app_01');
    assert.strictEqual(app.trustScore, 71, 'Fitness score should drop from 79 to 71 after unauthorized_resource alert');
    const alertsAfterStep3 = store.alerts.filter((a) => a.appId === 'app_01');
    assert.strictEqual(alertsAfterStep3.length, 2);

    // Step 5: apply recommendation "Restrict location"
    const rec = store.recommendations.find(
      (r) => r.appId === 'app_01' && r.resource === 'location' && r.status === 'pending'
    );
    assert.ok(rec, 'Pending recommendation for location should exist');
    recommendationService.applyRecommendation(rec.id);
    app = store.findAppById('app_01');
    assert.strictEqual(app.permissions.location.enabled, false, 'Location should now be revoked');

    // Step 6: location x1 at T+300s
    const T4 = T + 300000;
    const step6Res = accessPipeline.processAccessRequest({
      appId: 'app_01',
      resource: 'location',
      reason: 'Workout tracking',
      timestamp: new Date(T4).toISOString(),
    });
    assert.strictEqual(step6Res.event.status, 'denied');
    app = store.findAppById('app_01');
    assert.strictEqual(app.trustScore, 63, 'Final Fitness score should be 63');
    const alertsAfterStep6 = store.alerts.filter((a) => a.appId === 'app_01');
    assert.strictEqual(alertsAfterStep6.length, 3, 'Should have exactly 3 alerts');

    // Step 7: Validate GET /api/history
    const historyRes = historyService.getHistory({ appId: 'app_01', limit: 100 });
    assert.strictEqual(historyRes.success, true);
    const history = historyRes.data;

    const alertCreatedEvents = history.filter((h) => h.eventType === ACTIVITY_EVENT_TYPES.ALERT_CREATED);
    const scoreChangedEvents = history.filter((h) => h.eventType === ACTIVITY_EVENT_TYPES.TRUST_SCORE_CHANGED);
    const permRevokedEvents = history.filter((h) => h.eventType === ACTIVITY_EVENT_TYPES.PERMISSION_REVOKED);
    const recAppliedEvents = history.filter((h) => h.eventType === ACTIVITY_EVENT_TYPES.RECOMMENDATION_APPLIED);
    const deniedEvents = history.filter((h) => h.eventType === ACTIVITY_EVENT_TYPES.ACCESS_DENIED);
    const allowedEvents = history.filter((h) => h.eventType === ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED);

    assert.strictEqual(alertCreatedEvents.length, 3, 'Should have exactly 3 alert_created history entries');
    assert.strictEqual(scoreChangedEvents.length, 3, 'Should have exactly 3 trust_score_changed history entries');
    assert.ok(permRevokedEvents.length >= 1, 'Should have permission_revoked history entry');
    assert.ok(recAppliedEvents.length >= 1, 'Should have recommendation_applied history entry');
    assert.strictEqual(deniedEvents.length, 2, 'Should have exactly 2 denied access events');
    assert.strictEqual(allowedEvents.length, 28 + 1, 'Should have 28 new allowed access events + 1 initial seed');
  });
});
