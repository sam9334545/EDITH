import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import store from '../store/index.js';
import historyService from '../services/historyService.js';
import permissionService from '../services/permissionService.js';
import accessPipeline from '../services/accessPipeline.js';
import recommendationService from '../services/recommendationService.js';
import { ACTIVITY_EVENT_TYPES, APPLICATION_STATUS } from '../../shared/contracts.js';

describe('Feature 7: Activity History (M3)', () => {
  beforeEach(() => {
    store.resetToSeed();
  });

  it('1. Allowed access creates a history entry', () => {
    const prevCount = store.history.length;
    // FitTrack has location enabled
    const res = accessPipeline.processAccessRequest({
      appId: 'app_01',
      resource: 'location',
      reason: 'GPS Route Tracking',
    });

    assert.strictEqual(res.event.status, 'allowed');
    assert.strictEqual(store.history.length, prevCount + 1);

    const latest = store.history[store.history.length - 1];
    assert.strictEqual(latest.appId, 'app_01');
    assert.strictEqual(latest.eventType, ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED);
    assert.strictEqual(latest.metadata.resource, 'location');
    assert.strictEqual(latest.metadata.eventId, res.event.id);
  });

  it('2. Denied access creates a history entry', () => {
    const prevCount = store.history.length;
    // FitTrack has contacts disabled
    const res = accessPipeline.processAccessRequest({
      appId: 'app_01',
      resource: 'contacts',
      reason: 'Sync contacts',
    });

    assert.strictEqual(res.event.status, 'denied');
    // Notice: unauthorized access to disabled permission also creates an unauthorized_resource alert
    // and may affect trust score and create a recommendation!
    const deniedHistory = store.history.find(
      (h) => h.metadata?.eventId === res.event.id && h.eventType === ACTIVITY_EVENT_TYPES.ACCESS_DENIED
    );
    assert.ok(deniedHistory, 'ACCESS_DENIED history entry must be present');
    assert.strictEqual(deniedHistory.appId, 'app_01');
    assert.strictEqual(deniedHistory.metadata.resource, 'contacts');
    assert.strictEqual(deniedHistory.metadata.denialReason, 'permission_disabled');
  });

  it('3. Permission changes are recorded (grant and revoke)', () => {
    // 3a: Grant permission
    permissionService.updatePermission('app_01', 'camera', true);
    const grantEntry = store.history[store.history.length - 1];
    assert.strictEqual(grantEntry.appId, 'app_01');
    assert.strictEqual(grantEntry.eventType, ACTIVITY_EVENT_TYPES.PERMISSION_GRANTED);
    assert.strictEqual(grantEntry.metadata.resource, 'camera');

    // 3b: Revoke permission
    permissionService.updatePermission('app_01', 'camera', false);
    const revokeEntry = store.history[store.history.length - 1];
    assert.strictEqual(revokeEntry.appId, 'app_01');
    assert.strictEqual(revokeEntry.eventType, ACTIVITY_EVENT_TYPES.PERMISSION_REVOKED);
    assert.strictEqual(revokeEntry.metadata.resource, 'camera');
  });

  it('4. App suspension and reactivation are recorded', () => {
    // 4a: Suspension
    permissionService.updateStatus('app_01', APPLICATION_STATUS.SUSPENDED);
    const suspendEntry = store.history[store.history.length - 1];
    assert.strictEqual(suspendEntry.appId, 'app_01');
    assert.strictEqual(suspendEntry.eventType, ACTIVITY_EVENT_TYPES.APP_SUSPENDED);
    assert.strictEqual(suspendEntry.metadata.previousStatus, 'active');

    // 4b: Reactivation
    permissionService.updateStatus('app_01', APPLICATION_STATUS.ACTIVE);
    const reactivateEntry = store.history[store.history.length - 1];
    assert.strictEqual(reactivateEntry.appId, 'app_01');
    assert.strictEqual(reactivateEntry.eventType, ACTIVITY_EVENT_TYPES.APP_REACTIVATED);
    assert.strictEqual(reactivateEntry.metadata.previousStatus, 'suspended');
  });

  it('5. Trust score changes are recorded', () => {
    // Request contacts (disabled) -> fires unauthorized_resource (medium: -8) -> score drops 94 -> 86
    accessPipeline.processAccessRequest({
      appId: 'app_01',
      resource: 'contacts',
      reason: 'Sync contacts',
    });

    const scoreChangeEntry = store.history.find(
      (h) => h.appId === 'app_01' && h.eventType === ACTIVITY_EVENT_TYPES.TRUST_SCORE_CHANGED
    );
    assert.ok(scoreChangeEntry, 'TRUST_SCORE_CHANGED history entry must be recorded');
    assert.strictEqual(scoreChangeEntry.metadata.previousScore, 94);
    assert.strictEqual(scoreChangeEntry.metadata.newScore, 86);
    assert.strictEqual(scoreChangeEntry.metadata.penalty, 8);
  });

  it('6. Recommendation creation and application are recorded', () => {
    // 6a: Create recommendation via alert (excessive access)
    // Send 11 requests in 60s
    const startTime = Date.now();
    for (let i = 0; i < 11; i++) {
      accessPipeline.processAccessRequest({
        appId: 'app_01',
        resource: 'location',
        reason: 'Route tracking',
        timestamp: new Date(startTime + i * 2000).toISOString(),
      });
    }

    const recCreatedEntry = store.history.find(
      (h) => h.appId === 'app_01' && h.eventType === ACTIVITY_EVENT_TYPES.RECOMMENDATION_CREATED
    );
    assert.ok(recCreatedEntry, 'RECOMMENDATION_CREATED history entry must be recorded');
    const recId = recCreatedEntry.metadata.recommendationId;
    assert.ok(recId);

    // 6b: Apply recommendation
    const result = recommendationService.applyRecommendation(recId);
    assert.strictEqual(result.recommendation.status, 'applied');

    const recAppliedEntry = store.history.find(
      (h) => h.metadata?.recommendationId === recId && h.eventType === ACTIVITY_EVENT_TYPES.RECOMMENDATION_APPLIED
    );
    assert.ok(recAppliedEntry, 'RECOMMENDATION_APPLIED history entry must be recorded');

    // Also verify that the suggested action (revoke_permission for location) recorded permission_revoked!
    const permRevokedEntry = store.history.find(
      (h) => h.appId === 'app_01' && h.eventType === ACTIVITY_EVENT_TYPES.PERMISSION_REVOKED && h.metadata.resource === 'location'
    );
    assert.ok(permRevokedEntry, 'PERMISSION_REVOKED should also be recorded when recommendation is applied');
  });

  it('7. Application and event-type filters work correctly', () => {
    // History has seed items for app_01, app_02, app_03
    const app01History = historyService.getHistory({ appId: 'app_01' });
    assert.strictEqual(app01History.success, true);
    assert.ok(app01History.data.length > 0);
    assert.ok(app01History.data.every((h) => h.appId === 'app_01'));

    const accessAllowedOnly = historyService.getHistory({ type: ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED });
    assert.strictEqual(accessAllowedOnly.success, true);
    assert.ok(accessAllowedOnly.data.length > 0);
    assert.ok(accessAllowedOnly.data.every((h) => h.eventType === ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED));

    // Combined filter
    const app01AccessAllowed = historyService.getHistory({
      appId: 'app_01',
      eventType: ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED,
    });
    assert.strictEqual(app01AccessAllowed.success, true);
    assert.ok(app01AccessAllowed.data.every((h) => h.appId === 'app_01' && h.eventType === ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED));

    // Invalid eventType returns validation error
    const invalidType = historyService.getHistory({ type: 'invalid_type_abc' });
    assert.strictEqual(invalidType.success, false);
    assert.strictEqual(invalidType.error.code, 'VALIDATION_ERROR');
  });

  it('8. Limit parameter works correctly', () => {
    const limit3 = historyService.getHistory({ limit: 3 });
    assert.strictEqual(limit3.success, true);
    assert.strictEqual(limit3.data.length, 3);

    // Invalid limit returns validation error
    const invalidLimit = historyService.getHistory({ limit: -5 });
    assert.strictEqual(invalidLimit.success, false);
    assert.strictEqual(invalidLimit.error.code, 'VALIDATION_ERROR');

    const nonNumberLimit = historyService.getHistory({ limit: 'abc' });
    assert.strictEqual(nonNumberLimit.success, false);
    assert.strictEqual(nonNumberLimit.error.code, 'VALIDATION_ERROR');
  });

  it('9. Activities appear newest first', () => {
    const result = historyService.getHistory({ limit: 50 });
    assert.strictEqual(result.success, true);
    const data = result.data;

    for (let i = 0; i < data.length - 1; i++) {
      const current = new Date(data[i].timestamp).getTime();
      const next = new Date(data[i + 1].timestamp).getTime();
      assert.ok(
        current >= next,
        `Activity at index ${i} (${data[i].timestamp}) must be newer or equal to ${data[i + 1].timestamp}`
      );
    }
  });

  it('10. No duplicate history entries for same action / idempotency', () => {
    // Re-applying an already applied recommendation does not create duplicate history
    // Seed has rec_0001
    const res1 = recommendationService.applyRecommendation('rec_0001');
    const countAfterFirst = store.history.length;

    const res2 = recommendationService.applyRecommendation('rec_0001');
    const countAfterSecond = store.history.length;
    assert.strictEqual(countAfterSecond, countAfterFirst, 'Re-applying recommendation should not add duplicate history');

    // Setting same permission state does not create duplicate history
    permissionService.updatePermission('app_01', 'location', true); // already true
    const countAfterSamePerm = store.history.length;
    assert.strictEqual(countAfterSamePerm, countAfterFirst, 'Redundant permission update should not add duplicate history');
  });
});
