// E.D.I.T.H. Runtime Guard (RASP-inspired, simulated).
//
// A guard step inside processAccessRequest that decides ALLOW or BLOCK for every access request and
// logs every decision. It does NOT monitor system calls; it inspects the simulated access request
// and the app's recent behaviour.
//
// Order of checks: app -> status -> permission -> behavioural inspection -> policy evaluation -> decision.
//
// Modes:
//   monitor : alerts only. The ONLY blocks are mandatory permission denials (revoked permission).
//   protect : monitor + enforces runtime policies (LOCATION_RATE_LIMIT).
//   strict  : protect + blocks suspended apps and every high-severity policy violation.
// A revoked permission is ALWAYS denied, in every mode.
//
// Decision record:
//   { decisionId, appId, eventId, decision, reason, policyTriggered, enforcementMode, severity, timestamp }

import {
  GUARD_MODES,
  GUARD_DECISIONS,
  GUARD_CONFIG,
  GUARD_DENIAL_REASONS,
  RUNTIME_POLICIES,
  APPLICATION_STATUS,
  SENSITIVE_RESOURCES,
  RESOURCE_TYPES,
  DEFAULT_GUARD_MODE,
} from '../../shared/contracts.js';
import { store } from '../store/index.js';

const SEVERITY_RANK = Object.freeze({ low: 1, medium: 2, high: 3, critical: 4 });

export function getGuardMode() {
  const mode = store.getGuardMode?.();
  return Object.values(GUARD_MODES).includes(mode) ? mode : DEFAULT_GUARD_MODE;
}

export function setGuardMode(mode) {
  const result = store.setGuardMode(mode);
  if (!result) {
    const error = new Error(`mode must be one of ${Object.values(GUARD_MODES).join(', ')}`);
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  return result;
}

export function getGuardDecisions(filter = {}) {
  return store.getGuardDecisions(filter);
}

function toMs(timestamp) {
  const ms = new Date(timestamp).getTime();
  return Number.isNaN(ms) ? Date.now() : ms;
}

/**
 * Behavioural inspection: runtime policies that fired for this request.
 * Counts the app's earlier events plus the current request (denied events count toward frequency).
 */
function inspectBehaviour({ app, resource, timestamp, recentEvents }) {
  const now = toMs(timestamp);
  const appEvents = (recentEvents || []).filter(
    (e) => e.appId === app.id && toMs(e.timestamp) <= now,
  );
  const triggered = [];

  const rate = GUARD_CONFIG.LOCATION_RATE_LIMIT;
  if (resource === rate.resource) {
    const inWindow = appEvents.filter(
      (e) => e.resource === rate.resource && toMs(e.timestamp) >= now - rate.windowMs,
    ).length + 1; // + current request
    if (inWindow > rate.maxRequests) {
      triggered.push({
        policy: RUNTIME_POLICIES.LOCATION_RATE_LIMIT,
        severity: rate.severity,
        reason: GUARD_DENIAL_REASONS.RATE_LIMIT_EXCEEDED,
        detail: `${inWindow} ${rate.resource} requests in ${rate.windowMs / 1000}s (limit ${rate.maxRequests})`,
        enforcedIn: [GUARD_MODES.PROTECT, GUARD_MODES.STRICT],
      });
    }
  }

  const burst = GUARD_CONFIG.SENSITIVE_COMBINATION_BURST;
  if (SENSITIVE_RESOURCES.includes(resource)) {
    const distinct = new Set(
      appEvents
        .filter((e) => SENSITIVE_RESOURCES.includes(e.resource) && toMs(e.timestamp) >= now - burst.windowMs)
        .map((e) => e.resource),
    );
    distinct.add(resource);
    if (distinct.size >= burst.distinctSensitive) {
      triggered.push({
        policy: RUNTIME_POLICIES.SENSITIVE_COMBINATION_BURST,
        severity: burst.severity,
        reason: GUARD_DENIAL_REASONS.POLICY_VIOLATION,
        detail: `${distinct.size} distinct sensitive resources in ${burst.windowMs / 1000}s (${[...distinct].join(', ')})`,
        enforcedIn: [GUARD_MODES.STRICT],
      });
    }
  }
  return triggered;
}

/**
 * Pure decision function (no writes). Returns the decision plus an explanation.
 *
 * @param {Object} p
 * @param {Object} p.app            Application entity
 * @param {string} p.resource       Requested resource
 * @param {string} [p.timestamp]    ISO timestamp of the request
 * @param {Array}  [p.recentEvents] Events already recorded in the store
 * @param {string} [p.mode]         Overrides the configured mode for a single evaluation
 */
export function evaluate({ app, resource, timestamp, recentEvents = [], mode } = {}) {
  const enforcementMode = Object.values(GUARD_MODES).includes(mode) ? mode : getGuardMode();
  const base = (extra) => ({
    decision: GUARD_DECISIONS.ALLOW,
    allowed: true,
    reason: 'ok',
    policyTriggered: null,
    severity: null,
    enforcementMode,
    explanation: 'All guard checks passed.',
    observed: [],
    ...extra,
  });
  const block = (reason, policyTriggered, severity, explanation, observed = []) => base({
    decision: GUARD_DECISIONS.BLOCK, allowed: false, reason, policyTriggered, severity, explanation, observed,
  });

  // 1. App
  if (!app) return block('app_not_found', null, 'low', 'Application does not exist.');
  // 1b. Resource
  if (!resource || !RESOURCE_TYPES.includes(resource)) {
    return block('resource_invalid', null, 'low', `Resource "${resource}" is not a known resource type.`);
  }

  const suspended = app.status === APPLICATION_STATUS.SUSPENDED;
  const permissionEnabled = app.permissions?.[resource]?.enabled === true;
  const observed = [];

  // 2. Status (strict blocks suspended apps; lower modes record it and let the alert engine raise R3)
  if (suspended) {
    if (enforcementMode === GUARD_MODES.STRICT) {
      return block('app_suspended', RUNTIME_POLICIES.APP_SUSPENDED, 'medium',
        'Strict mode blocks every request from a suspended application.');
    }
    observed.push({ policy: RUNTIME_POLICIES.APP_SUSPENDED, severity: 'medium', detail: 'app is suspended (not enforced outside strict mode)' });
  }

  // 3. Permission: mandatory in every mode. A revoked permission is ALWAYS denied.
  if (!permissionEnabled) {
    return block('permission_disabled', RUNTIME_POLICIES.PERMISSION_REVOKED, 'medium',
      `Permission for "${resource}" is disabled; permission denials are mandatory in every mode.`, observed);
  }

  // 4 + 5. Behavioural inspection and policy evaluation
  const fired = inspectBehaviour({ app, resource, timestamp, recentEvents });
  const enforced = fired.filter((f) => (
    f.enforcedIn.includes(enforcementMode)
    || (enforcementMode === GUARD_MODES.STRICT && SEVERITY_RANK[f.severity] >= SEVERITY_RANK.high)
  ));

  if (enforced.length > 0) {
    const top = enforced.reduce((a, b) => (SEVERITY_RANK[b.severity] > SEVERITY_RANK[a.severity] ? b : a));
    return block(top.reason, top.policy, top.severity,
      `${top.policy} violated: ${top.detail}. Enforced in ${enforcementMode} mode.`,
      [...observed, ...fired.map((f) => ({ policy: f.policy, severity: f.severity, detail: f.detail }))]);
  }

  // Allowed. Policies that fired but are not enforced in this mode are logged (alerts only).
  const monitored = [...observed, ...fired.map((f) => ({ policy: f.policy, severity: f.severity, detail: f.detail }))];
  if (monitored.length > 0) {
    const top = monitored.reduce((a, b) => (SEVERITY_RANK[b.severity] > SEVERITY_RANK[a.severity] ? b : a));
    return base({
      reason: 'policy_monitored',
      policyTriggered: top.policy,
      severity: top.severity,
      observed: monitored,
      explanation: `${top.policy} observed (${top.detail}); not enforced in ${enforcementMode} mode, alert only.`,
    });
  }
  return base();
}

/**
 * Logs the decision once the event exists. Every request passes through here (ALLOW and BLOCK).
 * Also stamps the guard decision onto the event and its access history entry so it is explainable.
 */
export function recordDecision({ result, app, event }) {
  const entry = store.addGuardDecision({
    appId: app.id,
    eventId: event.id,
    decision: result.decision,
    reason: result.reason,
    policyTriggered: result.policyTriggered,
    enforcementMode: result.enforcementMode,
    severity: result.severity,
    explanation: result.explanation,
    timestamp: event.timestamp,
  });

  event.decisionId = entry.decisionId;

  const historyEntry = (store.history || []).find((h) => h.metadata?.eventId === event.id);
  if (historyEntry) {
    historyEntry.metadata = {
      ...historyEntry.metadata,
      decisionId: entry.decisionId,
      guardDecision: result.decision,
      enforcementMode: result.enforcementMode,
      policyTriggered: result.policyTriggered,
    };
  }
  return entry;
}

export default { evaluate, recordDecision, getGuardMode, setGuardMode, getGuardDecisions };