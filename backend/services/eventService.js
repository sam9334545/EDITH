import store from '../store/index.js';
import historyService from './historyService.js';
import {
  RESOURCE_TYPES,
  ACCESS_STATUS,
  ACTIVITY_EVENT_TYPES,
} from '../../shared/contracts.js';

export class EventService {
  /**
   * Creates an access event and automatically records the corresponding activity history.
   *
   * @param {Object} params
   * @param {Object} params.app - Application object
   * @param {string} params.resource - Resource requested
   * @param {string} [params.reason] - Stated reason
   * @param {string} [params.timestamp] - ISO 8601 timestamp
   * @param {{ allowed: boolean, reason?: string }} params.decision - Permission check decision
   * @returns {Object} Created AccessEvent
   */
  createEvent({ app, resource, reason = 'Simulated request', timestamp, decision }) {
    if (!app || !app.id) {
      throw new Error('Application object is required');
    }
    if (!RESOURCE_TYPES.includes(resource)) {
      throw new Error(`Invalid resource: ${resource}`);
    }

    const eventId = store.nextId('evt');
    const ts = timestamp || store.clock.now();
    const isAllowed = decision.allowed;
    const status = isAllowed ? ACCESS_STATUS.ALLOWED : ACCESS_STATUS.DENIED;
    const denialReason = isAllowed ? null : decision.reason;

    const event = {
      id: eventId,
      appId: app.id,
      resource,
      reason,
      timestamp: ts,
      status,
      suspicious: false,
      alertId: null,
      ...(denialReason ? { denialReason } : {}),
    };

    store.events.push(event);

    // If allowed, update lastAccessedAt on the app permission
    if (isAllowed && app.permissions?.[resource]) {
      app.permissions[resource].lastAccessedAt = ts;
    }

    // Automatically record activity history
    if (isAllowed) {
      historyService.recordActivity({
        appId: app.id,
        eventType: ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED,
        description: `${resource} access allowed`,
        timestamp: ts,
        metadata: {
          resource,
          eventId: event.id,
          reason,
        },
      });
    } else {
      historyService.recordActivity({
        appId: app.id,
        eventType: ACTIVITY_EVENT_TYPES.ACCESS_DENIED,
        description: `${resource} access denied (${denialReason})`,
        timestamp: ts,
        metadata: {
          resource,
          eventId: event.id,
          denialReason,
          reason,
        },
      });
    }

    return event;
  }

  /**
   * Retrieves access events with filtering and reverse-chronological ordering.
   */
  getEvents(query = {}) {
    const { appId, resource, status, suspicious, limit } = query;

    let events = [...store.events];

    if (appId) events = events.filter((e) => e.appId === appId);
    if (resource) events = events.filter((e) => e.resource === resource);
    if (status) events = events.filter((e) => e.status === status);
    if (suspicious !== undefined) {
      const isSuspicious = suspicious === 'true' || suspicious === true;
      events = events.filter((e) => e.suspicious === isSuspicious);
    }

    events.sort((a, b) => {
      const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.id.localeCompare(a.id);
    });

    const parsedLimit = limit ? Math.min(Math.max(1, parseInt(limit, 10)), 200) : 50;
    return events.slice(0, parsedLimit);
  }
}

export const eventService = new EventService();
export default eventService;
