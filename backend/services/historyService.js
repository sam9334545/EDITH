import store from '../store/index.js';
import { ACTIVITY_EVENT_TYPES, ok, fail } from '../../shared/contracts.js';

export class HistoryService {
  /**
   * Records a security-related activity in the chronological audit trail.
   * Prevents duplicate history entries for identical actions.
   *
   * @param {Object} params
   * @param {string} params.appId - Application ID
   * @param {string} params.eventType - One of ACTIVITY_EVENT_TYPES
   * @param {string} params.description - Human-readable summary
   * @param {string} [params.timestamp] - ISO 8601 timestamp
   * @param {Object} [params.metadata] - Additional contextual data
   * @returns {Object} The created ActivityHistory entry, or existing entry if duplicate
   */
  recordActivity({ appId, eventType, description, timestamp, metadata = {} }) {
    if (!appId || typeof appId !== 'string') {
      throw new Error('appId (string) is required to record activity');
    }

    const validEventTypes = Object.values(ACTIVITY_EVENT_TYPES);
    if (!validEventTypes.includes(eventType)) {
      throw new Error(`Invalid eventType: "${eventType}". Must be one of: ${validEventTypes.join(', ')}`);
    }

    const ts = timestamp || store.clock.now();

    // Deduplication check: check if a record with identical action context already exists
    const isDuplicate = store.history.some((existing) => {
      if (existing.appId !== appId || existing.eventType !== eventType) {
        return false;
      }

      // Check eventId deduplication
      if (metadata.eventId && existing.metadata?.eventId === metadata.eventId) {
        return true;
      }

      // Check alertId deduplication
      if (metadata.alertId && existing.metadata?.alertId === metadata.alertId) {
        return true;
      }

      // Check recommendationId deduplication for the same action
      if (
        metadata.recommendationId &&
        existing.metadata?.recommendationId === metadata.recommendationId &&
        existing.eventType === eventType
      ) {
        return true;
      }

      // Check identical timestamp and description
      if (existing.timestamp === ts && existing.description === description) {
        return true;
      }

      return false;
    });

    if (isDuplicate) {
      return store.history.find(
        (h) =>
          h.appId === appId &&
          h.eventType === eventType &&
          (metadata.eventId ? h.metadata?.eventId === metadata.eventId : true) &&
          (metadata.alertId ? h.metadata?.alertId === metadata.alertId : true)
      );
    }

    const id = store.nextId('act');
    const entry = {
      id,
      appId,
      eventType,
      description: description || `${eventType} on ${appId}`,
      timestamp: ts,
      metadata: { ...metadata },
    };

    store.history.push(entry);
    return entry;
  }

  /**
   * Retrieves activity history with filtering, validation, and reverse-chronological ordering.
   *
   * @param {Object} query - Query parameters (appId, eventType/type, limit)
   * @returns {Object} { success, data, message } or { success: false, error }
   */
  getHistory(query = {}) {
    const { appId } = query;
    const eventType = query.eventType || query.type;
    const limitParam = query.limit;

    // Validate eventType if provided
    if (eventType !== undefined && eventType !== null && eventType !== '') {
      const validEventTypes = Object.values(ACTIVITY_EVENT_TYPES);
      if (!validEventTypes.includes(eventType)) {
        return fail(
          'VALIDATION_ERROR',
          `Invalid event type '${eventType}'. Must be one of: ${validEventTypes.join(', ')}`
        );
      }
    }

    // Validate limit if provided
    let limit = 100;
    if (limitParam !== undefined && limitParam !== null && limitParam !== '') {
      const parsedLimit = Number(limitParam);
      if (!Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 500) {
        return fail('VALIDATION_ERROR', 'Limit must be a positive integer between 1 and 500');
      }
      limit = parsedLimit;
    }

    // Filter activities
    let activities = [...store.history];

    if (appId && typeof appId === 'string' && appId.trim() !== '') {
      activities = activities.filter((act) => act.appId === appId);
    }

    if (eventType) {
      activities = activities.filter((act) => act.eventType === eventType);
    }

    // Sort in reverse chronological order (newest first)
    activities.sort((a, b) => {
      const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (timeDiff !== 0) return timeDiff;
      // Tie-break with ID descending (act_0005 > act_0004)
      return b.id.localeCompare(a.id);
    });

    // Apply limit
    const paginated = activities.slice(0, limit);

    return ok(paginated, `Retrieved ${paginated.length} activity history records`);
  }

  /**
   * Retrieves aggregated summary stats for activities.
   */
  getSummary() {
    const history = store.history;
    const totalActivities = history.length;
    const allowedRequests = history.filter(
      (h) => h.eventType === ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED
    ).length;
    const deniedRequests = history.filter(
      (h) => h.eventType === ACTIVITY_EVENT_TYPES.ACCESS_DENIED
    ).length;
    const securityAlerts = history.filter(
      (h) => h.eventType === ACTIVITY_EVENT_TYPES.ALERT_CREATED
    ).length;

    return {
      totalActivities,
      allowedRequests,
      deniedRequests,
      securityAlerts,
    };
  }
}

export const historyService = new HistoryService();
export default historyService;
