import {
  BEHAVIOURAL_DNA_CONFIG,
  USAGE_PATTERNS,
  RESOURCE_TYPES,
  SENSITIVE_RESOURCES,
} from '../../shared/contracts.js';
import { store } from '../store/index.js';

/**
 * Normalizes timestamp into epoch milliseconds.
 */
function toEpochMs(timestamp) {
  const ms = new Date(timestamp).getTime();
  return Number.isNaN(ms) ? Date.now() : ms;
}

/**
 * Builds a deterministic behavioural baseline from historical events.
 *
 * @param {string} appId
 * @param {string} resource
 * @param {Array<Object>} events
 * @param {Object} app
 * @returns {Object} BehaviouralBaseline
 */
export function buildBaseline(appId, resource, events = [], app = null) {
  const resourceEvents = events
    .filter((e) => e.appId === appId && e.resource === resource)
    .sort((a, b) => toEpochMs(a.timestamp) - toEpochMs(b.timestamp));

  const count = resourceEvents.length;
  const isGranted = Boolean(app?.permissions?.[resource]?.enabled);
  const isExpected = Boolean(app?.expectedPermissions?.includes(resource));

  let averageAccessFrequency = 0.05; // default modest rate (accesses per hour)
  let expectedUsagePattern = USAGE_PATTERNS.SPORADIC;
  let typicalIntervalMs = 300000; // 5 minutes default
  let lastAccessTimestamp = null;

  if (count > 0) {
    lastAccessTimestamp = resourceEvents[count - 1].timestamp;
    if (count > 1) {
      const firstMs = toEpochMs(resourceEvents[0].timestamp);
      const lastMs = toEpochMs(resourceEvents[count - 1].timestamp);
      const spanHours = Math.max((lastMs - firstMs) / (1000 * 3600), 1);
      averageAccessFrequency = Number((count / spanHours).toFixed(3));

      // Calculate average interval
      let totalInterval = 0;
      for (let i = 1; i < count; i += 1) {
        totalInterval += (toEpochMs(resourceEvents[i].timestamp) - toEpochMs(resourceEvents[i - 1].timestamp));
      }
      typicalIntervalMs = Math.round(totalInterval / (count - 1));
    } else {
      averageAccessFrequency = 0.042; // ~1 per day
    }

    if (typicalIntervalMs < 10000) {
      expectedUsagePattern = USAGE_PATTERNS.BURST_EXPECTED;
    } else if (averageAccessFrequency >= 0.1) {
      expectedUsagePattern = USAGE_PATTERNS.ROUTINE_PERIODIC;
    } else {
      expectedUsagePattern = USAGE_PATTERNS.SPORADIC;
    }
  } else if (!isGranted && !isExpected) {
    averageAccessFrequency = 0;
    expectedUsagePattern = USAGE_PATTERNS.DORMANT;
    typicalIntervalMs = null;
  }

  return {
    appId,
    resource,
    averageAccessFrequency,
    expectedUsagePattern,
    baselineWindow: BEHAVIOURAL_DNA_CONFIG.BASELINE_WINDOW || '7d',
    accessCount: count,
    typicalIntervalMs,
    lastAccessTimestamp,
    updatedAt: lastAccessTimestamp || app?.createdAt || new Date().toISOString(),
  };
}

/**
 * Retrieves the behavioural baseline for an app's resource.
 * Falls back to computing a baseline from store data if not pre-seeded.
 *
 * @param {string} appId
 * @param {string} resource
 * @param {Object} [storeInstance]
 * @returns {Object} BehaviouralBaseline
 */
export function getBaseline(appId, resource, storeInstance = store) {
  if (typeof storeInstance?.getBaseline === 'function') {
    const existing = storeInstance.getBaseline(appId, resource);
    if (existing) return existing;
  }

  const apps = storeInstance?.apps || [];
  const events = storeInstance?.events || [];
  const app = apps.find((a) => a.id === appId);

  const calculated = buildBaseline(appId, resource, events, app);
  if (typeof storeInstance?.updateBaseline === 'function') {
    storeInstance.updateBaseline(appId, resource, calculated);
  }
  return calculated;
}

/**
 * Updates an app's behavioural baseline on new access (dynamic rolling update).
 *
 * @param {string} appId
 * @param {string} resource
 * @param {Object} event
 * @param {Object} [storeInstance]
 * @returns {Object} updated baseline
 */
export function updateBaselineOnAccess(appId, resource, event, storeInstance = store) {
  const current = getBaseline(appId, resource, storeInstance);
  const nowMs = toEpochMs(event.timestamp);
  const newCount = (current.accessCount || 0) + 1;

  let newInterval = current.typicalIntervalMs;
  if (current.lastAccessTimestamp) {
    const elapsed = Math.max(nowMs - toEpochMs(current.lastAccessTimestamp), 0);
    if (elapsed > 0) {
      newInterval = current.typicalIntervalMs
        ? Math.round(current.typicalIntervalMs * 0.8 + elapsed * 0.2)
        : elapsed;
    }
  }

  // Rolling frequency estimate (accesses per hour)
  const windowHours = 24; // rolling 24h baseline window
  const rollingFreq = Number((Math.max(current.averageAccessFrequency * 0.9, 0.02) + (1 / windowHours)).toFixed(3));

  const patch = {
    accessCount: newCount,
    typicalIntervalMs: newInterval,
    lastAccessTimestamp: event.timestamp,
    averageAccessFrequency: rollingFreq,
    updatedAt: event.timestamp,
  };

  if (typeof storeInstance?.updateBaseline === 'function') {
    return storeInstance.updateBaseline(appId, resource, patch);
  }
  return { ...current, ...patch };
}

/**
 * Evaluates composite deviation for an access request against the baseline.
 * Criteria:
 * 1. Frequency spike (>3.0x normal baseline rate)
 * 2. Unusual timing (burst interval < 5s when not expected)
 * 3. Resource shift (accessing dormant or unprofiled resource)
 *
 * @param {Object} event
 * @param {Object} app
 * @param {Object} baseline
 * @param {Array<Object>} recentEvents
 * @returns {{ isAnomaly: boolean, deviationScore: number, reasons: string[], metrics: Object }}
 */
export function evaluateDeviation(event, app, baseline, recentEvents = []) {
  const reasons = [];
  let deviationScore = 0;
  const eventTime = toEpochMs(event.timestamp);

  const baseFreq = baseline?.averageAccessFrequency || 0;
  const pattern = baseline?.expectedUsagePattern || USAGE_PATTERNS.SPORADIC;

  // 1. Frequency check: count same-resource events in the last 60 seconds
  const windowMs = 60000;
  const sameResourceEvents = (recentEvents || []).filter(
    (e) =>
      e.appId === app.id &&
      e.resource === event.resource &&
      toEpochMs(e.timestamp) <= eventTime &&
      toEpochMs(e.timestamp) >= eventTime - windowMs
  );
  // Include current event if not already present
  const countInWindow = sameResourceEvents.some((e) => e.id === event.id)
    ? sameResourceEvents.length
    : sameResourceEvents.length + 1;

  // Hourly rate in current window = count * (3600000 / 60000) = count * 60
  const currentHourlyRate = countInWindow * 60;
  const baselineRateFloor = Math.max(baseFreq, 0.05); // ensure no div by 0
  const frequencyRatio = Number((currentHourlyRate / baselineRateFloor).toFixed(1));

  // If frequency ratio exceeds threshold and count in 60s is abnormally elevated (>3)
  if (countInWindow >= 4 && frequencyRatio >= BEHAVIOURAL_DNA_CONFIG.FREQUENCY_SPIKE_RATIO) {
    deviationScore += BEHAVIOURAL_DNA_CONFIG.WEIGHTS.FREQUENCY_SPIKE;
    reasons.push(
      `Frequency spike: ${countInWindow} ${event.resource} requests in 60s (${frequencyRatio}x baseline rate of ${baseFreq}/hr)`
    );
  }

  // 2. Timing interval check
  let intervalMs = null;
  if (sameResourceEvents.length > 1) {
    const sorted = [...sameResourceEvents].sort((a, b) => toEpochMs(b.timestamp) - toEpochMs(a.timestamp));
    intervalMs = toEpochMs(sorted[0].timestamp) - toEpochMs(sorted[1].timestamp);
  } else if (baseline?.lastAccessTimestamp) {
    intervalMs = Math.max(eventTime - toEpochMs(baseline.lastAccessTimestamp), 0);
  }

  if (
    intervalMs !== null &&
    intervalMs < BEHAVIOURAL_DNA_CONFIG.BURST_BURST_MAX_INTERVAL_MS &&
    pattern !== USAGE_PATTERNS.BURST_EXPECTED &&
    countInWindow >= 5
  ) {
    deviationScore += BEHAVIOURAL_DNA_CONFIG.WEIGHTS.UNUSUAL_TIMING;
    reasons.push(
      `Unusual timing: rapid burst interval of ${(intervalMs / 1000).toFixed(1)}s deviates from ${pattern} baseline`
    );
  }

  // 3. Resource shift check
  const isExpectedPermission = app?.expectedPermissions?.includes(event.resource);
  const isDormant = pattern === USAGE_PATTERNS.DORMANT || baseFreq === 0;

  if (isDormant || (!isExpectedPermission && SENSITIVE_RESOURCES.includes(event.resource))) {
    deviationScore += BEHAVIOURAL_DNA_CONFIG.WEIGHTS.RESOURCE_SHIFT;
    reasons.push(
      `Resource shift: unexpected request to unprofiled resource '${event.resource}' outside normal operational baseline`
    );
  }

  const cappedScore = Math.min(deviationScore, 100);
  const isAnomaly = cappedScore >= BEHAVIOURAL_DNA_CONFIG.SCORE_THRESHOLD;

  return {
    isAnomaly,
    deviationScore: cappedScore,
    reasons,
    metrics: {
      countInWindow,
      frequencyRatio,
      intervalMs,
      baselineFrequency: baseFreq,
      expectedUsagePattern: pattern,
      isDormant,
    },
  };
}

export default {
  buildBaseline,
  getBaseline,
  updateBaselineOnAccess,
  evaluateDeviation,
};