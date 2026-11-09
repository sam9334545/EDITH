import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALERT_TYPES,
  RECOMMENDATION_TYPES,
  RECOMMENDATION_STATUS,
  SUGGESTED_ACTIONS,
  ACTIVITY_EVENT_TYPES,
} from '../../shared/contracts.js';
import { store } from '../store/index.js';
import { generateRecommendations } from '../services/recommendations.js';
import { applyRecommendation } from '../services/permissionService.js';
import { getRecommendations, applyRecommendationHandler } from '../routes/recommendations.js';

function createMockReqRes({ params = {}, query = {}, body = {} } = {}) {
  let statusCode = 200;
  let jsonBody = null;

  const req = { params, query, body };
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

describe('M4 & M2 - Recommendations Feature', () => {
  beforeEach(() => {
    store.resetToSeed();
  });

  describe('M4: generateRecommendations', () => {
    test('maps excessive_access to restrict_permission and revoke_permission', () => {
      const app = store.apps[0]; // app_01 FitTrack
      const alerts = [
        {
          id: 'alt_0001',
          appId: 'app_01',
          type: ALERT_TYPES.EXCESSIVE_ACCESS,
          resource: 'location',
          timestamp: '2026-11-09T10:00:22.000Z',
        },
      ];

      const recs = generateRecommendations(app, alerts);
      assert.equal(recs.length, 1);
      const rec = recs[0];
      assert.equal(rec.id, 'rec_0002'); // seed has rec_0001
      assert.equal(rec.appId, 'app_01');
      assert.equal(rec.type, RECOMMENDATION_TYPES.RESTRICT_PERMISSION);
      assert.equal(rec.suggestedAction, SUGGESTED_ACTIONS.REVOKE_PERMISSION);
      assert.equal(rec.resource, 'location');
      assert.equal(rec.title, 'Restrict location');
      assert.equal(rec.status, RECOMMENDATION_STATUS.PENDING);
      assert.equal(rec.alertId, 'alt_0001');

      // Verify stored in central store
      assert.ok(store.recommendations.some((r) => r.id === rec.id));
    });

    test('maps unauthorized_resource to keep_disabled with suggestedAction none', () => {
      const app = store.apps[0];
      const alerts = [
        {
          id: 'alt_0002',
          appId: 'app_01',
          type: ALERT_TYPES.UNAUTHORIZED_RESOURCE,
          resource: 'contacts',
          timestamp: '2026-11-09T10:02:00.000Z',
        },
      ];

      const recs = generateRecommendations(app, alerts);
      assert.equal(recs.length, 1);
      const rec = recs[0];
      assert.equal(rec.type, RECOMMENDATION_TYPES.KEEP_DISABLED);
      assert.equal(rec.suggestedAction, SUGGESTED_ACTIONS.NONE);
      assert.equal(rec.title, 'Keep contacts disabled');
    });

    test('maps suspended_app_access to review_permission', () => {
      const app = store.apps[0];
      const alerts = [
        {
          id: 'alt_0003',
          appId: 'app_01',
          type: ALERT_TYPES.SUSPENDED_APP_ACCESS,
          timestamp: '2026-11-09T10:03:00.000Z',
        },
      ];

      const recs = generateRecommendations(app, alerts);
      assert.equal(recs.length, 1);
      const rec = recs[0];
      assert.equal(rec.type, RECOMMENDATION_TYPES.REVIEW_PERMISSION);
      assert.equal(rec.suggestedAction, SUGGESTED_ACTIONS.NONE);
      assert.equal(rec.title, 'Review the app');
    });

    test('maps repeated_restricted_access and unusual_resource_combination to suspend_app', () => {
      const app = store.apps[0];
      const alerts = [
        {
          id: 'alt_0004',
          appId: 'app_01',
          type: ALERT_TYPES.REPEATED_RESTRICTED_ACCESS,
          timestamp: '2026-11-09T10:04:00.000Z',
        },
      ];

      const recs = generateRecommendations(app, alerts);
      assert.equal(recs.length, 1);
      const rec = recs[0];
      assert.equal(rec.type, RECOMMENDATION_TYPES.SUSPEND_APP);
      assert.equal(rec.suggestedAction, SUGGESTED_ACTIONS.SUSPEND_APP);
      assert.equal(rec.title, 'Suspend or investigate the app');
    });

    test('deduplicates: does not create duplicate pending recommendation for same app, type, resource', () => {
      const app = store.apps[0];
      const alerts1 = [
        {
          id: 'alt_0001',
          appId: 'app_01',
          type: ALERT_TYPES.EXCESSIVE_ACCESS,
          resource: 'location',
        },
      ];
      const recs1 = generateRecommendations(app, alerts1);
      assert.equal(recs1.length, 1);

      // Repeat with another alert of same type and resource
      const alerts2 = [
        {
          id: 'alt_0005',
          appId: 'app_01',
          type: ALERT_TYPES.EXCESSIVE_ACCESS,
          resource: 'location',
        },
      ];
      const recs2 = generateRecommendations(app, alerts2);
      assert.equal(recs2.length, 0); // Skipped due to duplicate pending
    });
  });

  describe('M2: applyRecommendation', () => {
    test('throws RECOMMENDATION_NOT_FOUND for non-existent ID', () => {
      assert.throws(
        () => applyRecommendation('rec_nonexistent'),
        (err) => err.code === 'RECOMMENDATION_NOT_FOUND'
      );
    });

    test('applies revoke_permission: disables permission, updates app, logs history', () => {
      const app = store.apps[0];
      assert.equal(app.permissions.location.enabled, true);

      // Seed already has rec_0001 for app_03, let's create a revoke rec for app_01
      const [rec] = generateRecommendations(app, [
        {
          id: 'alt_0001',
          appId: 'app_01',
          type: ALERT_TYPES.EXCESSIVE_ACCESS,
          resource: 'location',
        },
      ]);

      const result = applyRecommendation(rec.id);
      assert.equal(result.recommendation.status, RECOMMENDATION_STATUS.APPLIED);
      assert.equal(result.app.permissions.location.enabled, false);

      // Verify activity history logged
      const history = store.history;
      const permRevoked = history.find(
        (h) => h.eventType === ACTIVITY_EVENT_TYPES.PERMISSION_REVOKED && h.metadata.resource === 'location'
      );
      assert.ok(permRevoked);
      const recApplied = history.find(
        (h) => h.eventType === ACTIVITY_EVENT_TYPES.RECOMMENDATION_APPLIED && h.metadata.recommendationId === rec.id
      );
      assert.ok(recApplied);
    });

    test('applies suspend_app: sets status to suspended, logs history', () => {
      const app = store.apps[1]; // ShopEasy
      const [rec] = generateRecommendations(app, [
        {
          id: 'alt_0010',
          appId: 'app_02',
          type: ALERT_TYPES.UNUSUAL_RESOURCE_COMBINATION,
        },
      ]);

      const result = applyRecommendation(rec.id);
      assert.equal(result.recommendation.status, RECOMMENDATION_STATUS.APPLIED);
      assert.equal(result.app.status, 'suspended');

      const appSuspended = store.history.find(
        (h) => h.eventType === ACTIVITY_EVENT_TYPES.APP_SUSPENDED && h.appId === 'app_02'
      );
      assert.ok(appSuspended);
    });

    test('is idempotent: re-applying returns current state without re-executing', () => {
      const app = store.apps[0];
      const [rec] = generateRecommendations(app, [
        {
          id: 'alt_0001',
          appId: 'app_01',
          type: ALERT_TYPES.EXCESSIVE_ACCESS,
          resource: 'location',
        },
      ]);

      const res1 = applyRecommendation(rec.id);
      const historyLen = store.history.length;

      const res2 = applyRecommendation(rec.id);
      assert.equal(res2.recommendation.status, RECOMMENDATION_STATUS.APPLIED);
      assert.equal(store.history.length, historyLen); // No extra history added
    });
  });

  describe('M4: Route Handlers', () => {
    test('GET /api/security/recommendations/:appId returns recommendations', async () => {
      // Seed data has rec_0001 for app_03
      const { req, res } = createMockReqRes({ params: { appId: 'app_03' } });
      await getRecommendations(req, res);

      assert.equal(res.getStatusCode(), 200);
      const body = res.getBody();
      assert.equal(body.success, true);
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].id, 'rec_0001');
    });

    test('POST /api/security/recommendations/:id/apply applies recommendation via route', async () => {
      const { req, res } = createMockReqRes({ params: { id: 'rec_0001' } });
      await applyRecommendationHandler(req, res);

      assert.equal(res.getStatusCode(), 200);
      const body = res.getBody();
      assert.equal(body.success, true);
      assert.equal(body.data.recommendation.status, RECOMMENDATION_STATUS.APPLIED);
    });

    test('POST /api/security/recommendations/:id/apply returns 404 for unknown recommendation', async () => {
      const { req, res } = createMockReqRes({ params: { id: 'rec_9999' } });
      await applyRecommendationHandler(req, res);

      assert.equal(res.getStatusCode(), 404);
      const body = res.getBody();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'RECOMMENDATION_NOT_FOUND');
    });
  });
});

