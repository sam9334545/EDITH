import mongoose from 'mongoose';
import {
  ACCESS_STATUS,
  ALERT_SEVERITY,
  ALERT_TYPES,
  FINDING_STATUS,
  POSTURE_CONFIG,
  POSTURE_FINDING_TYPES,
  POSTURE_RISK_LEVELS,
  RESOURCE_TYPES,
} from '../../shared/contracts.js';
import App from '../models/App.js';
import Event from '../models/Event.js';
import Alert from '../models/Alert.js';
import TrustHistory from '../models/TrustHistory.js';
import ActivityHistory from '../models/ActivityHistory.js';
import SecurityFinding from '../models/SecurityFinding.js';
import SecurityPolicy from '../models/SecurityPolicy.js';
import { DEMO_POLICIES } from './demoDataService.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SENSITIVE = new Set(['location', 'contacts', 'camera', 'microphone']);
const clamp = (value) => Math.min(POSTURE_CONFIG.SCORE.MAX, Math.max(POSTURE_CONFIG.SCORE.MIN, value));
const textId = (value) => value?._id?.toString?.() || value?.toString?.() || null;

function serviceError(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function validateAppId(appId) {
  if (typeof appId !== 'string' || !appId.trim()) {
    serviceError('VALIDATION_ERROR', 'appId must be a non-empty string');
  }
}

function parseLimit(value, fallback = 50, maximum = 200) {
  if (value === undefined || value === null || value === '') return fallback;
  if (!/^\d+$/.test(String(value))) {
    serviceError('VALIDATION_ERROR', `limit must be an integer between 1 and ${maximum}`);
  }
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 1 || result > maximum) {
    serviceError('VALIDATION_ERROR', `limit must be an integer between 1 and ${maximum}`);
  }
  return result;
}

function parseOffset(value) {
  if (value === undefined || value === null || value === '') return 0;
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    serviceError('VALIDATION_ERROR', 'offset must be a non-negative integer');
  }
  return Number(value);
}

function parseDate(value, field) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    serviceError('VALIDATION_ERROR', `${field} must be a valid ISO 8601 date`);
  }
  return new Date(value);
}

function mapByAppId(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = textId(row.appId);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return grouped;
}

function publicFinding(finding) {
  const source = finding.toObject ? finding.toObject() : finding;
  const app = source.appId && typeof source.appId === 'object' ? source.appId : null;
  return {
    id: textId(source._id),
    appId: app?.id || textId(source.appId),
    applicationName: app?.name || null,
    findingKey: source.findingKey,
    findingType: source.findingType,
    title: source.title,
    severity: source.severity,
    reason: source.reason,
    permissionResources: source.permissionResources || [],
    relatedEventIds: (source.relatedEventIds || []).map(textId),
    alertIds: (source.alertIds || []).map(textId),
    ruleId: source.ruleId,
    recommendedAction: source.recommendedAction,
    status: source.status,
    conditionActive: source.conditionActive,
    detectedAt: source.detectedAt,
    lastObservedAt: source.lastObservedAt,
    history: source.history || [],
    isDemo: source.isDemo === true,
  };
}

function publicEvent(event, app) {
  return {
    id: textId(event._id),
    appId: app?.id || textId(event.appId),
    applicationName: app?.name || null,
    resource: event.resource,
    reason: event.reason,
    timestamp: event.timestamp,
    status: event.status,
    suspicious: event.suspicious === true,
    denialReason: event.denialReason || null,
    alertId: textId(event.alertId),
    isDemo: event.isDemo === true,
  };
}

function candidate({ key, type, title, severity, reason, resources = [], events = [], alerts = [], ruleId, action, timestamp }) {
  return {
    findingKey: key,
    findingType: type,
    title,
    severity,
    reason,
    permissionResources: resources,
    relatedEventIds: [...new Set(events.map((event) => textId(event._id)))].filter(Boolean),
    alertIds: [...new Set(alerts.map((alert) => textId(alert._id)))].filter(Boolean),
    ruleId: ruleId || null,
    recommendedAction: action,
    timestamp,
  };
}

function findAlertForEvents(alerts, events) {
  const ids = new Set(events.map((event) => textId(event._id)));
  return alerts.filter((alert) => (alert.relatedEventIds || []).some((id) => ids.has(textId(id))));
}

function assessPermissionFindings(app, events, now, policies) {
  const findings = [];
  const excessivePolicy = policies.find((policy) => policy.ruleId === 'PERMISSION_NOT_DECLARED' && policy.enabled);
  const unusedPolicy = policies.find((policy) => policy.ruleId === 'UNUSED_SENSITIVE_PERMISSION' && policy.enabled);
  const combinationPolicy = policies.find((policy) => policy.ruleId === 'RISKY_PERMISSION_COMBINATION' && policy.enabled);
  const expected = new Set(app.expectedPermissions || []);
  const granted = RESOURCE_TYPES.filter((resource) => app.permissions?.[resource]?.enabled);
  const eventByResource = new Map();
  for (const event of events) {
    if (event.status !== ACCESS_STATUS.ALLOWED) continue;
    if (!eventByResource.has(event.resource)) eventByResource.set(event.resource, []);
    eventByResource.get(event.resource).push(event);
  }
  const monitoringStart = events.length
    ? Math.min(...events.map((event) => new Date(event.timestamp).getTime()))
    : now.getTime();

  for (const resource of granted) {
    const permission = app.permissions[resource];
    if (!expected.has(resource) && excessivePolicy) {
      const severity = app.category === 'unknown' && SENSITIVE.has(resource)
        ? ALERT_SEVERITY.CRITICAL
        : excessivePolicy.severity;
      findings.push(candidate({
        key: `excessive:${resource}`,
        type: POSTURE_FINDING_TYPES.EXCESSIVE_PERMISSION,
        title: `Excessive ${resource} permission`,
        severity,
        reason: `${app.name} has ${resource} access enabled, but ${resource} is not listed in its declared requirements${app.category ? ` for the ${app.category} category` : ''}.`,
        resources: [resource],
        ruleId: excessivePolicy.ruleId,
        action: `${excessivePolicy.recommendedAction} Affected resource: ${resource}.`,
        timestamp: permission.grantedAt || app.createdAt,
      }));
    }

    const grantTime = permission.grantedAt ? new Date(permission.grantedAt).getTime() : new Date(app.createdAt).getTime();
    const hasFullWindow = grantTime <= now.getTime() - POSTURE_CONFIG.UNUSED_PERMISSION_DAYS * DAY_MS
      && new Date(app.createdAt).getTime() <= now.getTime() - POSTURE_CONFIG.UNUSED_PERMISSION_DAYS * DAY_MS
      && monitoringStart <= now.getTime() - POSTURE_CONFIG.UNUSED_PERMISSION_DAYS * DAY_MS;
    if (!hasFullWindow || !unusedPolicy) continue;

    const usedRecently = (permission.lastAccessedAt
      && new Date(permission.lastAccessedAt).getTime() >= now.getTime() - POSTURE_CONFIG.UNUSED_PERMISSION_DAYS * DAY_MS)
      || (eventByResource.get(resource) || []).some((event) => (
        new Date(event.timestamp).getTime() >= now.getTime() - POSTURE_CONFIG.UNUSED_PERMISSION_DAYS * DAY_MS
      ));
    if (!usedRecently) {
      findings.push(candidate({
        key: `unused:${resource}`,
        type: POSTURE_FINDING_TYPES.UNUSED_PERMISSION,
        title: `Unused ${resource} permission`,
        severity: SENSITIVE.has(resource) ? unusedPolicy.severity : ALERT_SEVERITY.LOW,
        reason: `${resource} access has been enabled for at least ${POSTURE_CONFIG.UNUSED_PERMISSION_DAYS} days, with no matching access event or last-used timestamp in that monitoring window.`,
        resources: [resource],
        ruleId: unusedPolicy.ruleId,
        action: `${unusedPolicy.recommendedAction} Affected resource: ${resource}.`,
        timestamp: app.createdAt,
      }));
    }
  }

  for (const combination of combinationPolicy ? POSTURE_CONFIG.RISKY_COMBINATIONS : []) {
    if (combination.allowedCategories.includes(app.category)) continue;
    if (!combination.resources.every((resource) => granted.includes(resource))) continue;
    findings.push(candidate({
      key: `combination:${combination.resources.join('+')}`,
      type: POSTURE_FINDING_TYPES.RISKY_COMBINATION,
      title: `Review ${combination.resources.join(' + ')} access combination`,
      severity: app.category === 'unknown' ? ALERT_SEVERITY.CRITICAL : combinationPolicy.severity,
      reason: `${app.name} has ${combination.resources.join(' and ')} access enabled together. This combination can expose sensitive user data and is not expected for the ${app.category || 'unknown'} category; it is a review signal, not proof of malicious activity.`,
      resources: combination.resources,
      ruleId: combinationPolicy.ruleId,
      action: combinationPolicy.recommendedAction,
      timestamp: app.createdAt,
    }));
  }
  return findings;
}

function assessEventFindings(app, events, alerts, policies) {
  const findings = [];
  const repeatedPolicy = policies.find((policy) => policy.ruleId === 'REPEATED_RESTRICTED_ACCESS' && policy.enabled);
  if (repeatedPolicy) {
    const deniedByResource = new Map();
    for (const event of events) {
      if (event.status !== ACCESS_STATUS.DENIED || event.denialReason !== 'permission_disabled') continue;
      if (!deniedByResource.has(event.resource)) deniedByResource.set(event.resource, []);
      deniedByResource.get(event.resource).push(event);
    }
    for (const [resource, denied] of deniedByResource) {
      denied.sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp));
      for (let end = repeatedPolicy.threshold - 1; end < denied.length; end += 1) {
        const group = denied.slice(Math.max(0, end - repeatedPolicy.threshold + 1), end + 1);
        const elapsed = new Date(group.at(-1).timestamp) - new Date(group[0].timestamp);
        if (group.length < repeatedPolicy.threshold || elapsed > 5 * 60 * 1000) continue;
        const linkedAlerts = findAlertForEvents(alerts, group);
        findings.push(candidate({
          key: `repeated-denial:${resource}:${textId(group[0]._id)}`,
          type: POSTURE_FINDING_TYPES.POLICY_VIOLATION,
          title: `Repeated denied ${resource} access`,
          severity: repeatedPolicy.severity,
          reason: `${app.name} made ${group.length} denied requests for disabled ${resource} access within five minutes.`,
          resources: [resource],
          events: group,
          alerts: linkedAlerts,
          ruleId: repeatedPolicy.ruleId,
          action: repeatedPolicy.recommendedAction,
          timestamp: group[0].timestamp,
        }));
        break;
      }
    }
  }

  const frequencyPolicy = policies.find((policy) => policy.ruleId === 'EXCESSIVE_REQUEST_FREQUENCY' && policy.enabled);
  if (frequencyPolicy) {
    const grouped = new Map();
    for (const event of events) {
      if (!grouped.has(event.resource)) grouped.set(event.resource, []);
      grouped.get(event.resource).push(event);
    }
    for (const [resource, resourceEvents] of grouped) {
      resourceEvents.sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp));
      for (let end = frequencyPolicy.threshold; end < resourceEvents.length; end += 1) {
        const group = resourceEvents.slice(end - frequencyPolicy.threshold, end + 1);
        if (new Date(group.at(-1).timestamp) - new Date(group[0].timestamp) > 60_000) continue;
        const linkedAlerts = findAlertForEvents(alerts, group);
        findings.push(candidate({
          key: `frequency:${resource}:${textId(group[0]._id)}`,
          type: POSTURE_FINDING_TYPES.POLICY_VIOLATION,
          title: `Excessive ${resource} request frequency`,
          severity: frequencyPolicy.severity,
          reason: `${app.name} made ${group.length} ${resource} requests within sixty seconds; the configured threshold is ${frequencyPolicy.threshold}.`,
          resources: [resource],
          events: group,
          alerts: linkedAlerts,
          ruleId: frequencyPolicy.ruleId,
          action: frequencyPolicy.recommendedAction,
          timestamp: group[0].timestamp,
        }));
        break;
      }
    }
  }

  for (const alert of alerts) {
    if (alert.acknowledged || alert.severity !== ALERT_SEVERITY.CRITICAL) continue;
    const related = events.filter((event) => (alert.relatedEventIds || [])
      .some((id) => textId(id) === textId(event._id)));
    const policy = policies.find((item) => item.ruleId === 'UNACKNOWLEDGED_CRITICAL_ALERT');
    findings.push(candidate({
      key: `critical-alert:${textId(alert._id)}`,
      type: POSTURE_FINDING_TYPES.UNACKNOWLEDGED_CRITICAL_ALERT,
      title: 'Unacknowledged critical alert',
      severity: ALERT_SEVERITY.CRITICAL,
      reason: `Critical alert "${alert.message}" is still unacknowledged.`,
      resources: alert.resource && RESOURCE_TYPES.includes(alert.resource) ? [alert.resource] : [],
      events: related,
      alerts: [alert],
      ruleId: policy?.ruleId || 'UNACKNOWLEDGED_CRITICAL_ALERT',
      action: policy?.recommendedAction || 'Review and acknowledge the alert after triage.',
      timestamp: alert.timestamp,
    }));
  }
  return findings;
}

async function loadPolicies() {
  const stored = await SecurityPolicy.find({}).lean();
  if (stored.length) return stored;
  return DEMO_POLICIES.map((policy) => ({ ...policy, isDemo: false }));
}

async function synchronizeFindings(apps, eventsByApp, alertsByApp, policies) {
  const now = new Date();
  for (const app of apps) {
    const events = eventsByApp.get(app._id.toString()) || [];
    const alerts = alertsByApp.get(app._id.toString()) || [];
    const candidates = [
      ...assessPermissionFindings(app, events, now, policies),
      ...assessEventFindings(app, events, alerts, policies),
    ];
    const currentKeys = new Set(candidates.map((item) => item.findingKey));

    for (const item of candidates) {
      const timestamp = new Date(item.timestamp || now);
      const existing = await SecurityFinding.findOne({ appId: app._id, findingKey: item.findingKey });
      if (!existing) {
        await SecurityFinding.create({
          appId: app._id,
          ...item,
          status: FINDING_STATUS.OPEN,
          conditionActive: true,
          detectedAt: now,
          lastObservedAt: now,
          history: [{ status: FINDING_STATUS.OPEN, timestamp: now, note: 'Detected by posture assessment.' }],
          isDemo: app.isDemo === true,
        });
        continue;
      }

      existing.title = item.title;
      existing.severity = item.severity;
      existing.reason = item.reason;
      existing.permissionResources = item.permissionResources;
      existing.relatedEventIds = item.relatedEventIds;
      existing.alertIds = item.alertIds;
      existing.ruleId = item.ruleId;
      existing.recommendedAction = item.recommendedAction;
      const conditionWasInactive = existing.conditionActive === false;
      existing.conditionActive = true;
      existing.lastObservedAt = now;
      if (
        existing.status === FINDING_STATUS.RESOLVED
        && conditionWasInactive
        && [
          POSTURE_FINDING_TYPES.EXCESSIVE_PERMISSION,
          POSTURE_FINDING_TYPES.UNUSED_PERMISSION,
          POSTURE_FINDING_TYPES.RISKY_COMBINATION,
          POSTURE_FINDING_TYPES.UNACKNOWLEDGED_CRITICAL_ALERT,
        ].includes(existing.findingType)
      ) {
        existing.status = FINDING_STATUS.OPEN;
        existing.history.push({ status: FINDING_STATUS.OPEN, timestamp: now, note: 'Finding condition reappeared.' });
      }
      await existing.save();
    }

    const managedTypes = [
      POSTURE_FINDING_TYPES.EXCESSIVE_PERMISSION,
      POSTURE_FINDING_TYPES.UNUSED_PERMISSION,
      POSTURE_FINDING_TYPES.RISKY_COMBINATION,
      POSTURE_FINDING_TYPES.UNACKNOWLEDGED_CRITICAL_ALERT,
    ];
    const previouslyDetected = await SecurityFinding.find({
      appId: app._id,
      findingType: { $in: managedTypes },
      conditionActive: true,
    });
    for (const finding of previouslyDetected) {
      if (currentKeys.has(finding.findingKey)) continue;
      finding.conditionActive = false;
      if (finding.status !== FINDING_STATUS.RESOLVED) {
        finding.status = FINDING_STATUS.RESOLVED;
        finding.history.push({
          status: FINDING_STATUS.RESOLVED,
          timestamp: now,
          note: 'The condition is no longer observed by the current assessment.',
        });
      }
      await finding.save();
    }
  }
}

async function postureSnapshot({ appId, includeEvents = true } = {}) {
  const appFilter = appId ? { id: appId } : {};
  const apps = await App.find(appFilter).sort({ id: 1 }).lean();
  if (appId && apps.length === 0) return null;
  const ids = apps.map((app) => app._id);
  const recentFrom = new Date(Date.now() - (POSTURE_CONFIG.UNUSED_PERMISSION_DAYS + 1) * DAY_MS);
  const [events, alerts, trustHistory, findings, policies] = await Promise.all([
    Event.find({ appId: { $in: ids }, timestamp: { $gte: recentFrom } }).sort({ timestamp: -1 }).lean(),
    Alert.find({
      appId: { $in: ids },
      $or: [{ acknowledged: false }, { timestamp: { $gte: recentFrom } }],
    }).sort({ timestamp: -1 }).lean(),
    TrustHistory.find({ appId: { $in: ids }, timestamp: { $gte: recentFrom } }).sort({ timestamp: -1 }).lean(),
    SecurityFinding.find({ appId: { $in: ids } }).sort({ lastObservedAt: -1 }).lean(),
    loadPolicies(),
  ]);
  const eventsByApp = mapByAppId(events);
  const alertsByApp = mapByAppId(alerts);
  if (includeEvents) {
    await synchronizeFindings(apps, eventsByApp, alertsByApp, policies);
  }
  const currentFindings = includeEvents
    ? await SecurityFinding.find({ appId: { $in: ids } }).sort({ lastObservedAt: -1 }).lean()
    : findings;
  return {
    apps,
    events,
    alerts,
    trustHistory,
    findings: currentFindings,
    policies,
    eventsByApp,
    alertsByApp,
    historyByApp: mapByAppId(trustHistory),
    findingsByApp: mapByAppId(currentFindings),
  };
}

function calculateRiskLevel(score) {
  if (score < 40) return POSTURE_RISK_LEVELS.CRITICAL;
  if (score < 60) return POSTURE_RISK_LEVELS.HIGH;
  if (score < 80) return POSTURE_RISK_LEVELS.MEDIUM;
  return POSTURE_RISK_LEVELS.LOW;
}

function applicationAssessment(app, events = [], alerts = [], trustHistory = [], findings = [], policies = []) {
  const openFindings = findings.filter((finding) => finding.status !== FINDING_STATUS.RESOLVED);
  const activeFindings = openFindings.filter((finding) => finding.conditionActive !== false);
  const coveredEventIds = new Set(alerts.flatMap((alert) => alert.relatedEventIds || []).map(textId));
  const unlinkedEvents = new Map();
  for (const event of events) {
    if (!event.suspicious && event.status !== ACCESS_STATUS.DENIED) continue;
    const id = textId(event._id);
    if (!coveredEventIds.has(id)) unlinkedEvents.set(id, event);
  }
  const unusedSensitiveCount = activeFindings.filter((finding) => (
    finding.findingType === POSTURE_FINDING_TYPES.UNUSED_PERMISSION
    && (finding.permissionResources || []).some((resource) => SENSITIVE.has(resource))
  )).length;
  const policyWeight = (ruleId, fallback) => (
    policies.find((policy) => policy.ruleId === ruleId)?.weight ?? fallback
  );
  const deniedWeight = policyWeight(
    'REPEATED_RESTRICTED_ACCESS',
    POSTURE_CONFIG.SCORE.UNLINKED_DENIED_EVENT_PENALTY,
  );
  const suspiciousWeight = policyWeight(
    'EXCESSIVE_REQUEST_FREQUENCY',
    POSTURE_CONFIG.SCORE.UNLINKED_SUSPICIOUS_EVENT_PENALTY,
  );
  const unusedWeight = policyWeight(
    'UNUSED_SENSITIVE_PERMISSION',
    POSTURE_CONFIG.SCORE.UNUSED_SENSITIVE_PERMISSION_PENALTY,
  );
  const enabledPolicies = new Map(policies.filter((policy) => policy.enabled).map((policy) => [policy.ruleId, policy]));
  const eventPenalties = new Map();
  const addEventPenalty = (eventId, weight) => {
    if (coveredEventIds.has(eventId)) return;
    eventPenalties.set(eventId, Math.max(eventPenalties.get(eventId) || 0, weight));
  };
  for (const [eventId, event] of unlinkedEvents) {
    addEventPenalty(eventId, event.status === ACCESS_STATUS.DENIED ? deniedWeight : suspiciousWeight);
  }
  for (const finding of activeFindings) {
    const policy = finding.ruleId ? enabledPolicies.get(finding.ruleId) : null;
    if (finding.findingType !== POSTURE_FINDING_TYPES.POLICY_VIOLATION || !policy) continue;
    for (const eventId of (finding.relatedEventIds || []).map(textId).filter(Boolean)) {
      addEventPenalty(eventId, policy.weight ?? 0);
    }
  }
  const deniedPenalty = [...eventPenalties.values()].reduce((sum, penalty) => sum + penalty, 0);
  const unusedPenalty = unusedSensitiveCount * unusedWeight;
  const excessiveCount = activeFindings.filter((finding) => finding.findingType === POSTURE_FINDING_TYPES.EXCESSIVE_PERMISSION).length;
  const riskyCombinationCount = activeFindings.filter((finding) => finding.findingType === POSTURE_FINDING_TYPES.RISKY_COMBINATION).length;
  const excessiveWeight = policyWeight('PERMISSION_NOT_DECLARED', POSTURE_CONFIG.SCORE.EXCESSIVE_PERMISSION_PENALTY);
  const riskyCombinationWeight = policyWeight('RISKY_PERMISSION_COMBINATION', POSTURE_CONFIG.SCORE.RISKY_COMBINATION_PENALTY);
  const excessiveWeightAdjustment = (POSTURE_CONFIG.SCORE.EXCESSIVE_PERMISSION_PENALTY - excessiveWeight) * excessiveCount;
  const riskyCombinationWeightAdjustment = (POSTURE_CONFIG.SCORE.RISKY_COMBINATION_PENALTY - riskyCombinationWeight) * riskyCombinationCount;
  const postureScore = clamp(
    app.trustScore
    + excessiveWeightAdjustment
    + riskyCombinationWeightAdjustment
    - unusedPenalty
    - deniedPenalty,
  );
  const riskLevel = calculateRiskLevel(postureScore);
  const eventsNewest = [...events].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const openCritical = alerts.filter((alert) => alert.severity === ALERT_SEVERITY.CRITICAL && !alert.acknowledged);
  const scores = [...trustHistory].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const recentTrustChange = scores
    .filter((row) => new Date(row.timestamp).getTime() >= Date.now() - 7 * DAY_MS)
    .reduce((sum, row) => sum + (Number.isFinite(row.change) ? row.change : 0), 0);
  const trend = recentTrustChange > 0 ? 'improving' : recentTrustChange < 0 ? 'deteriorating' : 'stable';
  const usedPermissions = Object.fromEntries(RESOURCE_TYPES.map((resource) => [
    resource,
    Boolean(app.permissions?.[resource]?.lastAccessedAt)
      || events.some((event) => event.resource === resource && event.status === ACCESS_STATUS.ALLOWED),
  ]));
  const enabled = RESOURCE_TYPES.filter((resource) => app.permissions?.[resource]?.enabled);
  const now = Date.now();
  const permissionUsage = Object.fromEntries(RESOURCE_TYPES.map((resource) => {
    const permission = app.permissions?.[resource] || {};
    const grantTime = permission.grantedAt ? new Date(permission.grantedAt).getTime() : new Date(app.createdAt).getTime();
    const monitoringStart = events.length
      ? Math.min(...events.map((event) => new Date(event.timestamp).getTime()))
      : now;
    const historySufficient = grantTime <= now - POSTURE_CONFIG.UNUSED_PERMISSION_DAYS * DAY_MS
      && new Date(app.createdAt).getTime() <= now - POSTURE_CONFIG.UNUSED_PERMISSION_DAYS * DAY_MS
      && monitoringStart <= now - POSTURE_CONFIG.UNUSED_PERMISSION_DAYS * DAY_MS;
    const lastEvent = [...events]
      .filter((event) => event.resource === resource && event.status === ACCESS_STATUS.ALLOWED)
      .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))[0];
    const lastUsedAt = permission.lastAccessedAt || lastEvent?.timestamp || null;
    const usedInWindow = Boolean(lastUsedAt && new Date(lastUsedAt).getTime() >= now - POSTURE_CONFIG.UNUSED_PERMISSION_DAYS * DAY_MS);
    return [resource, {
      enabled: permission.enabled === true,
      status: permission.enabled !== true
        ? 'disabled'
        : !historySufficient
          ? 'insufficient_history'
          : usedInWindow ? 'used' : 'never_used',
      lastUsedAt,
      monitoredDays: Math.max(0, Math.floor((now - Math.max(grantTime, new Date(app.createdAt).getTime(), monitoringStart)) / DAY_MS)),
    }];
  }));
  const permissionRisk = {
    excessive: excessiveCount,
    unused: activeFindings.filter((finding) => finding.findingType === POSTURE_FINDING_TYPES.UNUSED_PERMISSION).length,
    riskyCombinations: activeFindings.filter((finding) => finding.findingType === POSTURE_FINDING_TYPES.RISKY_COMBINATION).length,
    enabled: enabled.length,
    usage: usedPermissions,
    usageDetails: permissionUsage,
  };
  const violationEvents = new Set(activeFindings
    .filter((finding) => finding.findingType === POSTURE_FINDING_TYPES.POLICY_VIOLATION)
    .flatMap((finding) => finding.relatedEventIds || [])
    .map(textId));
  const explanations = [
    `Existing trust score ${app.trustScore} is the base; its recorded alert penalties are already included.`,
    ...(excessiveWeightAdjustment ? [`${excessiveWeightAdjustment > 0 ? '+' : ''}${excessiveWeightAdjustment} adjustment for ${excessiveCount} excessive permission finding(s) using the configured policy weight.`] : []),
    ...(riskyCombinationWeightAdjustment ? [`${riskyCombinationWeightAdjustment > 0 ? '+' : ''}${riskyCombinationWeightAdjustment} adjustment for ${riskyCombinationCount} risky permission combination finding(s) using the configured policy weight.`] : []),
    ...(unusedPenalty ? [`-${unusedPenalty} for ${unusedSensitiveCount} unused sensitive permission finding(s).`] : []),
    ...(deniedPenalty ? [`-${deniedPenalty} for ${eventPenalties.size} unique suspicious, denied, or policy-violation event(s) not already linked to an alert.`] : []),
    ...(coveredEventIds.size ? [`${coveredEventIds.size} alert-linked event reference(s) are not penalized again.`] : []),
  ];

  return {
    id: app.id,
    name: app.name,
    description: app.description,
    category: app.category || 'unknown',
    expectedPermissions: app.expectedPermissions || [],
    permissions: app.permissions,
    status: app.status,
    trustScore: app.trustScore,
    postureScore,
    riskLevel,
    riskBreakdown: {
      baseTrustScore: app.trustScore,
      excessivePermissions: { count: excessiveCount, configuredWeight: excessiveWeight, adjustment: excessiveWeightAdjustment },
      riskyPermissionCombinations: { count: riskyCombinationCount, configuredWeight: riskyCombinationWeight, adjustment: riskyCombinationWeightAdjustment },
      unusedSensitivePermissions: { count: unusedSensitiveCount, penalty: unusedPenalty, weight: unusedWeight },
      uniqueUnlinkedSecurityEvents: { count: eventPenalties.size, penalty: deniedPenalty },
      alertLinkedEventIds: [...coveredEventIds],
      uniquePolicyViolationEventIds: [...violationEvents],
      scoreBreakdown: [
        { factor: 'existing_trust_score', amount: app.trustScore, note: 'Already includes recorded alert penalties and initial permission-profile scoring.' },
        { factor: 'excessive_permissions', amount: excessiveWeightAdjustment, count: excessiveCount, weight: excessiveWeight },
        { factor: 'risky_permission_combinations', amount: riskyCombinationWeightAdjustment, count: riskyCombinationCount, weight: riskyCombinationWeight },
        { factor: 'unused_sensitive_permissions', amount: -unusedPenalty, weight: unusedWeight },
        { factor: 'unique_unlinked_security_events', amount: -deniedPenalty, deniedWeight, suspiciousWeight },
      ],
      explanations,
    },
    permissionRisk,
    configurationCompliance: Math.max(0, 100 - activeFindings.filter((finding) => (
      finding.findingType === POSTURE_FINDING_TYPES.POLICY_VIOLATION
    )).length * 10),
    unresolvedFindings: activeFindings.length,
    criticalAlerts: openCritical.length,
    recentSuspiciousActivities: events.filter((event) => event.suspicious).length,
    lastActivity: eventsNewest[0]?.timestamp || app.updatedAt,
    lastSecurityAssessment: new Date().toISOString(),
    trend,
    recommendedActions: activeFindings.map((finding) => finding.recommendedAction),
    isDemo: app.isDemo === true,
  };
}

function queryFilters(query = {}) {
  const { appId, severity, status, findingType, resource, from, to } = query;
  if (appId !== undefined) validateAppId(appId);
  if (severity !== undefined && !Object.values(ALERT_SEVERITY).includes(severity)) {
    serviceError('VALIDATION_ERROR', `severity must be one of ${Object.values(ALERT_SEVERITY).join(', ')}`);
  }
  if (status !== undefined && !Object.values(FINDING_STATUS).includes(status)) {
    serviceError('VALIDATION_ERROR', `status must be one of ${Object.values(FINDING_STATUS).join(', ')}`);
  }
  if (findingType !== undefined && !Object.values(POSTURE_FINDING_TYPES).includes(findingType)) {
    serviceError('VALIDATION_ERROR', 'findingType is invalid');
  }
  if (resource !== undefined && !RESOURCE_TYPES.includes(resource)) {
    serviceError('VALIDATION_ERROR', `resource must be one of: ${RESOURCE_TYPES.join(', ')}`);
  }
  const fromDate = parseDate(from, 'from');
  const toDate = parseDate(to, 'to');
  if (fromDate && toDate && fromDate > toDate) {
    serviceError('VALIDATION_ERROR', 'from must not be later than to');
  }
  return { appId, severity, status, findingType, resource, fromDate, toDate };
}

export async function getPostureOverview(query = {}) {
  const snapshot = await postureSnapshot();
  const assessments = snapshot.apps.map((app) => applicationAssessment(
    app,
    snapshot.eventsByApp.get(app._id.toString()) || [],
    snapshot.alertsByApp.get(app._id.toString()) || [],
    snapshot.historyByApp.get(app._id.toString()) || [],
    snapshot.findingsByApp.get(app._id.toString()) || [],
    snapshot.policies,
  ));
  const activeFindings = snapshot.findings.filter((finding) => finding.status !== FINDING_STATUS.RESOLVED);
  const range = query.days === undefined ? 7 : Number(query.days);
  if (![7, 30].includes(range)) serviceError('VALIDATION_ERROR', 'days must be 7 or 30');
  const since = new Date(Date.now() - range * DAY_MS);
  const recentEvents = snapshot.events.filter((event) => new Date(event.timestamp) >= since);
  const riskLevels = Object.values(POSTURE_RISK_LEVELS);
  const distribution = riskLevels.map((riskLevel) => ({
    riskLevel,
    count: assessments.filter((assessment) => assessment.riskLevel === riskLevel).length,
  }));
  const scoreRanges = [
    { range: '0-19', min: 0, max: 19 },
    { range: '20-39', min: 20, max: 39 },
    { range: '40-59', min: 40, max: 59 },
    { range: '60-79', min: 60, max: 79 },
    { range: '80-100', min: 80, max: 100 },
  ].map(({ range: label, min, max }) => ({
    range: label,
    count: assessments.filter((item) => item.postureScore >= min && item.postureScore <= max).length,
  }));
  const criticalAlerts = snapshot.alerts.filter((alert) => (
    alert.severity === ALERT_SEVERITY.CRITICAL && !alert.acknowledged
  ));
  return {
    summary: {
      totalApplications: assessments.length,
      criticalRiskApplications: assessments.filter((item) => item.riskLevel === POSTURE_RISK_LEVELS.CRITICAL).length,
      highRiskApplications: assessments.filter((item) => item.riskLevel === POSTURE_RISK_LEVELS.HIGH).length,
      openFindings: activeFindings.length,
      unacknowledgedCriticalAlerts: criticalAlerts.length,
      blockedRuntimeEvents: recentEvents.filter((event) => event.status === ACCESS_STATUS.DENIED).length,
    },
    riskDistribution: distribution,
    trustScoreDistribution: scoreRanges,
    applications: assessments.sort((left, right) => left.postureScore - right.postureScore),
    runtime: {
      allowed: recentEvents.filter((event) => event.status === ACCESS_STATUS.ALLOWED).length,
      blocked: recentEvents.filter((event) => event.status === ACCESS_STATUS.DENIED).length,
      suspicious: recentEvents.filter((event) => event.suspicious).length,
      demoEvents: recentEvents.filter((event) => event.isDemo).length,
      recordedEvents: recentEvents.filter((event) => !event.isDemo).length,
    },
    permissionAnalytics: {
      excessive: activeFindings.filter((finding) => finding.findingType === POSTURE_FINDING_TYPES.EXCESSIVE_PERMISSION).length,
      unused: activeFindings.filter((finding) => finding.findingType === POSTURE_FINDING_TYPES.UNUSED_PERMISSION).length,
      riskyCombinations: activeFindings.filter((finding) => finding.findingType === POSTURE_FINDING_TYPES.RISKY_COMBINATION).length,
      sensitiveResources: RESOURCE_TYPES.filter((resource) => SENSITIVE.has(resource)).map((resource) => ({
        resource,
        enabled: snapshot.apps.filter((app) => app.permissions?.[resource]?.enabled).length,
      })),
    },
    findingStatus: {
      resolved: snapshot.findings.filter((finding) => finding.status === FINDING_STATUS.RESOLVED).length,
      unresolved: activeFindings.length,
    },
    generatedAt: new Date().toISOString(),
    rangeDays: range,
  };
}

export async function getPostureApplications(query = {}) {
  const riskLevel = query.riskLevel;
  if (riskLevel !== undefined && !Object.values(POSTURE_RISK_LEVELS).includes(riskLevel)) {
    serviceError('VALIDATION_ERROR', `riskLevel must be one of ${Object.values(POSTURE_RISK_LEVELS).join(', ')}`);
  }
  const snapshot = await postureSnapshot();
  const rows = snapshot.apps.map((app) => applicationAssessment(
    app,
    snapshot.eventsByApp.get(app._id.toString()) || [],
    snapshot.alertsByApp.get(app._id.toString()) || [],
    snapshot.historyByApp.get(app._id.toString()) || [],
    snapshot.findingsByApp.get(app._id.toString()) || [],
    snapshot.policies,
  )).filter((item) => (
    (!query.appId || item.id === query.appId)
    && (!riskLevel || item.riskLevel === riskLevel)
    && (!query.category || item.category === query.category)
  ));
  if (query.appId && rows.length === 0 && !snapshot.apps.some((app) => app.id === query.appId)) return null;
  return rows;
}

export async function getApplicationPosture(appId) {
  validateAppId(appId);
  const snapshot = await postureSnapshot({ appId });
  if (!snapshot) return null;
  const app = snapshot.apps[0];
  const assessment = applicationAssessment(
    app,
    snapshot.eventsByApp.get(app._id.toString()) || [],
    snapshot.alertsByApp.get(app._id.toString()) || [],
    snapshot.historyByApp.get(app._id.toString()) || [],
    snapshot.findingsByApp.get(app._id.toString()) || [],
    snapshot.policies,
  );
  return {
    ...assessment,
    findings: (snapshot.findingsByApp.get(app._id.toString()) || []).map(publicFinding),
    alerts: (snapshot.alertsByApp.get(app._id.toString()) || []).map((alert) => ({
      id: textId(alert._id),
      severity: alert.severity,
      type: alert.alertType,
      message: alert.message,
      acknowledged: alert.acknowledged,
      timestamp: alert.timestamp,
      relatedEventIds: (alert.relatedEventIds || []).map(textId),
    })),
    recentEvents: (snapshot.eventsByApp.get(app._id.toString()) || [])
      .slice(0, 20)
      .map((event) => publicEvent(event, app)),
  };
}

export async function getPostureFindings(query = {}) {
  const filters = queryFilters(query);
  const snapshot = await postureSnapshot();
  const app = filters.appId ? snapshot.apps.find((item) => item.id === filters.appId) : null;
  if (filters.appId && !app) return { items: [], total: 0, limit: parseLimit(query.limit), offset: parseOffset(query.offset) };
  const dbFilter = {};
  if (app) dbFilter.appId = app._id;
  if (filters.severity) dbFilter.severity = filters.severity;
  if (filters.status) dbFilter.status = filters.status;
  if (filters.findingType) dbFilter.findingType = filters.findingType;
  if (filters.resource) dbFilter.permissionResources = filters.resource;
  const dateFilter = {};
  if (filters.fromDate) dateFilter.$gte = filters.fromDate;
  if (filters.toDate) dateFilter.$lte = filters.toDate;
  if (Object.keys(dateFilter).length) dbFilter.lastObservedAt = dateFilter;
  const limit = parseLimit(query.limit);
  const offset = parseOffset(query.offset);
  const [total, items] = await Promise.all([
    SecurityFinding.countDocuments(dbFilter),
    SecurityFinding.find(dbFilter)
      .sort({ lastObservedAt: -1, _id: -1 })
      .skip(offset)
      .limit(limit)
      .populate('appId', 'id name')
      .lean(),
  ]);
  return { items: items.map(publicFinding), total, limit, offset };
}

export async function getPostureFinding(findingId) {
  if (!mongoose.isValidObjectId(findingId)) return null;
  await postureSnapshot();
  const finding = await SecurityFinding.findById(findingId).populate('appId', 'id name').lean();
  return finding ? publicFinding(finding) : null;
}

export async function updateFindingStatus(findingId, action) {
  if (!mongoose.isValidObjectId(findingId)) serviceError('FINDING_NOT_FOUND', 'Finding not found');
  if (!['acknowledge', 'resolve'].includes(action)) serviceError('VALIDATION_ERROR', 'Invalid finding action');
  const finding = await SecurityFinding.findById(findingId);
  if (!finding) serviceError('FINDING_NOT_FOUND', 'Finding not found');
  const timestamp = new Date();

  if (action === 'resolve' && [
    POSTURE_FINDING_TYPES.EXCESSIVE_PERMISSION,
    POSTURE_FINDING_TYPES.UNUSED_PERMISSION,
    POSTURE_FINDING_TYPES.RISKY_COMBINATION,
  ].includes(finding.findingType) && finding.conditionActive) {
    serviceError('VALIDATION_ERROR', 'Remediate the permission condition before resolving this finding');
  }
  if (action === 'acknowledge' && finding.alertIds.length) {
    await Alert.updateMany({ _id: { $in: finding.alertIds } }, { $set: { acknowledged: true } });
  }
  const nextStatus = action === 'acknowledge' ? FINDING_STATUS.ACKNOWLEDGED : FINDING_STATUS.RESOLVED;
  if (finding.status !== nextStatus) {
    finding.status = nextStatus;
    if (action === 'resolve' && finding.findingType !== POSTURE_FINDING_TYPES.POLICY_VIOLATION) {
      finding.conditionActive = false;
    }
    finding.history.push({
      status: nextStatus,
      timestamp,
      note: action === 'acknowledge' ? 'Finding acknowledged for triage.' : 'Finding marked resolved after review.',
    });
    await finding.save();
  }
  return publicFinding(await SecurityFinding.findById(finding._id).populate('appId', 'id name').lean());
}

export async function getPosturePolicies() {
  const policies = await loadPolicies();
  return policies.map((policy) => ({
    ruleId: policy.ruleId,
    name: policy.name,
    description: policy.description,
    condition: policy.condition,
    severity: policy.severity,
    threshold: policy.threshold,
    weight: policy.weight ?? 0,
    enabled: policy.enabled,
    recommendedAction: policy.recommendedAction,
    isDemo: policy.isDemo === true,
  }));
}

export async function updatePosturePolicy(ruleId, body = {}) {
  const allowedFields = new Set(['enabled', 'threshold', 'weight', 'severity', 'recommendedAction']);
  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => !allowedFields.has(key))) {
    serviceError('VALIDATION_ERROR', 'Provide one or more supported policy fields');
  }
  const updates = {};
  if ('enabled' in body) {
    if (typeof body.enabled !== 'boolean') serviceError('VALIDATION_ERROR', 'enabled must be boolean');
    updates.enabled = body.enabled;
  }
  if ('threshold' in body) {
    if (!Number.isSafeInteger(body.threshold) || body.threshold < 1 || body.threshold > 1000) {
      serviceError('VALIDATION_ERROR', 'threshold must be an integer between 1 and 1000');
    }
    updates.threshold = body.threshold;
  }
  if ('weight' in body) {
    if (!Number.isSafeInteger(body.weight) || body.weight < 0 || body.weight > 100) {
      serviceError('VALIDATION_ERROR', 'weight must be an integer between 0 and 100');
    }
    updates.weight = body.weight;
  }
  if ('severity' in body) {
    if (!Object.values(ALERT_SEVERITY).includes(body.severity)) {
      serviceError('VALIDATION_ERROR', `severity must be one of ${Object.values(ALERT_SEVERITY).join(', ')}`);
    }
    updates.severity = body.severity;
  }
  if ('recommendedAction' in body) {
    if (typeof body.recommendedAction !== 'string' || !body.recommendedAction.trim()) {
      serviceError('VALIDATION_ERROR', 'recommendedAction must be a non-empty string');
    }
    updates.recommendedAction = body.recommendedAction.trim();
  }
  const policy = await SecurityPolicy.findOneAndUpdate({ ruleId }, { $set: updates }, { new: true }).lean();
  if (!policy) serviceError('POLICY_NOT_FOUND', `Policy ${ruleId} not found`);
  return (await getPosturePolicies()).find((item) => item.ruleId === ruleId);
}

export async function getPostureRuntimeEvents(query = {}) {
  const { appId, status, from, to } = query;
  if (appId !== undefined) validateAppId(appId);
  if (status !== undefined && !Object.values(ACCESS_STATUS).includes(status)) {
    serviceError('VALIDATION_ERROR', `status must be one of ${Object.values(ACCESS_STATUS).join(', ')}`);
  }
  const fromDate = parseDate(from, 'from');
  const toDate = parseDate(to, 'to');
  if (fromDate && toDate && fromDate > toDate) serviceError('VALIDATION_ERROR', 'from must not be later than to');
  const filter = {};
  if (appId) {
    const app = await App.findOne({ id: appId }).select('_id').lean();
    if (!app) return { items: [], total: 0, limit: parseLimit(query.limit), offset: parseOffset(query.offset) };
    filter.appId = app._id;
  }
  if (status) filter.status = status;
  if (query.suspicious !== undefined) {
    if (query.suspicious !== 'true' && query.suspicious !== 'false') {
      serviceError('VALIDATION_ERROR', 'suspicious must be true or false');
    }
    filter.suspicious = query.suspicious === 'true';
  }
  if (fromDate || toDate) {
    filter.timestamp = {};
    if (fromDate) filter.timestamp.$gte = fromDate;
    if (toDate) filter.timestamp.$lte = toDate;
  }
  const limit = parseLimit(query.limit);
  const offset = parseOffset(query.offset);
  const [total, events] = await Promise.all([
    Event.countDocuments(filter),
    Event.find(filter).sort({ timestamp: -1, _id: -1 }).skip(offset).limit(limit).populate('appId', 'id name').lean(),
  ]);
  return {
    items: events.map((event) => publicEvent(event, event.appId)),
    total,
    limit,
    offset,
  };
}

export async function getPostureIncidents(query = {}) {
  const { appId, severity, status, from, to, eventId } = query;
  if (appId !== undefined) validateAppId(appId);
  if (severity !== undefined && !Object.values(ALERT_SEVERITY).includes(severity)) {
    serviceError('VALIDATION_ERROR', `severity must be one of ${Object.values(ALERT_SEVERITY).join(', ')}`);
  }
  if (status !== undefined && !Object.values(ACCESS_STATUS).includes(status)) {
    serviceError('VALIDATION_ERROR', `status must be one of ${Object.values(ACCESS_STATUS).join(', ')}`);
  }
  if (eventId !== undefined && !mongoose.isValidObjectId(eventId)) {
    return { items: [], total: 0, limit: 1, offset: 0 };
  }
  const fromDate = parseDate(from, 'from');
  const toDate = parseDate(to, 'to');
  if (fromDate && toDate && fromDate > toDate) serviceError('VALIDATION_ERROR', 'from must not be later than to');
  const filter = { $or: [{ suspicious: true }, { status: ACCESS_STATUS.DENIED }] };
  if (eventId) filter._id = new mongoose.Types.ObjectId(eventId);
  if (appId) {
    const app = await App.findOne({ id: appId }).select('_id').lean();
    if (!app) return { items: [], total: 0, limit: parseLimit(query.limit), offset: parseOffset(query.offset) };
    filter.appId = app._id;
  }
  if (fromDate || toDate) {
    filter.timestamp = {};
    if (fromDate) filter.timestamp.$gte = fromDate;
    if (toDate) filter.timestamp.$lte = toDate;
  }
  const events = await Event.find(filter).sort({ timestamp: -1, _id: -1 }).populate('appId', 'id name category permissions expectedPermissions').lean();
  const ids = events.map((event) => event._id);
  const [alerts, history, trustRows, findings] = await Promise.all([
    Alert.find({ relatedEventIds: { $in: ids } }).sort({ timestamp: -1 }).lean(),
    ActivityHistory.find({ 'metadata.eventId': { $in: ids.map(String) } }).sort({ timestamp: 1 }).lean(),
    TrustHistory.find({}).sort({ timestamp: -1 }).lean(),
    SecurityFinding.find({ relatedEventIds: { $in: ids } }).lean(),
  ]);
  const alertsByEvent = new Map();
  for (const alert of alerts) {
    for (const eventId of alert.relatedEventIds || []) {
      const key = textId(eventId);
      if (!alertsByEvent.has(key)) alertsByEvent.set(key, []);
      alertsByEvent.get(key).push(alert);
    }
  }
  const historyByEvent = new Map();
  for (const item of history) {
    const key = item.metadata?.eventId;
    if (!historyByEvent.has(key)) historyByEvent.set(key, []);
    historyByEvent.get(key).push(item);
  }
  const trustByAlert = new Map(trustRows.filter((item) => item.alertId).map((item) => [textId(item.alertId), item]));
  const findingsByEvent = new Map();
  for (const finding of findings) {
    for (const relatedEventId of finding.relatedEventIds || []) {
      const key = textId(relatedEventId);
      if (!findingsByEvent.has(key)) findingsByEvent.set(key, []);
      findingsByEvent.get(key).push(finding);
    }
  }
  let incidents = events.map((event) => {
    const linkedAlerts = alertsByEvent.get(textId(event._id)) || [];
    const linkedFindings = findingsByEvent.get(textId(event._id)) || [];
    if (severity && !linkedAlerts.some((alert) => alert.severity === severity)) return null;
    if (status && event.status !== status) return null;
    const relatedIds = new Set(linkedAlerts.map((alert) => textId(alert._id)));
    const scoreHistory = [...relatedIds]
      .map((id) => trustByAlert.get(id))
      .filter(Boolean)
      .sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp));
    const scoreImpact = scoreHistory.reduce((sum, row) => sum + (row.penalty || 0), 0);
    const scoreChange = scoreHistory.reduce((sum, row) => sum + row.change, 0);
    const permissionEnabled = event.appId.permissions?.[event.resource]?.enabled === true;
    const expected = event.appId.expectedPermissions || [];
    const explanation = event.status === ACCESS_STATUS.DENIED
      ? `${event.resource} access was blocked by the simulated permission decision (${event.denialReason || 'policy violation'}).`
      : `${event.resource} access was allowed by the simulated permission decision and recorded for review.`;
    return {
      id: textId(event._id),
      eventId: textId(event._id),
      appId: event.appId.id,
      applicationName: event.appId.name,
      resource: event.resource,
      timestamp: event.timestamp,
      decision: event.status === ACCESS_STATUS.DENIED ? 'blocked' : 'allowed',
      simulated: event.isDemo === true,
      whatHappened: event.reason,
      expected: expected.includes(event.resource) && permissionEnabled
        ? `${event.resource} is declared and enabled for this fictional application.`
        : `${event.resource} is not both declared and enabled for this application.`,
      observed: explanation,
      ruleTriggered: linkedAlerts.map((alert) => alert.alertType),
      severity: linkedAlerts.map((alert) => alert.severity).sort((a, b) => (
        Object.values(ALERT_SEVERITY).indexOf(b) - Object.values(ALERT_SEVERITY).indexOf(a)
      ))[0] || (event.status === ACCESS_STATUS.DENIED ? ALERT_SEVERITY.MEDIUM : ALERT_SEVERITY.LOW),
      trustScoreImpact: scoreImpact,
      trustScoreBefore: scoreHistory.length ? scoreHistory[0].previousScore : null,
      trustScoreChange: scoreHistory.length ? scoreChange : null,
      trustScoreAfter: scoreHistory.length ? scoreHistory.at(-1).newScore : null,
      status: linkedFindings[0]?.status || null,
      findings: linkedFindings.map((finding) => ({
        id: textId(finding._id),
        title: finding.title,
        ruleId: finding.ruleId,
        reason: finding.reason,
        status: finding.status,
        recommendedAction: finding.recommendedAction,
        history: finding.history || [],
      })),
      nextAction: linkedAlerts.length
        ? 'Review the linked alert and its recommended action.'
        : event.status === ACCESS_STATUS.DENIED
          ? 'Confirm that the blocked resource should remain disabled.'
          : 'Review whether the observed request matches the declared application purpose.',
      alerts: linkedAlerts.map((alert) => ({
        id: textId(alert._id),
        type: alert.alertType,
        severity: alert.severity,
        message: alert.message,
        acknowledged: alert.acknowledged,
      })),
      timeline: [
        { type: 'runtime_event', timestamp: event.timestamp, description: event.reason },
        ...(historyByEvent.get(textId(event._id)) || []).map((item) => ({
          type: item.eventType,
          timestamp: item.timestamp,
          description: item.description,
        })),
        ...linkedAlerts.map((alert) => ({
          type: 'security_alert',
          timestamp: alert.timestamp,
          description: alert.message,
        })),
        ...linkedFindings.flatMap((finding) => (finding.history || []).map((item) => ({
          type: `finding_${item.status}`,
          timestamp: item.timestamp,
          description: item.note,
        }))),
      ].sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp)),
    };
  }).filter(Boolean);
  const total = incidents.length;
  const limit = parseLimit(query.limit);
  const offset = parseOffset(query.offset);
  incidents = incidents.slice(offset, offset + limit);
  return { items: incidents, total, limit, offset };
}

export async function getPostureTrends(query = {}) {
  const days = query.days === undefined ? 30 : Number(query.days);
  if (![7, 30].includes(days)) serviceError('VALIDATION_ERROR', 'days must be 7 or 30');
  const overview = await getPostureOverview({ days });
  const snapshot = await postureSnapshot({ includeEvents: false });
  const from = new Date(Date.now() - days * DAY_MS);
  const dateMap = new Map();
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(from.getTime() + offset * DAY_MS).toISOString().slice(0, 10);
    dateMap.set(date, { date, allowed: 0, blocked: 0, suspicious: 0, violations: 0, trustScoreChanges: 0 });
  }
  for (const event of snapshot.events) {
    const date = new Date(event.timestamp).toISOString().slice(0, 10);
    const day = dateMap.get(date);
    if (!day) continue;
    if (event.status === ACCESS_STATUS.DENIED) day.blocked += 1;
    else day.allowed += 1;
    if (event.suspicious) day.suspicious += 1;
  }
  for (const row of snapshot.trustHistory) {
    const date = new Date(row.timestamp).toISOString().slice(0, 10);
    const day = dateMap.get(date);
    if (day && row.change !== 0) day.trustScoreChanges += 1;
  }
  for (const finding of snapshot.findings) {
    const date = new Date(finding.detectedAt).toISOString().slice(0, 10);
    const day = dateMap.get(date);
    if (day && finding.findingType === POSTURE_FINDING_TYPES.POLICY_VIOLATION) day.violations += 1;
  }
  const points = [...dateMap.values()];
  return {
    days,
    points,
    findingStatus: overview.findingStatus,
    trustScoreChanges: points.map((point) => ({ date: point.date, count: point.trustScoreChanges })),
    violationCounts: points.map((point) => ({ date: point.date, count: point.violations })),
  };
}

export default {
  getPostureOverview,
  getPostureApplications,
  getApplicationPosture,
  getPostureFindings,
  getPostureFinding,
  updateFindingStatus,
  getPosturePolicies,
  updatePosturePolicy,
  getPostureRuntimeEvents,
  getPostureIncidents,
  getPostureTrends,
};
