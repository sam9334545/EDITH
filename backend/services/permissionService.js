import store from '../store/index.js';
import historyService from './historyService.js';
import {
  RESOURCE_TYPES,
  APPLICATION_STATUS,
  ACTIVITY_EVENT_TYPES,
} from '../../shared/contracts.js';

export class PermissionService {
  /**
   * Pure permission check for an app and resource.
   *
   * @param {Object} app - Application object
   * @param {string} resource - One of RESOURCE_TYPES
   * @returns {{ allowed: boolean, reason: 'ok'|'app_suspended'|'permission_disabled' }}
   */
  checkPermission(app, resource) {
    if (!RESOURCE_TYPES.includes(resource)) {
      throw new Error(`Invalid resource: ${resource}`);
    }

    if (app.status === APPLICATION_STATUS.SUSPENDED) {
      return { allowed: false, reason: 'app_suspended' };
    }

    const perm = app.permissions?.[resource];
    if (!perm || perm.enabled !== true) {
      return { allowed: false, reason: 'permission_disabled' };
    }

    return { allowed: true, reason: 'ok' };
  }

  /**
   * Updates permission status for an application.
   * Emits permission_granted or permission_revoked history event.
   *
   * @param {string} appId
   * @param {string} resource
   * @param {boolean} enabled
   * @returns {Object} Updated application
   */
  updatePermission(appId, resource, enabled) {
    const app = store.findAppById(appId);
    if (!app) return null;

    if (!RESOURCE_TYPES.includes(resource)) {
      throw new Error(`Invalid resource: ${resource}`);
    }

    const currentPerm = app.permissions[resource];
    const prevEnabled = currentPerm ? currentPerm.enabled : false;

    const now = store.clock.now();
    app.permissions[resource] = {
      enabled,
      grantedAt: enabled ? (currentPerm?.grantedAt || now) : currentPerm?.grantedAt || null,
      lastAccessedAt: currentPerm?.lastAccessedAt || null,
    };
    app.updatedAt = now;

    // Record activity history if state actually changed
    if (prevEnabled !== enabled) {
      if (enabled) {
        historyService.recordActivity({
          appId,
          eventType: ACTIVITY_EVENT_TYPES.PERMISSION_GRANTED,
          description: `${resource} permission granted`,
          timestamp: now,
          metadata: { resource },
        });
      } else {
        historyService.recordActivity({
          appId,
          eventType: ACTIVITY_EVENT_TYPES.PERMISSION_REVOKED,
          description: `${resource} permission revoked`,
          timestamp: now,
          metadata: { resource },
        });
      }
    }

    return app;
  }

  /**
   * Updates application status (active/suspended).
   * Emits app_suspended or app_reactivated history event.
   *
   * @param {string} appId
   * @param {'active'|'suspended'} status
   * @returns {Object} Updated application
   */
  updateStatus(appId, status) {
    const app = store.findAppById(appId);
    if (!app) return null;

    const prevStatus = app.status;
    const now = store.clock.now();

    app.status = status;
    app.updatedAt = now;

    if (prevStatus !== status) {
      if (status === APPLICATION_STATUS.SUSPENDED) {
        historyService.recordActivity({
          appId,
          eventType: ACTIVITY_EVENT_TYPES.APP_SUSPENDED,
          description: 'Application suspended',
          timestamp: now,
          metadata: { previousStatus: prevStatus },
        });
      } else if (status === APPLICATION_STATUS.ACTIVE) {
        historyService.recordActivity({
          appId,
          eventType: ACTIVITY_EVENT_TYPES.APP_REACTIVATED,
          description: 'Application reactivated',
          timestamp: now,
          metadata: { previousStatus: prevStatus },
        });
      }
    }

    return app;
  }
}

export const permissionService = new PermissionService();
export default permissionService;
