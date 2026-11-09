import {
  RESOURCE_TYPES,
  ACCESS_STATUS,
  APPLICATION_STATUS,
  ACTIVITY_EVENT_TYPES,
  isIsoTimestamp,
} from '../../shared/contracts.js';
import { store } from '../store/index.js';

function validationError(message) {
  const error = new Error(message);
  error.code = 'VALIDATION_ERROR';
  return error;
}

export function getEvents(query = {}) {
  const { appId, resource, status, suspicious, limit: limitParam } = query;

  if (appId !== undefined && (typeof appId !== 'string' || appId.trim() === '')) {
    throw validationError('appId must be a non-empty string');
  }
  if (resource !== undefined && !RESOURCE_TYPES.includes(resource)) {
    throw validationError(`resource must be one of: ${RESOURCE_TYPES.join(', ')}`);
  }
  if (status !== undefined && !Object.values(ACCESS_STATUS).includes(status)) {
    throw validationError(`status must be one of: ${Object.values(ACCESS_STATUS).join(', ')}`);
  }
  if (suspicious !== undefined && suspicious !== 'true' && suspicious !== 'false') {
    throw validationError('suspicious must be true or false');
  }

  let limit = 50;
  if (limitParam !== undefined) {
    if (!/^\d+$/.test(String(limitParam))) {
      throw validationError('limit must be an integer between 1 and 200');
    }
    limit = Number(limitParam);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
      throw validationError('limit must be an integer between 1 and 200');
    }
  }

  return store.events
    .filter((event) => appId === undefined || event.appId === appId)
    .filter((event) => resource === undefined || event.resource === resource)
    .filter((event) => status === undefined || event.status === status)
    .filter((event) => suspicious === undefined || event.suspicious === (suspicious === 'true'))
    .sort((left, right) => {
      const difference = Date.parse(right.timestamp) - Date.parse(left.timestamp);
      return Number.isNaN(difference) || difference === 0
        ? right.id.localeCompare(left.id)
        : difference;
    })
    .slice(0, limit);
}

/**
 * Creates and records an access event and its corresponding activity history.
 *
 * @param {Object} params
 * @param {Object} params.app Application entity
 * @param {string} params.resource Resource name (must be in RESOURCE_TYPES)
 * @param {string} [params.reason] Request reason description
 * @param {string} [params.timestamp] ISO 8601 timestamp
 * @param {Object|string|boolean} params.decision Access decision
 * @returns {Object} Created AccessEvent
 */
export function createEvent({ app, resource, reason, timestamp, decision }) {
  // 1. Validate inputs
  if (!app || typeof app !== 'object' || typeof app.id !== 'string' || !app.id.trim()) {
    const error = new Error('app with a valid string id is required');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  if (!resource || !RESOURCE_TYPES.includes(resource)) {
    const error = new Error(`resource must be one of: ${RESOURCE_TYPES.join(', ')}`);
    error.code = 'RESOURCE_INVALID';
    throw error;
  }

  if (reason !== undefined && typeof reason !== 'string') {
    const error = new Error('reason must be a string');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  if (timestamp !== undefined && !isIsoTimestamp(timestamp)) {
    const error = new Error('timestamp must be a valid ISO 8601 string');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  if (decision === undefined || decision === null) {
    const error = new Error('decision is required');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  // 2. Resolve decision status & denial reason
  let status;
  let denialReason = null;

  if (typeof decision === 'object') {
    const isAllowed = decision.allowed === true || decision.status === ACCESS_STATUS.ALLOWED;
    status = isAllowed ? ACCESS_STATUS.ALLOWED : ACCESS_STATUS.DENIED;
    if (!isAllowed) {
      denialReason = decision.denialReason || decision.reason || null;
    }
  } else if (typeof decision === 'string') {
    status = decision === ACCESS_STATUS.ALLOWED ? ACCESS_STATUS.ALLOWED : ACCESS_STATUS.DENIED;
  } else if (typeof decision === 'boolean') {
    status = decision ? ACCESS_STATUS.ALLOWED : ACCESS_STATUS.DENIED;
  } else {
    const error = new Error('decision must be an object, string, or boolean');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  if (status === ACCESS_STATUS.DENIED && !denialReason) {
    if (app.status === APPLICATION_STATUS.SUSPENDED) {
      denialReason = 'app_suspended';
    } else {
      denialReason = 'permission_disabled';
    }
  }

  const eventTimestamp = timestamp || (store?.clock?.now ? store.clock.now() : new Date().toISOString());

  // 3. Generate event ID (format: evt_XXXX)
  const eventsTarget = store?.events || (typeof store?.getState === 'function' ? store.getState().events : null);
  const nextEvtId = typeof store?.nextId === 'function'
    ? store.nextId('evt')
    : `evt_${String((eventsTarget?.length || 0) + 1).padStart(4, '0')}`;

  const event = {
    id: nextEvtId,
    appId: app.id,
    resource,
    reason: reason || 'Simulated request',
    timestamp: eventTimestamp,
    status,
    suspicious: false,
    alertId: null,
  };

  if (status === ACCESS_STATUS.DENIED) {
    event.denialReason = denialReason;
  }

  // 4. Push event to central store
  if (Array.isArray(eventsTarget)) {
    eventsTarget.push(event);
  }

  // 5. Write corresponding ActivityHistory entry (Feature 7)
  const historyTarget = store?.history || (typeof store?.getState === 'function' ? store.getState().history : null);
  const nextActId = typeof store?.nextId === 'function'
    ? store.nextId('act')
    : `act_${String((historyTarget?.length || 0) + 1).padStart(4, '0')}`;

  const eventType = status === ACCESS_STATUS.ALLOWED
    ? ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED
    : ACTIVITY_EVENT_TYPES.ACCESS_DENIED;

  const metadata = {
    resource,
    eventId: event.id,
  };
  if (status === ACCESS_STATUS.DENIED && denialReason) {
    metadata.denialReason = denialReason;
  }

  const historyEntry = {
    id: nextActId,
    appId: app.id,
    eventType,
    description: `${resource} access ${status}`,
    timestamp: eventTimestamp,
    metadata,
  };

  if (Array.isArray(historyTarget)) {
    historyTarget.push(historyEntry);
  }

  return event;
}

export default { createEvent, getEvents };