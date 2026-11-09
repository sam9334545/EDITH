import {
  ALERT_TYPES,
  RECOMMENDATION_TYPES,
  RECOMMENDATION_STATUS,
  SUGGESTED_ACTIONS,
} from '../../shared/contracts.js';
import { store } from '../store/index.js';

/**
 * Generates recommendations from newly detected security alerts.
 * Pure/persisted: app, alerts, events -> Recommendation[]
 *
 * @param {Object} app - Application entity
 * @param {Array<Object>} alerts - Array of SecurityAlert objects
 * @param {Array<Object>} [events] - Array of AccessEvent objects
 * @returns {Array<Object>} Array of newly created Recommendation objects
 */
export function generateRecommendations(app, alerts = [], events = []) {
  if (!app || !Array.isArray(alerts) || alerts.length === 0) {
    return [];
  }

  const existingRecs = store?.recommendations ||
    (typeof store?.getState === 'function' ? store.getState().recommendations : []) || [];

  const newlyCreated = [];

  for (const alert of alerts) {
    let type;
    let suggestedAction;
    let title;
    let description;
    let resource = alert.resource && alert.resource !== '*' ? alert.resource : null;

    switch (alert.type) {
      case ALERT_TYPES.EXCESSIVE_ACCESS: {
        type = RECOMMENDATION_TYPES.RESTRICT_PERMISSION;
        suggestedAction = SUGGESTED_ACTIONS.REVOKE_PERMISSION;
        title = `Restrict ${resource || 'resource'}`;
        description = `Excessive ${resource || 'resource'} requests detected from ${app.name}. Revoking permission is recommended.`;
        break;
      }
      case ALERT_TYPES.UNAUTHORIZED_RESOURCE: {
        type = RECOMMENDATION_TYPES.KEEP_DISABLED;
        suggestedAction = SUGGESTED_ACTIONS.NONE;
        title = `Keep ${resource || 'resource'} disabled`;
        description = `Unauthorized access attempts detected for disabled resource ${resource || 'resource'}. Keep disabled.`;
        break;
      }
      case ALERT_TYPES.SUSPENDED_APP_ACCESS: {
        type = RECOMMENDATION_TYPES.REVIEW_PERMISSION;
        suggestedAction = SUGGESTED_ACTIONS.NONE;
        title = 'Review the app';
        description = `${app.name} attempted resource access while suspended. Review application status and credentials.`;
        break;
      }
      case ALERT_TYPES.REPEATED_RESTRICTED_ACCESS:
      case ALERT_TYPES.UNUSUAL_RESOURCE_COMBINATION: {
        type = RECOMMENDATION_TYPES.SUSPEND_APP;
        suggestedAction = SUGGESTED_ACTIONS.SUSPEND_APP;
        title = 'Suspend or investigate the app';
        description = `Multiple high-severity security violations detected for ${app.name}. Suspending application is recommended.`;
        break;
      }
      default:
        continue;
    }

    // Deduplication check: Ensure only ONE pending recommendation exists per appId, type, and resource
    const isDuplicate = [...existingRecs, ...newlyCreated].some(
      (r) =>
        r.appId === app.id &&
        r.status === RECOMMENDATION_STATUS.PENDING &&
        r.type === type &&
        (r.resource || null) === (resource || null)
    );

    if (isDuplicate) {
      continue;
    }

    // Generate ID with rec_XXXX format
    const nextRecId = typeof store?.nextId === 'function'
      ? store.nextId('rec')
      : `rec_${String((existingRecs.length + newlyCreated.length + 1)).padStart(4, '0')}`;

    const createdAt = alert.timestamp || (store?.clock?.now ? store.clock.now() : new Date().toISOString());

    const recommendation = {
      id: nextRecId,
      appId: app.id,
      type,
      title,
      description,
      suggestedAction,
      status: RECOMMENDATION_STATUS.PENDING,
      createdAt,
    };

    if (resource) {
      recommendation.resource = resource;
    }

    if (alert.id) {
      recommendation.alertId = alert.id;
      alert.recommendationId = recommendation.id;
    }

    newlyCreated.push(recommendation);
    if (Array.isArray(existingRecs)) {
      existingRecs.push(recommendation);
    }
  }

  return newlyCreated;
}

export default { generateRecommendations };

