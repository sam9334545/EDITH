// STUB: replace with M1 implementation
import {
  APPLICATION_STATUS,
  validateAccessPayload,
  trustLevelFor,
} from '../../shared/contracts.js';
import { store } from '../store/index.js';
import { createEvent } from './eventService.js';

/**
 * Access pipeline orchestrator.
 * Full pipeline: validate -> check status/perm -> createEvent -> analyzeEvent -> trustScore -> recommendations.
 *
 * @param {Object} payload
 * @param {string} payload.appId
 * @param {string} payload.resource
 * @param {string} [payload.reason]
 * @param {string} [payload.timestamp]
 * @returns {Promise<Object>}
 */
export async function processAccessRequest(payload) {
  const validationError = validateAccessPayload(payload);
  if (validationError) {
    const error = new Error(validationError);
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const apps = store?.apps || (typeof store?.getState === 'function' ? store.getState().apps : []);
  const app = apps.find((a) => a.id === payload.appId);
  if (!app) {
    const error = new Error(`Application ${payload.appId} not found`);
    error.code = 'APP_NOT_FOUND';
    throw error;
  }

  let decision;
  if (app.status === APPLICATION_STATUS.SUSPENDED) {
    decision = { allowed: false, reason: 'app_suspended' };
  } else {
    const perm = app.permissions?.[payload.resource];
    if (!perm || !perm.enabled) {
      decision = { allowed: false, reason: 'permission_disabled' };
    } else {
      decision = { allowed: true, reason: 'ok' };
    }
  }

  const event = createEvent({
    app,
    resource: payload.resource,
    reason: payload.reason,
    timestamp: payload.timestamp,
    decision,
  });

  if (decision.allowed && app.permissions?.[payload.resource]) {
    app.permissions[payload.resource].lastAccessedAt = event.timestamp;
  }

  return {
    event,
    alertsCreated: [],
    app,
    trustScore: {
      appId: app.id,
      score: app.trustScore,
      level: trustLevelFor(app.trustScore),
      explanation: [],
    },
    recommendations: [],
  };
}

export default { processAccessRequest };

