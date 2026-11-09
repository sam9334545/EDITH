// Automated Tests for E.D.I.T.H. Feature 6: Access Control (M2)
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

describe('Feature 6: Access Control Backend Module', () => {
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
    store.resetToSeed();
  });

  describe('Phase 7.A — Permission Approval Tests', () => {
    it('approves a previously disabled permission and verifies all side effects and access', async () => {
      const appBefore = store.getApp('app_01');
      assert.equal(appBefore.permissions.contacts.enabled, false);
      assert.equal(appBefore.permissions.contacts.grantedAt, null);

      const res = await fetch(`${baseUrl}/api/apps/app_01/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'contacts', enabled: true }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);

      const appAfter = json.data;
      // 1. Confirm enabled === true
      assert.equal(appAfter.permissions.contacts.enabled, true);
      // 2. Confirm grantedAt is updated
      assert.ok(typeof appAfter.permissions.contacts.grantedAt === 'string');
      // 3. Confirm lastAccessedAt is preserved (null)
      assert.equal(appAfter.permissions.contacts.lastAccessedAt, null);
      // 4. Confirm unrelated permissions unchanged
      assert.equal(appAfter.permissions.location.enabled, true);
      assert.equal(appAfter.permissions.files.enabled, true);
      assert.equal(appAfter.permissions.camera.enabled, false);
      assert.equal(appAfter.permissions.microphone.enabled, false);
      // 5. Confirm application status is unchanged
      assert.equal(appAfter.status, 'active');
      // 6. Confirm trust score is unchanged
      assert.equal(appAfter.trustScore, 94);

      // 7. Confirm history event created with transition metadata
      const history = store.getHistory({ appId: 'app_01' });
      assert.equal(history[0].eventType, ACTIVITY_EVENT_TYPES.PERMISSION_GRANTED);
      assert.equal(history[0].metadata.appId, 'app_01');
      assert.equal(history[0].metadata.resource, 'contacts');
      assert.equal(history[0].metadata.previousValue, false);
      assert.equal(history[0].metadata.newValue, true);

      // 8. Confirm resource can subsequently be accessed
      const accessRes = processAccessRequest({
        appId: 'app_01',
        resource: 'contacts',
        reason: 'Contact sync',
      });
      assert.equal(accessRes.allowed, true);
      assert.equal(accessRes.event.status, ACCESS_STATUS.ALLOWED);
    });
  });

  describe('Phase 7.B — Permission Revocation Tests', () => {
    it('revokes an enabled permission and verifies denial on subsequent access', async () => {
      const appBefore = store.getApp('app_01');
      assert.equal(appBefore.permissions.location.enabled, true);
      const originalGrantedAt = appBefore.permissions.location.grantedAt;
      const originalLastAccessedAt = appBefore.permissions.location.lastAccessedAt;

      const res = await fetch(`${baseUrl}/api/apps/app_01/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'location', enabled: false }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);

      const appAfter = json.data;
      // 1. Confirm enabled === false
      assert.equal(appAfter.permissions.location.enabled, false);
      // 2. Confirm grantedAt is preserved
      assert.equal(appAfter.permissions.location.grantedAt, originalGrantedAt);
      // 3. Confirm lastAccessedAt is preserved
      assert.equal(appAfter.permissions.location.lastAccessedAt, originalLastAccessedAt);
      // 4. Confirm unrelated permissions remain unchanged
      assert.equal(appAfter.permissions.files.enabled, true);
      // 5. Confirm trust score is unchanged
      assert.equal(appAfter.trustScore, 94);
      // 6. Confirm app is not suspended
      assert.equal(appAfter.status, 'active');

      // 7. Confirm history records revocation
      const history = store.getHistory({ appId: 'app_01' });
      assert.equal(history[0].eventType, ACTIVITY_EVENT_TYPES.PERMISSION_REVOKED);
      assert.equal(history[0].metadata.resource, 'location');
      assert.equal(history[0].metadata.previousValue, true);
      assert.equal(history[0].metadata.newValue, false);

      // 8. Attempt access to the revoked resource
      const accessRes = processAccessRequest({
        appId: 'app_01',
        resource: 'location',
        reason: 'Route tracking',
      });

      // 9. Confirm backend denies with permission_disabled
      assert.equal(accessRes.allowed, false);
      assert.equal(accessRes.denialReason, 'permission_disabled');
      assert.equal(accessRes.event.status, ACCESS_STATUS.DENIED);
    });
  });

  describe('Phase 7.C — Suspension Tests', () => {
    it('suspends an active app, preserves permissions, and blocks all 5 resource requests', async () => {
      const res = await fetch(`${baseUrl}/api/apps/app_01/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'suspended' }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.data.status, 'suspended');

      // All permissions preserved
      assert.equal(json.data.permissions.location.enabled, true);
      assert.equal(json.data.permissions.files.enabled, true);
      assert.equal(json.data.trustScore, 94);

      // History recorded
      const history = store.getHistory({ appId: 'app_01' });
      assert.equal(history[0].eventType, ACTIVITY_EVENT_TYPES.APP_SUSPENDED);
      assert.equal(history[0].metadata.previousStatus, 'active');
      assert.equal(history[0].metadata.newStatus, 'suspended');

      // Test all 5 resources
      for (const resource of RESOURCE_TYPES) {
        const lastAccessBefore = store.getApp('app_01').permissions[resource].lastAccessedAt;
        const accessRes = processAccessRequest({
          appId: 'app_01',
          resource,
          reason: 'Test suspended access',
        });

        assert.equal(accessRes.allowed, false, `Resource ${resource} should be denied`);
        assert.equal(accessRes.denialReason, 'app_suspended');
        assert.equal(accessRes.event.status, ACCESS_STATUS.DENIED);

        // Confirm lastAccessedAt was NOT updated
        const lastAccessAfter = store.getApp('app_01').permissions[resource].lastAccessedAt;
        assert.equal(lastAccessAfter, lastAccessBefore);
      }
    });
  });

  describe('Phase 7.D — Reactivation Tests', () => {
    it('reactivates app, keeps revoked permissions disabled, allows enabled permissions', async () => {
      // 1. Suspend app_01
      permissionService.suspendApp('app_01');
      // 2. Revoke location while suspended
      permissionService.revokePermission('app_01', 'location');

      // 3. Reactivate app
      const res = await fetch(`${baseUrl}/api/apps/app_01/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.data.status, 'active');

      // Location remains disabled
      assert.equal(json.data.permissions.location.enabled, false);
      // Files remains enabled
      assert.equal(json.data.permissions.files.enabled, true);
      assert.equal(json.data.trustScore, 94);

      // History records reactivation
      const history = store.getHistory({ appId: 'app_01' });
      assert.equal(history[0].eventType, ACTIVITY_EVENT_TYPES.APP_REACTIVATED);
      assert.equal(history[0].metadata.previousStatus, 'suspended');
      assert.equal(history[0].metadata.newStatus, 'active');

      // 4. Access enabled resource (files) -> allowed
      const filesAccess = processAccessRequest({
        appId: 'app_01',
        resource: 'files',
        reason: 'Sync log file',
      });
      assert.equal(filesAccess.allowed, true);

      // 5. Access disabled resource (location) -> denied with permission_disabled
      const locAccess = processAccessRequest({
        appId: 'app_01',
        resource: 'location',
        reason: 'GPS track',
      });
      assert.equal(locAccess.allowed, false);
      assert.equal(locAccess.denialReason, 'permission_disabled');
    });
  });

  describe('Phase 7.E — Validation Edge Cases', () => {
    it('rejects unknown application ID with 404', async () => {
      const res = await fetch(`${baseUrl}/api/apps/unknown_app_xyz/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'suspended' }),
      });
      assert.equal(res.status, 404);
      const json = await res.json();
      assert.equal(json.error.code, 'APP_NOT_FOUND');
    });

    it('rejects missing status with 400', async () => {
      const res = await fetch(`${baseUrl}/api/apps/app_01/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, 'VALIDATION_ERROR');
    });

    it('rejects invalid status string with 400', async () => {
      const res = await fetch(`${baseUrl}/api/apps/app_01/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'inactive' }),
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, 'VALIDATION_ERROR');
    });

    it('rejects boolean status with 400', async () => {
      const res = await fetch(`${baseUrl}/api/apps/app_01/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: true }),
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, 'VALIDATION_ERROR');
    });

    it('rejects extra unauthorized fields in status request with 400', async () => {
      const res = await fetch(`${baseUrl}/api/apps/app_01/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'suspended', trustScore: 100 }),
      });
      // RASP now intercepts protected-field tampering (trustScore) before validation runs.
      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.error.code, 'RASP_VIOLATION');
    });

    it('rejects invalid resource type with 400 RESOURCE_INVALID', async () => {
      const res = await fetch(`${baseUrl}/api/apps/app_01/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'bluetooth', enabled: true }),
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, 'RESOURCE_INVALID');
    });

    it('rejects string enabled field with 400 VALIDATION_ERROR', async () => {
      const res = await fetch(`${baseUrl}/api/apps/app_01/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'location', enabled: 'true' }),
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, 'VALIDATION_ERROR');
    });
  });

  describe('Phase 7.F — Idempotency Tests', () => {
    it('repeated grant does not duplicate history or overwrite grantedAt', async () => {
      // First grant
      await fetch(`${baseUrl}/api/apps/app_01/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'contacts', enabled: true }),
      });

      const grantedAtFirst = store.getApp('app_01').permissions.contacts.grantedAt;
      const historyCountAfterFirst = store.getHistory({ appId: 'app_01' }).length;

      // Second grant (repeated)
      const res2 = await fetch(`${baseUrl}/api/apps/app_01/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'contacts', enabled: true }),
      });

      assert.equal(res2.status, 200);
      const grantedAtSecond = store.getApp('app_01').permissions.contacts.grantedAt;
      const historyCountAfterSecond = store.getHistory({ appId: 'app_01' }).length;

      // Timestamp and history preserved
      assert.equal(grantedAtSecond, grantedAtFirst);
      assert.equal(historyCountAfterSecond, historyCountAfterFirst);
    });

    it('repeated revoke does not duplicate history', async () => {
      // First revoke
      await fetch(`${baseUrl}/api/apps/app_01/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'location', enabled: false }),
      });

      const historyCountAfterFirst = store.getHistory({ appId: 'app_01' }).length;

      // Second revoke (repeated)
      const res2 = await fetch(`${baseUrl}/api/apps/app_01/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'location', enabled: false }),
      });

      assert.equal(res2.status, 200);
      const historyCountAfterSecond = store.getHistory({ appId: 'app_01' }).length;
      assert.equal(historyCountAfterSecond, historyCountAfterFirst);
    });

    it('repeated suspension does not duplicate history', async () => {
      await fetch(`${baseUrl}/api/apps/app_01/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'suspended' }),
      });

      const historyCount1 = store.getHistory({ appId: 'app_01' }).length;

      await fetch(`${baseUrl}/api/apps/app_01/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'suspended' }),
      });

      const historyCount2 = store.getHistory({ appId: 'app_01' }).length;
      assert.equal(historyCount2, historyCount1);
    });

    it('repeated reactivation does not duplicate history', async () => {
      // App_01 is active by default
      const historyCount1 = store.getHistory({ appId: 'app_01' }).length;

      await fetch(`${baseUrl}/api/apps/app_01/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });

      const historyCount2 = store.getHistory({ appId: 'app_01' }).length;
      assert.equal(historyCount2, historyCount1);
    });
  });

  describe('Phase 7.G — Security Enforcement Integration', () => {
    it('suspended status takes precedence over permission state', () => {
      const app = store.getApp('app_01');
      assert.equal(app.permissions.location.enabled, true);

      // Suspend
      permissionService.suspendApp('app_01');
      const updatedApp = store.getApp('app_01');

      // checkPermission directly
      const decision = permissionService.checkPermission(updatedApp, 'location');
      assert.equal(decision.allowed, false);
      assert.equal(decision.reason, 'app_suspended');

      // processAccessRequest
      const req = processAccessRequest({ appId: 'app_01', resource: 'location' });
      assert.equal(req.allowed, false);
      assert.equal(req.denialReason, 'app_suspended');
    });

    it('revoking permission while app is suspended retains revocation on reactivation', () => {
      permissionService.suspendApp('app_01');
      permissionService.revokePermission('app_01', 'files');

      // Verify files still denied while suspended
      const accessSusp = processAccessRequest({ appId: 'app_01', resource: 'files' });
      assert.equal(accessSusp.denialReason, 'app_suspended');

      // Reactivate
      permissionService.reactivateApp('app_01');

      // Files still denied because it was revoked
      const accessActive = processAccessRequest({ appId: 'app_01', resource: 'files' });
      assert.equal(accessActive.allowed, false);
      assert.equal(accessActive.denialReason, 'permission_disabled');
    });
  });
});