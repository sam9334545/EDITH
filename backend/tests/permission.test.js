// Automated Tests for E.D.I.T.H. Feature 1: Centralized Permission Management
import { describe, it, beforeEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../store/index.js';
import * as permissionService from '../services/permissionService.js';
import { processAccessRequest } from '../services/accessPipeline.js';
import {
  RESOURCE_TYPES,
  APPLICATION_STATUS,
  ACCESS_STATUS,
  ACTIVITY_EVENT_TYPES,
} from '../../shared/contracts.js';
import app from '../test-support/inMemoryApp.js';

describe('Feature 1: Centralized Permission Management', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    // Reset to deterministic seed before every test
    store.resetToSeed();
  });

  describe('Pure checkPermission Unit Tests', () => {
    it('returns ok for an active app with enabled permission', () => {
      const appData = store.getApp('app_01'); // location is enabled
      const decision = permissionService.checkPermission(appData, 'location');
      assert.deepEqual(decision, { allowed: true, reason: 'ok' });
    });

    it('returns permission_disabled for an active app with disabled permission', () => {
      const appData = store.getApp('app_01'); // contacts is disabled
      const decision = permissionService.checkPermission(appData, 'contacts');
      assert.deepEqual(decision, { allowed: false, reason: 'permission_disabled' });
    });

    it('returns app_suspended for a suspended app even if permission is enabled', () => {
      const appData = {
        ...store.getApp('app_01'),
        status: APPLICATION_STATUS.SUSPENDED,
      };
      // location is enabled, but app is suspended
      const decision = permissionService.checkPermission(appData, 'location');
      assert.deepEqual(decision, { allowed: false, reason: 'app_suspended' });
    });

    it('returns resource_invalid for an unsupported resource type', () => {
      const appData = store.getApp('app_01');
      const decision = permissionService.checkPermission(appData, 'social_media');
      assert.deepEqual(decision, { allowed: false, reason: 'resource_invalid' });
    });

    it('does not mutate the application object', () => {
      const appData = store.getApp('app_01');
      const cloned = JSON.parse(JSON.stringify(appData));
      permissionService.checkPermission(appData, 'location');
      permissionService.checkPermission(appData, 'contacts');
      assert.deepEqual(appData, cloned);
    });
  });

  describe('API 1: GET /api/apps (Application Retrieval)', () => {
    it('returns all registered applications with 200 OK', async () => {
      const res = await fetch(`${baseUrl}/api/apps`);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.message, 'Applications retrieved successfully');
      assert.ok(Array.isArray(json.data));
      assert.ok(json.data.length >= 3);
    });

    it('every application contains all five resources with enabled, grantedAt, and lastAccessedAt', async () => {
      const res = await fetch(`${baseUrl}/api/apps`);
      const { data: apps } = await res.json();

      for (const appItem of apps) {
        assert.ok(appItem.id);
        assert.ok(appItem.name);
        assert.ok(appItem.status);
        assert.equal(typeof appItem.trustScore, 'number');
        assert.ok(appItem.trustLevel);
        assert.ok(appItem.permissions);

        const permKeys = Object.keys(appItem.permissions);
        assert.equal(permKeys.length, 5);
        for (const resource of RESOURCE_TYPES) {
          const perm = appItem.permissions[resource];
          assert.ok(perm, `App ${appItem.id} is missing resource ${resource}`);
          assert.equal(typeof perm.enabled, 'boolean');
          assert.ok(perm.grantedAt === null || typeof perm.grantedAt === 'string');
          assert.ok(perm.lastAccessedAt === null || typeof perm.lastAccessedAt === 'string');
        }
      }
    });

    it('GET request does not mutate application state', async () => {
      const stateBefore = JSON.stringify(store.getState());
      await fetch(`${baseUrl}/api/apps`);
      const stateAfter = JSON.stringify(store.getState());
      assert.equal(stateBefore, stateAfter);
    });
  });

  describe('API 2: GET /api/apps/:id', () => {
    it('returns 200 and the correct app by ID', async () => {
      const res = await fetch(`${baseUrl}/api/apps/app_01`);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.id, 'app_01');
      assert.equal(json.data.name, 'FitTrack (Fitness App)');
      assert.equal(json.data.trustScore, 94);
      assert.equal(json.data.status, 'active');
      assert.equal(json.data.permissions.location.enabled, true);
    });

    it('returns 404 APP_NOT_FOUND for nonexistent ID', async () => {
      const res = await fetch(`${baseUrl}/api/apps/app_999`);
      assert.equal(res.status, 404);

      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'APP_NOT_FOUND');
      assert.equal(json.error.message, 'Application not found');
    });

    it('GET by ID does not mutate application state', async () => {
      const stateBefore = JSON.stringify(store.getState());
      await fetch(`${baseUrl}/api/apps/app_01`);
      const stateAfter = JSON.stringify(store.getState());
      assert.equal(stateBefore, stateAfter);
    });
  });

  describe('API 3: PATCH /api/apps/:id/permissions (Granting & Revoking)', () => {
    it('grants a disabled permission, updates grantedAt, preserves lastAccessedAt and other fields', async () => {
      const appBefore = store.getApp('app_01');
      assert.equal(appBefore.permissions.contacts.enabled, false);
      assert.equal(appBefore.permissions.contacts.grantedAt, null);
      assert.equal(appBefore.permissions.contacts.lastAccessedAt, null);

      const res = await fetch(`${baseUrl}/api/apps/app_01/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'contacts', enabled: true }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.message, 'Permission updated successfully');

      const updated = json.data;
      assert.equal(updated.permissions.contacts.enabled, true);
      assert.ok(typeof updated.permissions.contacts.grantedAt === 'string');
      assert.equal(updated.permissions.contacts.lastAccessedAt, null);

      // Verify other permissions remained unchanged
      assert.equal(updated.permissions.location.enabled, appBefore.permissions.location.enabled);
      assert.equal(updated.permissions.location.grantedAt, appBefore.permissions.location.grantedAt);
      assert.equal(updated.permissions.camera.enabled, appBefore.permissions.camera.enabled);
      assert.equal(updated.permissions.microphone.enabled, appBefore.permissions.microphone.enabled);
      assert.equal(updated.permissions.files.enabled, appBefore.permissions.files.enabled);

      // Verify trust score and status preserved
      assert.equal(updated.trustScore, 94);
      assert.equal(updated.status, 'active');

      // Verify history recorded
      const history = store.getHistory({ appId: 'app_01' });
      assert.equal(history[0].eventType, ACTIVITY_EVENT_TYPES.PERMISSION_GRANTED);
      assert.equal(history[0].metadata.resource, 'contacts');
    });

    it('revokes an enabled permission, preserves historical grantedAt and lastAccessedAt', async () => {
      const appBefore = store.getApp('app_01');
      assert.equal(appBefore.permissions.location.enabled, true);
      const originalGrantedAt = appBefore.permissions.location.grantedAt;
      const originalLastAccessedAt = appBefore.permissions.location.lastAccessedAt;
      assert.ok(originalGrantedAt !== null);

      const res = await fetch(`${baseUrl}/api/apps/app_01/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'location', enabled: false }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);

      const updated = json.data;
      assert.equal(updated.permissions.location.enabled, false);
      // Historical grantedAt preserved
      assert.equal(updated.permissions.location.grantedAt, originalGrantedAt);
      // lastAccessedAt preserved
      assert.equal(updated.permissions.location.lastAccessedAt, originalLastAccessedAt);

      // Other permissions preserved
      assert.equal(updated.permissions.files.enabled, true);
      assert.equal(updated.permissions.contacts.enabled, false);

      // Trust score and status preserved
      assert.equal(updated.trustScore, 94);
      assert.equal(updated.status, 'active');

      // Verify history recorded
      const history = store.getHistory({ appId: 'app_01' });
      assert.equal(history[0].eventType, ACTIVITY_EVENT_TYPES.PERMISSION_REVOKED);
      assert.equal(history[0].metadata.resource, 'location');
    });

    it('rejects invalid resource type with 400 RESOURCE_INVALID', async () => {
      const res = await fetch(`${baseUrl}/api/apps/app_01/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'social_media', enabled: true }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'RESOURCE_INVALID');
    });

    it('rejects missing resource field with 400 VALIDATION_ERROR', async () => {
      const res = await fetch(`${baseUrl}/api/apps/app_01/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'VALIDATION_ERROR');
    });

    it('rejects non-boolean enabled with 400 VALIDATION_ERROR', async () => {
      const res = await fetch(`${baseUrl}/api/apps/app_01/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'camera', enabled: 'true' }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'VALIDATION_ERROR');
    });

    it('rejects missing enabled with 400 VALIDATION_ERROR', async () => {
      const res = await fetch(`${baseUrl}/api/apps/app_01/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'camera' }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'VALIDATION_ERROR');
    });

    it('rejects empty request body with 400 VALIDATION_ERROR', async () => {
      const res = await fetch(`${baseUrl}/api/apps/app_01/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'VALIDATION_ERROR');
    });

    it('rejects unsupported fields (e.g. trustScore, status) with 400 VALIDATION_ERROR', async () => {
      const res = await fetch(`${baseUrl}/api/apps/app_01/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'camera', enabled: true, trustScore: 100 }),
      });

      // RASP now intercepts protected-field tampering (trustScore) before validation runs.
      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'RASP_VIOLATION');
    });

    it('returns 404 APP_NOT_FOUND when updating permission for unknown application', async () => {
      const res = await fetch(`${baseUrl}/api/apps/app_unknown/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'location', enabled: true }),
      });

      assert.equal(res.status, 404);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'APP_NOT_FOUND');
    });

    it('failed validation requests do not create false history records', async () => {
      const historyCountBefore = store.getHistory().length;
      await fetch(`${baseUrl}/api/apps/app_01/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'invalid_res', enabled: true }),
      });
      const historyCountAfter = store.getHistory().length;
      assert.equal(historyCountBefore, historyCountAfter);
    });
  });

  describe('Application Status & Suspension (PATCH /api/apps/:id/status)', () => {
    it('suspends an application, preserves individual permissions, and records history', async () => {
      const res = await fetch(`${baseUrl}/api/apps/app_01/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'suspended' }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.data.status, 'suspended');
      // permissions are unchanged
      assert.equal(json.data.permissions.location.enabled, true);

      // history recorded
      const history = store.getHistory({ appId: 'app_01' });
      assert.equal(history[0].eventType, ACTIVITY_EVENT_TYPES.APP_SUSPENDED);
    });

    it('reactivates a suspended application without changing individual permissions', async () => {
      // First revoke location and suspend app
      permissionService.revokePermission('app_01', 'location');
      permissionService.suspendApp('app_01');

      const res = await fetch(`${baseUrl}/api/apps/app_01/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.data.status, 'active');
      // Revoked permission remains disabled
      assert.equal(json.data.permissions.location.enabled, false);
      // Other enabled permissions remain enabled
      assert.equal(json.data.permissions.files.enabled, true);

      // history recorded
      const history = store.getHistory({ appId: 'app_01' });
      assert.equal(history[0].eventType, ACTIVITY_EVENT_TYPES.APP_REACTIVATED);
    });

    it('rejects invalid status value with 400 VALIDATION_ERROR', async () => {
      const res = await fetch(`${baseUrl}/api/apps/app_01/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'blocked' }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'VALIDATION_ERROR');
    });
  });

  describe('Integration with Central Access Pipeline (processAccessRequest)', () => {
    it('Scenario A: Active app with enabled permission is allowed and updates lastAccessedAt', () => {
      const res = processAccessRequest({
        appId: 'app_01',
        resource: 'location',
        reason: 'Workout tracking',
        timestamp: '2026-11-09T10:00:00.000Z',
      });

      assert.equal(res.allowed, true);
      assert.equal(res.denialReason, null);
      assert.equal(res.event.status, ACCESS_STATUS.ALLOWED);

      const app = store.getApp('app_01');
      assert.equal(app.permissions.location.lastAccessedAt, '2026-11-09T10:00:00.000Z');
    });

    it('Scenario B: Revoking permission denies subsequent access with permission_disabled', () => {
      permissionService.revokePermission('app_01', 'location');

      const res = processAccessRequest({
        appId: 'app_01',
        resource: 'location',
        reason: 'Workout tracking',
        timestamp: '2026-11-09T10:05:00.000Z',
      });

      assert.equal(res.allowed, false);
      assert.equal(res.denialReason, 'permission_disabled');
      assert.equal(res.event.status, ACCESS_STATUS.DENIED);
      assert.equal(res.event.denialReason, 'permission_disabled');
    });

    it('Scenario C: Suspended app denies access with app_suspended taking precedence', () => {
      // location is enabled on app_01, but app is suspended
      permissionService.suspendApp('app_01');

      const res = processAccessRequest({
        appId: 'app_01',
        resource: 'location',
        reason: 'Workout tracking',
        timestamp: '2026-11-09T10:10:00.000Z',
      });

      assert.equal(res.allowed, false);
      assert.equal(res.denialReason, 'app_suspended');
      assert.equal(res.event.status, ACCESS_STATUS.DENIED);
      assert.equal(res.event.denialReason, 'app_suspended');
    });

    it('Scenario D: Reactivating app allows enabled permissions, keeps revoked permissions disabled', () => {
      permissionService.revokePermission('app_01', 'location');
      permissionService.suspendApp('app_01');

      // Reactivate
      permissionService.reactivateApp('app_01');

      // Files was enabled and should work
      const resFiles = processAccessRequest({
        appId: 'app_01',
        resource: 'files',
        reason: 'File access',
        timestamp: '2026-11-09T10:15:00.000Z',
      });
      assert.equal(resFiles.allowed, true);

      // Location was revoked and should still be denied with permission_disabled
      const resLoc = processAccessRequest({
        appId: 'app_01',
        resource: 'location',
        reason: 'Location access',
        timestamp: '2026-11-09T10:16:00.000Z',
      });
      assert.equal(resLoc.allowed, false);
      assert.equal(resLoc.denialReason, 'permission_disabled');
    });
  });
});