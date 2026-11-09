import store from '../store/index.js';
import permissionService from './permissionService.js';
import historyService from './historyService.js';
import {
  RECOMMENDATION_STATUS,
  SUGGESTED_ACTIONS,
  ACTIVITY_EVENT_TYPES,
  trustLevelFor,
} from '../../shared/contracts.js';

export class RecommendationService {
  /**
   * Applies a recommendation's suggested action and records history.
   * Idempotent: re-applying returns current state with no duplicate history entries.
   *
   * @param {string} recommendationId
   * @returns {{ recommendation: Object, app: Object }}
   */
  applyRecommendation(recommendationId) {
    const rec = store.recommendations.find((r) => r.id === recommendationId);
    if (!rec) {
      const err = new Error(`Recommendation ${recommendationId} not found`);
      err.code = 'RECOMMENDATION_NOT_FOUND';
      throw err;
    }

    const app = store.findAppById(rec.appId);
    if (!app) {
      const err = new Error(`Application ${rec.appId} not found`);
      err.code = 'APP_NOT_FOUND';
      throw err;
    }

    // Idempotent: if already applied, return without re-applying or creating duplicate history
    if (rec.status === RECOMMENDATION_STATUS.APPLIED) {
      return {
        recommendation: rec,
        app: {
          ...app,
          trustLevel: trustLevelFor(app.trustScore),
        },
      };
    }

    const now = store.clock.now();

    // Apply the suggested action
    if (rec.suggestedAction === SUGGESTED_ACTIONS.REVOKE_PERMISSION && rec.resource) {
      permissionService.updatePermission(rec.appId, rec.resource, false);
    } else if (rec.suggestedAction === SUGGESTED_ACTIONS.SUSPEND_APP) {
      permissionService.updateStatus(rec.appId, 'suspended');
    }

    rec.status = RECOMMENDATION_STATUS.APPLIED;
    rec.appliedAt = now;

    // Record recommendation_applied in Activity History
    historyService.recordActivity({
      appId: rec.appId,
      eventType: ACTIVITY_EVENT_TYPES.RECOMMENDATION_APPLIED,
      description: `Recommendation applied: ${rec.title}`,
      timestamp: now,
      metadata: {
        recommendationId: rec.id,
        action: rec.suggestedAction,
        resource: rec.resource,
      },
    });

    return {
      recommendation: rec,
      app: {
        ...app,
        trustLevel: trustLevelFor(app.trustScore),
      },
    };
  }

  getRecommendations(appId, status) {
    let recs = store.recommendations;
    if (appId) recs = recs.filter((r) => r.appId === appId);
    if (status) recs = recs.filter((r) => r.status === status);
    return recs;
  }
}

export const recommendationService = new RecommendationService();
export default recommendationService;
