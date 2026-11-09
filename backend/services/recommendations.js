import {
  ALERT_TYPES,
  RECOMMENDATION_TYPES,
  SUGGESTED_ACTIONS,
  RECOMMENDATION_STATUS,
} from '../../shared/contracts.js';

/**
 * Pure recommendation generator based on new alerts.
 * Avoids generating duplicate pending recommendations for the same (appId, type, resource).
 *
 * @param {Object} app - Application object
 * @param {Array<Object>} newAlerts - New alerts created in this cycle
 * @param {Array<Object>} existingRecommendations - Currently existing recommendations
 * @param {string} timestamp - Current ISO timestamp
 * @returns {Array<Object>} List of candidate new recommendations
 */
export function generateRecommendations(app, newAlerts = [], existingRecommendations = [], timestamp) {
  const newRecs = [];

  for (const alert of newAlerts) {
    let type = null;
    let title = '';
    let description = '';
    let suggestedAction = SUGGESTED_ACTIONS.NONE;
    let resource = alert.resource && alert.resource !== '*' ? alert.resource : null;

    switch (alert.type) {
      case ALERT_TYPES.EXCESSIVE_ACCESS:
        type = RECOMMENDATION_TYPES.RESTRICT_PERMISSION;
        title = `Restrict ${resource || 'excessive'} access`;
        description = `Excessive ${resource} requests detected. Revoke permission to mitigate exposure.`;
        suggestedAction = SUGGESTED_ACTIONS.REVOKE_PERMISSION;
        break;

      case ALERT_TYPES.UNAUTHORIZED_RESOURCE:
        type = RECOMMENDATION_TYPES.KEEP_DISABLED;
        title = `Keep ${resource || 'resource'} disabled`;
        description = `Unauthorized access attempt detected while permission was disabled. Keep permission disabled.`;
        suggestedAction = SUGGESTED_ACTIONS.NONE;
        break;

      case ALERT_TYPES.SUSPENDED_APP_ACCESS:
        type = RECOMMENDATION_TYPES.REVIEW_PERMISSION;
        title = `Review suspended app activity`;
        description = `${app.name} attempted to access resources while suspended. Review app permissions and behavior.`;
        suggestedAction = SUGGESTED_ACTIONS.NONE;
        break;

      case ALERT_TYPES.REPEATED_RESTRICTED_ACCESS:
        type = RECOMMENDATION_TYPES.SUSPEND_APP;
        title = `Suspend ${app.name}`;
        description = `Repeated denied access attempts detected. Recommend suspending application.`;
        suggestedAction = SUGGESTED_ACTIONS.SUSPEND_APP;
        resource = null;
        break;

      case ALERT_TYPES.UNUSUAL_RESOURCE_COMBINATION:
        type = RECOMMENDATION_TYPES.SUSPEND_APP;
        title = `Suspend ${app.name}`;
        description = `Rapid access to multiple sensitive resources detected. Recommend suspending application.`;
        suggestedAction = SUGGESTED_ACTIONS.SUSPEND_APP;
        resource = null;
        break;

      default:
        break;
    }

    if (!type) continue;

    // Check if an identical pending recommendation already exists
    const hasPendingDuplicate = [...existingRecommendations, ...newRecs].some(
      (r) =>
        r.appId === app.id &&
        r.type === type &&
        r.resource === resource &&
        r.status === RECOMMENDATION_STATUS.PENDING
    );

    if (!hasPendingDuplicate) {
      newRecs.push({
        appId: app.id,
        type,
        title,
        description,
        suggestedAction,
        resource,
        alertId: alert.id,
        status: RECOMMENDATION_STATUS.PENDING,
        createdAt: timestamp,
      });
    }
  }

  return newRecs;
}

export default generateRecommendations;
