import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import {
  ACCESS_STATUS,
  ACTIVITY_EVENT_TYPES,
  ALERT_SEVERITY,
  ALERT_TYPES,
  POSTURE_CONFIG,
  RECOMMENDATION_STATUS,
  RECOMMENDATION_TYPES,
  SUGGESTED_ACTIONS,
} from '../../shared/contracts.js';
import seedData from '../data/seedData.js';
import App from '../models/App.js';
import Event from '../models/Event.js';
import Alert from '../models/Alert.js';
import TrustHistory from '../models/TrustHistory.js';
import Recommendation from '../models/Recommendation.js';
import ActivityHistory from '../models/ActivityHistory.js';
import SecurityPolicy from '../models/SecurityPolicy.js';
import { calculateTrustScore, changeReasonFor, penaltyFor } from './trustScore.js';

const DEMO_POLICIES = Object.freeze([
  {
    ruleId: 'PERMISSION_NOT_DECLARED',
    name: 'Permission exceeds declared requirements',
    description: 'Detect an enabled permission not listed in the application declared profile.',
    condition: 'enabled permission is absent from expectedPermissions',
    severity: ALERT_SEVERITY.HIGH,
    threshold: 1,
    weight: POSTURE_CONFIG.SCORE.EXCESSIVE_PERMISSION_PENALTY,
    recommendedAction: 'Review and revoke permission not required by the declared application function.',
  },
  {
    ruleId: 'UNUSED_SENSITIVE_PERMISSION',
    name: 'Unused sensitive permission',
    description: 'Detect a sensitive permission with no observed access across the monitoring window.',
    condition: `no access event for ${POSTURE_CONFIG.UNUSED_PERMISSION_DAYS} monitored days`,
    severity: ALERT_SEVERITY.MEDIUM,
    threshold: POSTURE_CONFIG.UNUSED_PERMISSION_DAYS,
    weight: POSTURE_CONFIG.SCORE.UNUSED_SENSITIVE_PERMISSION_PENALTY,
    recommendedAction: 'Confirm the permission is required, then revoke it if unused.',
  },
  {
    ruleId: 'REPEATED_RESTRICTED_ACCESS',
    name: 'Repeated denied access',
    description: 'Detect repeated requests for a disabled resource.',
    condition: 'denied permission requests within five minutes',
    severity: ALERT_SEVERITY.HIGH,
    threshold: POSTURE_CONFIG.REPEATED_DENIAL_THRESHOLD,
    weight: POSTURE_CONFIG.SCORE.UNLINKED_DENIED_EVENT_PENALTY,
    recommendedAction: 'Review the application behavior and keep the restricted permission disabled.',
  },
  {
    ruleId: 'UNACKNOWLEDGED_CRITICAL_ALERT',
    name: 'Unacknowledged critical alert',
    description: 'Escalate critical alerts that still need operator acknowledgement.',
    condition: 'critical alert acknowledged is false',
    severity: ALERT_SEVERITY.CRITICAL,
    threshold: 1,
    weight: 0,
    recommendedAction: 'Review and acknowledge the critical alert after triage.',
  },
  {
    ruleId: 'EXCESSIVE_REQUEST_FREQUENCY',
    name: 'Excessive request frequency',
    description: 'Detect more than ten same-resource requests in a sixty-second window.',
    condition: 'same-resource requests in sixty seconds',
    severity: ALERT_SEVERITY.HIGH,
    threshold: 10,
    weight: POSTURE_CONFIG.SCORE.UNLINKED_SUSPICIOUS_EVENT_PENALTY,
    recommendedAction: 'Review the request source and reduce unnecessary polling.',
  },
  {
    ruleId: 'RISKY_PERMISSION_COMBINATION',
    name: 'Risky permission combination',
    description: 'Review potentially sensitive permission combinations against application category.',
    condition: 'configured sensitive resource combination is enabled',
    severity: ALERT_SEVERITY.HIGH,
    threshold: 1,
    weight: POSTURE_CONFIG.SCORE.RISKY_COMBINATION_PENALTY,
    recommendedAction: 'Review whether the application needs all resources in this combination.',
  },
]);

function stableObjectId(value) {
  return new mongoose.Types.ObjectId(createHash('sha256').update(value).digest('hex').slice(0, 24));
}

function eventDefinition(app, demoId, resource, timestamp, reason, status) {
  return {
    demoId,
    _id: stableObjectId(demoId),
    appId: app._id,
    resource,
    reason,
    timestamp: new Date(timestamp),
    status,
    suspicious: status === ACCESS_STATUS.DENIED,
    denialReason: status === ACCESS_STATUS.DENIED ? 'permission_disabled' : null,
    alertId: null,
    isDemo: true,
  };
}

function makeEventDefinitions(apps) {
  const events = [];
  const dates = [
    '2026-10-10T09:00:00.000Z',
    '2026-10-21T12:15:00.000Z',
    '2026-10-31T15:30:00.000Z',
    '2026-11-08T10:00:00.000Z',
  ];

  for (const [index, app] of apps.entries()) {
    const granted = Object.keys(app.permissions).filter((resource) => app.permissions[resource].enabled);
    const deniedResource = Object.keys(app.permissions).find((resource) => !app.permissions[resource].enabled);
    const primary = granted[0] || 'files';
    const secondary = granted[1] || primary;
    const plan = [
      [primary, dates[0], 'Scheduled demo application activity', ACCESS_STATUS.ALLOWED],
      [secondary, dates[1], 'User-initiated demo application activity', ACCESS_STATUS.ALLOWED],
      [primary, dates[2], 'Routine demo application activity', ACCESS_STATUS.ALLOWED],
      [
        deniedResource && index >= 5 && index % 2 === 0 && app.id !== 'app_13' ? deniedResource : primary,
        dates[3],
        deniedResource && index >= 5 && index % 2 === 0 && app.id !== 'app_13' ? 'Request for a disabled demo permission' : 'Recent demo application activity',
        deniedResource && index >= 5 && index % 2 === 0 && app.id !== 'app_13' ? ACCESS_STATUS.DENIED : ACCESS_STATUS.ALLOWED,
      ],
    ];

    for (const [eventIndex, [resource, date, reason, status]] of plan.entries()) {
      const timestamp = new Date(Date.parse(date) + index * 60000 + eventIndex * 1000).toISOString();
      const demoId = `activity:${app.id}:${eventIndex + 1}`;
      events.push(eventDefinition(app, demoId, resource, timestamp, reason, status));
    }
  }

  const repeatedApp = apps.find((app) => app.id === 'app_13');
  if (repeatedApp) {
    for (let index = 0; index < 3; index += 1) {
      const demoId = `repeated-denial:${repeatedApp.id}:${index + 1}`;
      events.push(eventDefinition(
        repeatedApp,
        demoId,
        'camera',
        new Date(Date.parse('2026-11-08T18:00:00.000Z') + index * 120000).toISOString(),
        'Repeated request for a disabled camera permission (simulated)',
        ACCESS_STATUS.DENIED,
      ));
    }
  }

  const combinationApp = apps.find((app) => app.id === 'app_14');
  if (combinationApp) {
    for (const [index, resource] of ['camera', 'microphone', 'contacts', 'location'].entries()) {
      const demoId = `sensitive-combination:${combinationApp.id}:${resource}`;
      events.push(eventDefinition(
        combinationApp,
        demoId,
        resource,
        new Date(Date.parse('2026-11-08T19:00:00.000Z') + index * 5000).toISOString(),
        'Sensitive resource combination demo activity',
        ACCESS_STATUS.ALLOWED,
      ));
    }
  }

  const frequencyApp = apps.find((app) => app.id === 'app_15');
  if (frequencyApp) {
    for (let index = 0; index < 11; index += 1) {
      const demoId = `frequency:${frequencyApp.id}:${index + 1}`;
      events.push(eventDefinition(
        frequencyApp,
        demoId,
        'location',
        new Date(Date.parse('2026-11-08T20:00:00.000Z') + index * 2000).toISOString(),
        'Repeated location update (simulated)',
        ACCESS_STATUS.ALLOWED,
      ));
    }
  }
  return events;
}

async function seedInitialTrustHistory(apps, session) {
  for (const app of apps) {
    await TrustHistory.updateOne(
      { demoId: `profile-score:${app.id}` },
      {
        $setOnInsert: {
          appId: app._id,
          previousScore: 100,
          newScore: app.trustScore,
          change: app.trustScore - 100,
          reason: 'Initial deterministic permission profile assessment',
          changeReason: `Initial profile score from declared and granted permissions: ${app.trustScore}`,
          penalty: 100 - app.trustScore,
          timestamp: app.createdAt,
          isDemo: true,
          demoId: `profile-score:${app.id}`,
        },
      },
      session ? { upsert: true, session } : { upsert: true },
    );
  }
}

async function seedRecoveryTrend(session) {
  const app = await App.findOne({ id: 'app_04', isDemo: true }).session(session || null);
  if (!app || await TrustHistory.exists({ demoId: 'profile-recovery:app_04' }).session(session || null)) return;
  const previousScore = app.trustScore;
  const newScore = 100;
  const timestamp = new Date('2026-11-06T10:00:00.000Z');
  await TrustHistory.create([{
    appId: app._id,
    previousScore,
    newScore,
    change: newScore - previousScore,
    reason: 'Deterministic demo trust recovery after a permission review.',
    changeReason: `Trust score improved ${previousScore} -> ${newScore} after a demo permission review`,
    penalty: 0,
    timestamp,
    isDemo: true,
    demoId: 'profile-recovery:app_04',
  }], session ? { session } : {});
  app.trustScore = newScore;
  app.updatedAt = timestamp;
  await app.save(session ? { session } : {});
}

async function seedPolicies(session) {
  for (const policy of DEMO_POLICIES) {
    await SecurityPolicy.updateOne(
      { ruleId: policy.ruleId },
      { $setOnInsert: { ...policy, isDemo: true } },
      session ? { upsert: true, session } : { upsert: true },
    );
  }
}

async function seedAlerts(events, session) {
  const plans = [
    {
      demoId: 'alert:repeated-denial:app_13',
      appId: 'app_13',
      type: ALERT_TYPES.REPEATED_RESTRICTED_ACCESS,
      severity: ALERT_SEVERITY.HIGH,
      message: 'File Manager Demo made three denied camera requests in five minutes.',
      eventPrefix: 'repeated-denial:app_13:',
      timestamp: '2026-11-08T18:04:00.000Z',
      recommendation: {
        type: RECOMMENDATION_TYPES.KEEP_DISABLED,
        title: 'Keep camera access disabled',
        description: 'Repeated camera requests were denied because this fictional file manager does not have camera permission.',
        suggestedAction: SUGGESTED_ACTIONS.NONE,
        resource: 'camera',
      },
    },
    {
      demoId: 'alert:combination:app_14',
      appId: 'app_14',
      type: ALERT_TYPES.UNUSUAL_RESOURCE_COMBINATION,
      severity: ALERT_SEVERITY.CRITICAL,
      message: 'Unknown Third-party App requested four sensitive resource types within thirty seconds.',
      eventPrefix: 'sensitive-combination:app_14:',
      timestamp: '2026-11-08T19:00:15.000Z',
      recommendation: {
        type: RECOMMENDATION_TYPES.REVIEW_PERMISSION,
        title: 'Review sensitive permission combination',
        description: 'Review whether the fictional application requires camera, microphone, contacts, and location access together.',
        suggestedAction: SUGGESTED_ACTIONS.NONE,
        resource: null,
      },
    },
    {
      demoId: 'alert:frequency:app_15',
      appId: 'app_15',
      type: ALERT_TYPES.EXCESSIVE_ACCESS,
      severity: ALERT_SEVERITY.HIGH,
      message: 'Travel Application made eleven location requests in sixty seconds.',
      eventPrefix: 'frequency:app_15:',
      timestamp: '2026-11-08T20:00:20.000Z',
      recommendation: {
        type: RECOMMENDATION_TYPES.RESTRICT_PERMISSION,
        title: 'Review location request frequency',
        description: 'Eleven simulated location requests occurred within sixty seconds; verify that this polling rate is necessary.',
        suggestedAction: SUGGESTED_ACTIONS.REVOKE_PERMISSION,
        resource: 'location',
      },
    },
  ];

  for (const plan of plans) {
    const app = await App.findOne({ id: plan.appId, isDemo: true }).session(session || null);
    if (!app) continue;
    const related = events.filter((event) => event.demoId.startsWith(plan.eventPrefix));
    const relatedEventIds = related.map((event) => event._id);
    const alertId = stableObjectId(plan.demoId);
    const timestamp = new Date(plan.timestamp);

    await Alert.updateOne(
      { demoId: plan.demoId },
      {
        $setOnInsert: {
          _id: alertId,
          appId: app._id,
          alertType: plan.type,
          resource: plan.recommendation.resource || '*',
          severity: plan.severity,
          message: plan.message,
          relatedEventIds,
          acknowledged: false,
          timestamp,
          isDemo: true,
          demoId: plan.demoId,
        },
      },
      session ? { upsert: true, session } : { upsert: true },
    );

    const alert = await Alert.findOne({ demoId: plan.demoId }).session(session || null);
    if (!alert) continue;
    await Event.updateMany(
      { _id: { $in: relatedEventIds } },
      { $set: { alertId: alert._id, suspicious: true } },
      session ? { session } : {},
    );

    const trustHistory = await TrustHistory.findOne({ alertId: alert._id }).session(session || null);
    if (!trustHistory) {
      const result = calculateTrustScore(app, [], [{ severity: plan.severity }]);
      const penalty = penaltyFor(plan.severity);
      const reason = changeReasonFor({ severity: plan.severity, type: plan.type });
      await TrustHistory.create([{
        appId: app._id,
        previousScore: app.trustScore,
        newScore: result.newScore,
        change: result.newScore - app.trustScore,
        reason,
        changeReason: reason,
        alertId: alert._id,
        penalty,
        timestamp,
        isDemo: true,
        demoId: `alert-score:${plan.demoId}`,
      }], session ? { session } : {});
      app.trustScore = result.newScore;
      app.updatedAt = timestamp;
      await app.save(session ? { session } : {});
      await ActivityHistory.updateOne(
        { demoId: `alert-created:${plan.demoId}` },
        { $setOnInsert: {
          appId: app._id,
          eventType: ACTIVITY_EVENT_TYPES.ALERT_CREATED,
          description: `Demo security alert: ${plan.type} (${plan.severity})`,
          timestamp,
          metadata: { alertId: alert._id.toString(), eventIds: relatedEventIds.map(String) },
          isDemo: true,
          demoId: `alert-created:${plan.demoId}`,
        } },
        session ? { upsert: true, session } : { upsert: true },
      );
    }

    await Recommendation.updateOne(
      { demoId: `recommendation:${plan.demoId}` },
      {
        $setOnInsert: {
          appId: app._id,
          alertId: alert._id,
          ...plan.recommendation,
          status: RECOMMENDATION_STATUS.PENDING,
          isDemo: true,
          demoId: `recommendation:${plan.demoId}`,
        },
      },
      session ? { upsert: true, session } : { upsert: true },
    );
    const recommendation = await Recommendation.findOne({ demoId: `recommendation:${plan.demoId}` }).session(session || null);
    if (recommendation && !alert.recommendationId) {
      alert.recommendationId = recommendation._id;
      await alert.save(session ? { session } : {});
    }
  }
}

export async function seedPostureDemoData(session = null) {
  const seedApps = seedData().apps;
  const apps = await App.find({
    id: { $in: seedApps.map((app) => app.id) },
    isDemo: true,
  }).session(session || null).sort({ id: 1 });
  const appById = new Map(apps.map((app) => [app.id, app]));
  const eventDefinitions = makeEventDefinitions(seedApps
    .filter((app) => appById.has(app.id))
    .map((app) => ({ ...app, _id: appById.get(app.id)._id })));

  for (const definition of eventDefinitions) {
    await Event.updateOne(
      { demoId: definition.demoId },
      { $setOnInsert: definition },
      session ? { upsert: true, session } : { upsert: true },
    );
  }
  const persistedEvents = await Event.find({
    demoId: { $in: eventDefinitions.map((event) => event.demoId) },
    isDemo: true,
  }).session(session || null);
  for (const event of persistedEvents) {
    const eventType = event.status === ACCESS_STATUS.ALLOWED
      ? ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED
      : ACTIVITY_EVENT_TYPES.ACCESS_DENIED;
    await ActivityHistory.updateOne(
      { demoId: `event-history:${event.demoId}` },
      {
        $setOnInsert: {
          appId: event.appId,
          eventType,
          description: `${event.resource} access ${event.status} (simulated demo record)`,
          timestamp: event.timestamp,
          metadata: {
            resource: event.resource,
            eventId: event._id.toString(),
            demo: true,
          },
          isDemo: true,
          demoId: `event-history:${event.demoId}`,
        },
      },
      session ? { upsert: true, session } : { upsert: true },
    );
  }
  await seedInitialTrustHistory(apps, session);
  await seedRecoveryTrend(session);
  await seedPolicies(session);
  await seedAlerts(persistedEvents, session);

  return {
    applications: apps.length,
    events: persistedEvents.length,
    policies: DEMO_POLICIES.length,
  };
}

export { DEMO_POLICIES };
