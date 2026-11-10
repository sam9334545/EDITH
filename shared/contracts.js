// AUTHORITATIVE shared contract. ESM. Backend: import from '../../shared/contracts.js'.
// Frontend: Vite alias '@shared' -> ../shared. Do NOT redefine these elsewhere.
export const RESOURCE_TYPES = Object.freeze(['location', 'contacts', 'camera', 'microphone', 'files']);
export const SENSITIVE_RESOURCES = Object.freeze(['location', 'contacts', 'camera', 'microphone']);
export const APPLICATION_STATUS = Object.freeze({ ACTIVE: 'active', SUSPENDED: 'suspended' });
export const ACCESS_STATUS = Object.freeze({ ALLOWED: 'allowed', DENIED: 'denied' });
export const ALERT_SEVERITY = Object.freeze({ LOW: 'low', MEDIUM: 'medium', HIGH: 'high', CRITICAL: 'critical' });
export const ALERT_TYPES = Object.freeze({
  EXCESSIVE_ACCESS: 'excessive_access',
  UNAUTHORIZED_RESOURCE: 'unauthorized_resource',
  SUSPENDED_APP_ACCESS: 'suspended_app_access',
  REPEATED_RESTRICTED_ACCESS: 'repeated_restricted_access',
  UNUSUAL_RESOURCE_COMBINATION: 'unusual_resource_combination',
});
export const RECOMMENDATION_STATUS = Object.freeze({ PENDING: 'pending', APPLIED: 'applied', DISMISSED: 'dismissed' });
export const RECOMMENDATION_TYPES = Object.freeze({
  RESTRICT_PERMISSION: 'restrict_permission',
  KEEP_DISABLED: 'keep_disabled',
  SUSPEND_APP: 'suspend_app',
  REVIEW_PERMISSION: 'review_permission',
});
export const SUGGESTED_ACTIONS = Object.freeze({ REVOKE_PERMISSION: 'revoke_permission', SUSPEND_APP: 'suspend_app', NONE: 'none' });
export const ACTIVITY_EVENT_TYPES = Object.freeze({
  ACCESS_ALLOWED: 'access_allowed',
  ACCESS_DENIED: 'access_denied',
  ALERT_CREATED: 'alert_created',
  PERMISSION_GRANTED: 'permission_granted',
  PERMISSION_REVOKED: 'permission_revoked',
  APP_SUSPENDED: 'app_suspended',
  APP_REACTIVATED: 'app_reactivated',
  TRUST_SCORE_CHANGED: 'trust_score_changed',
  RECOMMENDATION_CREATED: 'recommendation_created',
  RECOMMENDATION_APPLIED: 'recommendation_applied',
});
export const TRUST_LEVELS = Object.freeze({ HIGH: 'high', MODERATE: 'moderate', LOW: 'low', CRITICAL: 'critical' });
// ---- Runtime Guard (RASP-inspired, simulated; does not monitor system calls) ----
export const GUARD_MODES = Object.freeze({ MONITOR: 'monitor', PROTECT: 'protect', STRICT: 'strict' });
export const DEFAULT_GUARD_MODE = GUARD_MODES.STRICT; // strict keeps the MVP rule "suspended apps are always denied"
export const GUARD_DECISIONS = Object.freeze({ ALLOW: 'ALLOW', BLOCK: 'BLOCK' });
export const RUNTIME_POLICIES = Object.freeze({
  PERMISSION_REVOKED: 'PERMISSION_REVOKED',               // mandatory, every mode
  APP_SUSPENDED: 'APP_SUSPENDED',                         // enforced in strict only
  LOCATION_RATE_LIMIT: 'LOCATION_RATE_LIMIT',             // enforced in protect + strict
  SENSITIVE_COMBINATION_BURST: 'SENSITIVE_COMBINATION_BURST', // high severity, enforced in strict only
});
// Additive denialReason values written by the guard (existing: permission_disabled, app_suspended).
export const GUARD_DENIAL_REASONS = Object.freeze({ RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded', POLICY_VIOLATION: 'policy_violation' });
export const GUARD_CONFIG = Object.freeze({
  LOCATION_RATE_LIMIT: { resource: 'location', maxRequests: 10, windowMs: 60000, severity: 'high' },
  SENSITIVE_COMBINATION_BURST: { distinctSensitive: 3, windowMs: 30000, severity: 'high' },
});

export const ERROR_CODES = Object.freeze([
  'VALIDATION_ERROR', 'APP_NOT_FOUND', 'RESOURCE_INVALID', 'RECOMMENDATION_NOT_FOUND', 'INTERNAL_ERROR', 'RASP_VIOLATION',
]);

// Trust-score constants (single source of truth, owned by M4 logic, defined here)
export const TRUST_CONFIG = Object.freeze({
  MIN: 0, MAX: 100,
  PENALTY: { low: 3, medium: 8, high: 15, critical: 25 },
  RECOVERY_ON_CORRECTIVE_ACTION: 0,
  DEDUPE_WINDOW_MS: 300000,
  EXCESSIVE_ACCESS: { resource: 'location', maxRequests: 10, windowMs: 60000 },
  REPEATED_RESTRICTED: { attempts: 3, windowMs: 300000 },
  COMBINATION: { distinctSensitive: 3, windowMs: 30000 },
});
export function trustLevelFor(score) {
  if (score >= 80) return TRUST_LEVELS.HIGH;
  if (score >= 60) return TRUST_LEVELS.MODERATE;
  if (score >= 40) return TRUST_LEVELS.LOW;
  return TRUST_LEVELS.CRITICAL;
}

export const ok = (data, message = 'Operation completed successfully') => ({ success: true, data, message });
export const fail = (code, message) => ({ success: false, error: { code, message } });

// Lightweight validators (return error string or null)
const iso = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
export function validateAccessPayload(p) {
  if (!p || typeof p.appId !== 'string') return 'appId (string) is required';
  if (!RESOURCE_TYPES.includes(p.resource)) return `resource must be one of ${RESOURCE_TYPES.join(', ')}`;
  if (p.reason !== undefined && typeof p.reason !== 'string') return 'reason must be a string';
  if (p.count !== undefined && !(Number.isInteger(p.count) && p.count >= 1 && p.count <= 100)) return 'count must be integer 1-100';
  return null;
}
export function validatePermissionPatch(p) {
  if (!p || !RESOURCE_TYPES.includes(p.resource)) return `resource must be one of ${RESOURCE_TYPES.join(', ')}`;
  if (typeof p.enabled !== 'boolean') return 'enabled must be boolean';
  return null;
}
export function validateStatusPatch(p) {
  if (!p || !Object.values(APPLICATION_STATUS).includes(p.status)) return `status must be one of ${Object.values(APPLICATION_STATUS).join(', ')}`;
  return null;
}
export function validateGuardModePatch(p) {
  if (!p || !Object.values(GUARD_MODES).includes(p.mode)) return `mode must be one of ${Object.values(GUARD_MODES).join(', ')}`;
  return null;
}
export { iso as isIsoTimestamp };