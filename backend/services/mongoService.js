import mongoose from 'mongoose';
import {
  ACCESS_STATUS,
  ACTIVITY_EVENT_TYPES,
  ALERT_SEVERITY,
  ALERT_TYPES,
  APPLICATION_STATUS,
  RECOMMENDATION_STATUS,
  RECOMMENDATION_TYPES,
  RESOURCE_TYPES,
  SUGGESTED_ACTIONS,
  TRUST_CONFIG,
  isIsoTimestamp,
  trustLevelFor,
  validateAccessPayload,
} from '../../shared/contracts.js';
import seedData from '../data/seedData.js';
import App from '../models/App.js';
import Event from '../models/Event.js';
import Alert from '../models/Alert.js';
import TrustHistory from '../models/TrustHistory.js';
import Recommendation from '../models/Recommendation.js';
import ActivityHistory from '../models/ActivityHistory.js';
import SecurityFinding from '../models/SecurityFinding.js';
import SecurityPolicy from '../models/SecurityPolicy.js';
import { seedPostureDemoData } from './demoDataService.js';
import { mongoose as dbMongoose } from '../database/connection.js';
import { analyzeEvent } from './anomalyDetection.js';
import { calculateTrustScore, changeReasonFor, penaltyFor, buildScoreExplanation } from './trustScore.js';

const objectId = (value) => new mongoose.Types.ObjectId(value);
const idString = (value) => value?._id ? value._id.toString() : value?.toString?.() ?? null;
const publicAppId = (value) => value && typeof value === 'object' && value.id ? value.id : idString(value);
const dateValue = (value) => value instanceof Date ? value.toISOString() : value;

function serviceError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function appDto(app) {
  if (!app) return null;
  const source = app.toObject ? app.toObject() : app;
  const { _id, revision, ...result } = source;
  return {
    ...result,
    trustLevel: trustLevelFor(result.trustScore),
    permissions: Object.fromEntries(RESOURCE_TYPES.map((resource) => {
      const permission = result.permissions?.[resource] || {};
      return [resource, {
        enabled: permission.enabled === true,
        grantedAt: dateValue(permission.grantedAt ?? null),
        lastAccessedAt: dateValue(permission.lastAccessedAt ?? null),
      }];
    })),
  };
}

function eventDto(event) {
  if (!event) return null;
  const source = event.toObject ? event.toObject() : event;
  const { _id, appId, alertId, __v, ...result } = source;
  return {
    ...result,
    id: idString(_id),
    appId: publicAppId(appId),
    alertId: idString(alertId),
    timestamp: dateValue(result.timestamp),
  };
}

function alertDto(alert) {
  if (!alert) return null;
  const source = alert.toObject ? alert.toObject() : alert;
  const { _id, appId, alertType, relatedEventIds, recommendationId, __v, ...result } = source;
  return {
    ...result,
    id: idString(_id),
    appId: publicAppId(appId),
    type: alertType,
    relatedEventIds: (relatedEventIds || []).map(idString),
    recommendationId: idString(recommendationId),
    timestamp: dateValue(result.timestamp),
  };
}

function trustHistoryDto(row) {
  const source = row.toObject ? row.toObject() : row;
  const { _id, appId, alertId, __v, ...result } = source;
  return {
    ...result,
    id: idString(_id),
    appId: publicAppId(appId),
    alertId: idString(alertId),
    timestamp: dateValue(result.timestamp),
  };
}

function recommendationDto(recommendation) {
  const source = recommendation.toObject ? recommendation.toObject() : recommendation;
  const { _id, appId, alertId, __v, ...result } = source;
  return {
    ...result,
    id: idString(_id),
    appId: publicAppId(appId),
    alertId: idString(alertId),
    createdAt: dateValue(result.createdAt),
    appliedAt: dateValue(result.appliedAt),
  };
}

function activityDto(activity) {
  const source = activity.toObject ? activity.toObject() : activity;
  const { _id, appId, __v, ...result } = source;
  return {
    ...result,
    id: idString(_id),
    appId: publicAppId(appId),
    timestamp: dateValue(result.timestamp),
  };
}

async function transaction(work) {
  const session = await dbMongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      result = await work(session);
    }, {
      readPreference: 'primary',
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function requireApp(appId, session) {
  const app = await App.findOne({ id: appId }).session(session || null);
  if (!app) throw serviceError('APP_NOT_FOUND', `Application ${appId} not found`);
  return app;
}

async function addActivity({ app, eventType, description, timestamp, metadata = {} }, session) {
  const [entry] = await ActivityHistory.create([{
    appId: app._id,
    eventType,
    description,
    timestamp: new Date(timestamp || Date.now()),
    metadata,
  }], { session });
  return entry;
}

export async function seedApplications(session = null) {
  const apps = seedData().apps;
  const operations = apps.map((app) => ({
    updateOne: {
      filter: { id: app.id },
      update: {
        $setOnInsert: {
          ...app,
          permissions: Object.fromEntries(Object.entries(app.permissions).map(([resource, permission]) => [
            resource,
            {
              ...permission,
              grantedAt: permission.grantedAt ? new Date(permission.grantedAt) : null,
              lastAccessedAt: permission.lastAccessedAt ? new Date(permission.lastAccessedAt) : null,
            },
          ])),
        },
      },
      upsert: true,
    },
  }));
  await App.bulkWrite(operations, {
    ordered: true,
    timestamps: false,
    ...(session ? { session } : {}),
  });
  const demoApps = await App.find({
    id: { $in: apps.map((app) => app.id) },
    isDemo: true,
  }).session(session || null);
  for (const app of demoApps) {
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
      { upsert: true, session },
    );
  }
  return App.countDocuments({ id: { $in: apps.map((app) => app.id) } }).session(session || null);
}

export async function getApps(status = null) {
  const filter = status ? { status } : {};
  const apps = await App.find(filter).sort({ id: 1 }).lean();
  return apps.map(appDto);
}

export async function getApp(appId) {
  return appDto(await App.findOne({ id: appId }).lean());
}

export async function updatePermission(appId, resource, enabled) {
  if (!RESOURCE_TYPES.includes(resource)) throw serviceError('RESOURCE_INVALID', 'Invalid resource');
  if (typeof enabled !== 'boolean') throw serviceError('VALIDATION_ERROR', 'enabled must be a boolean');

  return transaction(async (session) => {
    const app = await requireApp(appId, session);
    const permission = app.permissions[resource];
    if (permission.enabled === enabled) return appDto(app);

    const timestamp = new Date();
    permission.enabled = enabled;
    if (enabled) permission.grantedAt = timestamp;
    app.updatedAt = timestamp;
    await app.save({ session });
    await addActivity({
      app,
      eventType: enabled ? ACTIVITY_EVENT_TYPES.PERMISSION_GRANTED : ACTIVITY_EVENT_TYPES.PERMISSION_REVOKED,
      description: `${resource} permission ${enabled ? 'granted' : 'revoked'}`,
      timestamp,
      metadata: { resource, previousValue: !enabled, newValue: enabled },
    }, session);
    return appDto(app);
  });
}

export async function updateAppStatus(appId, status) {
  if (!Object.values(APPLICATION_STATUS).includes(status)) {
    throw serviceError('VALIDATION_ERROR', 'Invalid application status');
  }

  return transaction(async (session) => {
    const app = await requireApp(appId, session);
    if (app.status === status) return appDto(app);

    const previousStatus = app.status;
    const timestamp = new Date();
    app.status = status;
    app.updatedAt = timestamp;
    await app.save({ session });
    await addActivity({
      app,
      eventType: status === APPLICATION_STATUS.SUSPENDED
        ? ACTIVITY_EVENT_TYPES.APP_SUSPENDED
        : ACTIVITY_EVENT_TYPES.APP_REACTIVATED,
      description: `Application ${app.name} ${status === APPLICATION_STATUS.SUSPENDED ? 'suspended' : 'reactivated'}`,
      timestamp,
      metadata: { previousStatus, newStatus: status },
    }, session);
    return appDto(app);
  });
}

function recommendationDetails(app, alert) {
  const resource = alert.resource && alert.resource !== '*' ? alert.resource : null;
  switch (alert.alertType) {
    case ALERT_TYPES.EXCESSIVE_ACCESS:
      return {
        type: RECOMMENDATION_TYPES.RESTRICT_PERMISSION,
        suggestedAction: SUGGESTED_ACTIONS.REVOKE_PERMISSION,
        title: `Restrict ${resource || 'resource'}`,
        description: `Excessive ${resource || 'resource'} requests detected from ${app.name}. Revoking permission is recommended.`,
        resource,
      };
    case ALERT_TYPES.UNAUTHORIZED_RESOURCE:
      return {
        type: RECOMMENDATION_TYPES.KEEP_DISABLED,
        suggestedAction: SUGGESTED_ACTIONS.NONE,
        title: `Keep ${resource || 'resource'} disabled`,
        description: `Unauthorized access attempts detected for disabled resource ${resource || 'resource'}. Keep disabled.`,
        resource,
      };
    case ALERT_TYPES.SUSPENDED_APP_ACCESS:
      return {
        type: RECOMMENDATION_TYPES.REVIEW_PERMISSION,
        suggestedAction: SUGGESTED_ACTIONS.NONE,
        title: 'Review the app',
        description: `${app.name} attempted resource access while suspended. Review application status and credentials.`,
        resource,
      };
    case ALERT_TYPES.REPEATED_RESTRICTED_ACCESS:
    case ALERT_TYPES.UNUSUAL_RESOURCE_COMBINATION:
      return {
        type: RECOMMENDATION_TYPES.SUSPEND_APP,
        suggestedAction: SUGGESTED_ACTIONS.SUSPEND_APP,
        title: 'Suspend or investigate the app',
        description: `Multiple high-severity security violations detected for ${app.name}. Suspending application is recommended.`,
        resource: null,
      };
    default:
      return null;
  }
}

export async function processAccessRequest(payload) {
  const validationError = validateAccessPayload(payload);
  if (validationError) throw serviceError('VALIDATION_ERROR', validationError);
  if (payload.timestamp !== undefined && !isIsoTimestamp(payload.timestamp)) {
    throw serviceError('VALIDATION_ERROR', 'timestamp must be a valid ISO 8601 string');
  }

  return transaction(async (session) => {
    const app = await requireApp(payload.appId, session);
    const timestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();
    const permission = app.permissions[payload.resource];
    let decision;
    if (app.status === APPLICATION_STATUS.SUSPENDED) {
      decision = { allowed: false, reason: 'app_suspended' };
    } else if (!permission?.enabled) {
      decision = { allowed: false, reason: 'permission_disabled' };
    } else {
      decision = { allowed: true, reason: 'ok' };
      permission.lastAccessedAt = timestamp;
    }

    const [event] = await Event.create([{
      appId: app._id,
      resource: payload.resource,
      reason: payload.reason || 'Simulated request',
      timestamp,
      status: decision.allowed ? ACCESS_STATUS.ALLOWED : ACCESS_STATUS.DENIED,
      suspicious: false,
      denialReason: decision.allowed ? null : decision.reason,
      alertId: null,
    }], { session });
    const eventType = decision.allowed
      ? ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED
      : ACTIVITY_EVENT_TYPES.ACCESS_DENIED;
    await addActivity({
      app,
      eventType,
      description: `${payload.resource} access ${decision.allowed ? 'allowed' : 'denied'}`,
      timestamp,
      metadata: {
        resource: payload.resource,
        eventId: event._id.toString(),
        ...(decision.allowed ? {} : { denialReason: decision.reason }),
      },
    }, session);

    app.revision += 1;
    if (decision.allowed) app.permissions[payload.resource].lastAccessedAt = timestamp;

    const windowFloor = new Date(timestamp.getTime() - 300000);
    const recent = await Event.find({
      appId: app._id,
      timestamp: { $gte: windowFloor, $lte: timestamp },
    }).session(session).lean();
    const analysis = analyzeEvent(
      eventDto({ ...event.toObject(), appId: app }),
      app,
      recent.map((candidate) => eventDto({ ...candidate, appId: app })),
    );
    const alertsCreated = [];
    const newAlertDocs = [];

    if (analysis.suspicious) {
      for (const finding of analysis.findings) {
        const resourceKey = finding.resource || payload.resource;
        const dedupeWindow = TRUST_CONFIG.DEDUPE_WINDOW_MS || 300000;
        const existing = await Alert.findOne({
          appId: app._id,
          alertType: finding.alertType,
          resource: resourceKey,
          timestamp: {
            $gte: new Date(timestamp.getTime() - dedupeWindow),
            $lte: new Date(timestamp.getTime() + dedupeWindow),
          },
        }).session(session);

        if (existing) {
          await Alert.updateOne(
            { _id: existing._id },
            { $addToSet: { relatedEventIds: event._id } },
            { session },
          );
          event.alertId = existing._id;
          event.suspicious = true;
          continue;
        }

        const relatedEventIds = finding.relatedEventIds
          .filter((id) => mongoose.isValidObjectId(id))
          .map(objectId);
        const [alert] = await Alert.create([{
          appId: app._id,
          alertType: finding.alertType,
          resource: resourceKey,
          severity: finding.severity,
          message: finding.message,
          relatedEventIds,
          acknowledged: false,
          timestamp,
        }], { session });
        event.alertId = alert._id;
        event.suspicious = true;
        alertsCreated.push(alertDto({ ...alert.toObject(), appId: app }));
        newAlertDocs.push(alert);

        await addActivity({
          app,
          eventType: ACTIVITY_EVENT_TYPES.ALERT_CREATED,
          description: `Security alert: ${alert.alertType} (${alert.severity})`,
          timestamp,
          metadata: { alertId: alert._id.toString(), alertType: alert.alertType, severity: alert.severity },
        }, session);
      }
    }

    await event.save({ session });
    let trustExplanation = [`No new penalties; score unchanged at ${app.trustScore}`];
    for (const alert of newAlertDocs) {
      const previousScore = app.trustScore;
      const result = calculateTrustScore(app, [], [alert]);
      const penalty = penaltyFor(alert.severity);
      app.trustScore = result.newScore;
      const reason = changeReasonFor({ ...alert.toObject(), type: alert.alertType });
      await TrustHistory.create([{
        appId: app._id,
        previousScore,
        newScore: app.trustScore,
        change: app.trustScore - previousScore,
        reason,
        changeReason: reason,
        alertId: alert._id,
        penalty,
        timestamp,
      }], { session });
      await addActivity({
        app,
        eventType: ACTIVITY_EVENT_TYPES.TRUST_SCORE_CHANGED,
        description: `Trust score ${previousScore} -> ${app.trustScore} (${reason})`,
        timestamp,
        metadata: { alertId: alert._id.toString(), previousScore, newScore: app.trustScore, penalty },
      }, session);
      trustExplanation = result.explanation;
    }

    const recommendations = [];
    for (const alert of newAlertDocs) {
      const details = recommendationDetails(app, alert);
      if (!details) continue;
      const existing = await Recommendation.findOne({
        appId: app._id,
        type: details.type,
        resource: details.resource,
        status: RECOMMENDATION_STATUS.PENDING,
      }).session(session);
      if (existing) {
        alert.recommendationId = existing._id;
        await alert.save({ session });
        continue;
      }

      const [recommendation] = await Recommendation.create([{
        appId: app._id,
        alertId: alert._id,
        ...details,
        status: RECOMMENDATION_STATUS.PENDING,
      }], { session });
      alert.recommendationId = recommendation._id;
      await alert.save({ session });
      recommendations.push(recommendationDto({ ...recommendation.toObject(), appId: app, alertId: alert._id }));
      await addActivity({
        app,
        eventType: ACTIVITY_EVENT_TYPES.RECOMMENDATION_CREATED,
        description: `Recommendation: ${recommendation.title}`,
        timestamp,
        metadata: {
          recommendationId: recommendation._id.toString(),
          type: recommendation.type,
          suggestedAction: recommendation.suggestedAction,
          resource: recommendation.resource,
          alertId: alert._id.toString(),
        },
      }, session);
    }

    app.updatedAt = timestamp;
    await app.save({ session });
    return {
      event: eventDto({ ...event.toObject(), appId: app }),
      alertsCreated: newAlertDocs.map((alert) => alertDto({ ...alert.toObject(), appId: app })),
      app: appDto(app),
      trustScore: {
        appId: app.id,
        score: app.trustScore,
        level: trustLevelFor(app.trustScore),
        explanation: trustExplanation,
      },
      recommendations,
      allowed: decision.allowed,
      denialReason: decision.allowed ? null : decision.reason,
    };
  });
}

function parseListLimit(value, fallback, maximum) {
  if (value === undefined || value === null || value === '') return fallback;
  if (!/^\d+$/.test(String(value))) throw serviceError('VALIDATION_ERROR', `limit must be an integer between 1 and ${maximum}`);
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maximum) {
    throw serviceError('VALIDATION_ERROR', `limit must be an integer between 1 and ${maximum}`);
  }
  return limit;
}

function parseOffset(value) {
  if (value === undefined || value === null || value === '') return 0;
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw serviceError('VALIDATION_ERROR', 'offset must be a non-negative integer');
  }
  return Number(value);
}

export async function getEvents(query = {}) {
  const { appId, resource, status, suspicious } = query;
  if (appId !== undefined && (typeof appId !== 'string' || !appId.trim())) {
    throw serviceError('VALIDATION_ERROR', 'appId must be a non-empty string');
  }
  if (resource !== undefined && !RESOURCE_TYPES.includes(resource)) {
    throw serviceError('VALIDATION_ERROR', `resource must be one of: ${RESOURCE_TYPES.join(', ')}`);
  }
  if (status !== undefined && !Object.values(ACCESS_STATUS).includes(status)) {
    throw serviceError('VALIDATION_ERROR', `status must be one of: ${Object.values(ACCESS_STATUS).join(', ')}`);
  }
  if (suspicious !== undefined && suspicious !== 'true' && suspicious !== 'false') {
    throw serviceError('VALIDATION_ERROR', 'suspicious must be true or false');
  }

  const filter = {};
  if (appId) {
    const app = await App.findOne({ id: appId }).select('_id').lean();
    if (!app) return [];
    filter.appId = app._id;
  }
  if (resource) filter.resource = resource;
  if (status) filter.status = status;
  if (suspicious !== undefined) filter.suspicious = suspicious === 'true';
  const limit = parseListLimit(query.limit, 50, 200);
  const offset = parseOffset(query.offset);
  const events = await Event.find(filter)
    .sort({ timestamp: -1, _id: -1 })
    .skip(offset)
    .limit(limit)
    .populate('appId', 'id')
    .lean();
  return events.map(eventDto);
}

export async function getAlerts(query = {}) {
  const { appId, severity, acknowledged, type } = query;
  const filter = {};
  if (appId !== undefined) {
    if (typeof appId !== 'string' || !appId.trim()) {
      throw serviceError('VALIDATION_ERROR', 'appId must be a non-empty string');
    }
    const app = await App.findOne({ id: appId }).select('_id').lean();
    if (!app) return [];
    filter.appId = app._id;
  }
  if (severity !== undefined) {
    if (!Object.values(ALERT_SEVERITY).includes(severity)) {
      throw serviceError('VALIDATION_ERROR', `severity must be one of ${Object.values(ALERT_SEVERITY).join(', ')}`);
    }
    filter.severity = severity;
  }
  if (type !== undefined) {
    if (!Object.values(ALERT_TYPES).includes(type)) {
      throw serviceError('VALIDATION_ERROR', `type must be one of ${Object.values(ALERT_TYPES).join(', ')}`);
    }
    filter.alertType = type;
  }
  if (acknowledged !== undefined) {
    if (acknowledged !== 'true' && acknowledged !== 'false') {
      throw serviceError('VALIDATION_ERROR', 'acknowledged must be true or false');
    }
    filter.acknowledged = acknowledged === 'true';
  }
  const limit = parseListLimit(query.limit, 50, 200);
  const alerts = await Alert.find(filter)
    .sort({ timestamp: -1, _id: -1 })
    .limit(limit)
    .populate('appId', 'id')
    .lean();
  return alerts.map(alertDto);
}

export async function acknowledgeAlert(alertId) {
  if (!mongoose.isValidObjectId(alertId)) throw serviceError('ALERT_NOT_FOUND', `Alert ${alertId} not found`);
  const alert = await Alert.findByIdAndUpdate(alertId, { $set: { acknowledged: true } }, { new: true })
    .populate('appId', 'id')
    .lean();
  if (!alert) throw serviceError('ALERT_NOT_FOUND', `Alert ${alertId} not found`);
  return alertDto(alert);
}

export async function getTrustScoreView(appId) {
  const app = await App.findOne({ id: appId }).lean();
  if (!app) return null;
  const rows = await TrustHistory.find({ appId: app._id })
    .sort({ timestamp: -1, _id: -1 })
    .populate('appId', 'id')
    .populate('alertId')
    .lean();
  const history = rows.map(trustHistoryDto);
  return {
    appId: app.id,
    score: app.trustScore,
    level: trustLevelFor(app.trustScore),
    history,
    explanation: buildScoreExplanation(history, app.trustScore),
  };
}

export async function getRecommendations(appId, status) {
  const app = await App.findOne({ id: appId }).select('_id').lean();
  if (!app) return [];
  const filter = { appId: app._id };
  if (status !== undefined) {
    if (!Object.values(RECOMMENDATION_STATUS).includes(status)) {
      throw serviceError('VALIDATION_ERROR', 'Invalid recommendation status');
    }
    filter.status = status;
  }
  const recommendations = await Recommendation.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .populate('appId', 'id')
    .lean();
  return recommendations.map(recommendationDto);
}

export async function applyRecommendation(recommendationId) {
  if (!mongoose.isValidObjectId(recommendationId)) {
    throw serviceError('RECOMMENDATION_NOT_FOUND', `Recommendation ${recommendationId} not found`);
  }

  return transaction(async (session) => {
    const recommendation = await Recommendation.findById(recommendationId).session(session);
    if (!recommendation) {
      throw serviceError('RECOMMENDATION_NOT_FOUND', `Recommendation ${recommendationId} not found`);
    }
    const app = await App.findById(recommendation.appId).session(session);
    if (!app) throw serviceError('APP_NOT_FOUND', `Application for recommendation ${recommendationId} not found`);
    if (recommendation.status !== RECOMMENDATION_STATUS.PENDING) {
      return { recommendation: recommendationDto({ ...recommendation.toObject(), appId: app }), app: appDto(app) };
    }

    const timestamp = new Date();
    if (recommendation.suggestedAction === SUGGESTED_ACTIONS.REVOKE_PERMISSION && recommendation.resource) {
      const permission = app.permissions[recommendation.resource];
      if (permission?.enabled) {
        permission.enabled = false;
        await addActivity({
          app,
          eventType: ACTIVITY_EVENT_TYPES.PERMISSION_REVOKED,
          description: `${recommendation.resource} permission revoked`,
          timestamp,
          metadata: { resource: recommendation.resource, previousValue: true, newValue: false },
        }, session);
      }
    } else if (recommendation.suggestedAction === SUGGESTED_ACTIONS.SUSPEND_APP
      && app.status !== APPLICATION_STATUS.SUSPENDED) {
      const previousStatus = app.status;
      app.status = APPLICATION_STATUS.SUSPENDED;
      await addActivity({
        app,
        eventType: ACTIVITY_EVENT_TYPES.APP_SUSPENDED,
        description: `Application ${app.name} suspended`,
        timestamp,
        metadata: { previousStatus, newStatus: APPLICATION_STATUS.SUSPENDED },
      }, session);
    }

    app.updatedAt = timestamp;
    await app.save({ session });
    recommendation.status = RECOMMENDATION_STATUS.APPLIED;
    recommendation.appliedAt = timestamp;
    await recommendation.save({ session });
    await addActivity({
      app,
      eventType: ACTIVITY_EVENT_TYPES.RECOMMENDATION_APPLIED,
      description: `Recommendation applied: ${recommendation.title}`,
      timestamp,
      metadata: {
        recommendationId: recommendation._id.toString(),
        action: recommendation.suggestedAction,
        resource: recommendation.resource,
      },
    }, session);
    return {
      recommendation: recommendationDto({ ...recommendation.toObject(), appId: app }),
      app: appDto(app),
    };
  });
}

export async function getHistory(query = {}) {
  const appId = query.appId;
  const eventType = query.eventType || query.type;
  if (appId !== undefined && (typeof appId !== 'string' || !appId.trim())) {
    throw serviceError('VALIDATION_ERROR', 'appId must be a non-empty string');
  }
  if (eventType && !Object.values(ACTIVITY_EVENT_TYPES).includes(eventType)) {
    throw serviceError('VALIDATION_ERROR', `Invalid event type '${eventType}'`);
  }
  const filter = {};
  if (appId) {
    const app = await App.findOne({ id: appId }).select('_id').lean();
    if (!app) return [];
    filter.appId = app._id;
  }
  if (eventType) filter.eventType = eventType;
  const limit = parseListLimit(query.limit, 100, 500);
  const offset = parseOffset(query.offset);
  const history = await ActivityHistory.find(filter)
    .sort({ timestamp: -1, _id: -1 })
    .skip(offset)
    .limit(limit)
    .populate('appId', 'id')
    .lean();
  return history.map(activityDto);
}

export async function getHistorySummary() {
  const [totalActivities, allowedRequests, deniedRequests, securityAlerts] = await Promise.all([
    ActivityHistory.countDocuments(),
    ActivityHistory.countDocuments({ eventType: ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED }),
    ActivityHistory.countDocuments({ eventType: ACTIVITY_EVENT_TYPES.ACCESS_DENIED }),
    ActivityHistory.countDocuments({ eventType: ACTIVITY_EVENT_TYPES.ALERT_CREATED }),
  ]);
  return { totalActivities, allowedRequests, deniedRequests, securityAlerts };
}

export async function getStats() {
  const [totalApps, allowedRequests, deniedRequests, activeAlerts, scores] = await Promise.all([
    App.countDocuments(),
    Event.countDocuments({ status: ACCESS_STATUS.ALLOWED }),
    Event.countDocuments({ status: ACCESS_STATUS.DENIED }),
    Alert.countDocuments({ acknowledged: false }),
    App.aggregate([{ $group: { _id: null, average: { $avg: '$trustScore' } } }]),
  ]);
  return {
    totalApps,
    allowedRequests,
    deniedRequests,
    activeAlerts,
    averageTrustScore: totalApps ? Math.round(scores[0]?.average || 0) : 0,
  };
}

export async function resetDemoData() {
  if (process.env.NODE_ENV !== 'development' || process.env.ALLOW_DEMO_RESET !== 'true') {
    throw serviceError('RESET_DISABLED', 'Demo reset requires development mode and ALLOW_DEMO_RESET=true');
  }
  return transaction(async (session) => {
    const demoApps = await App.find({ isDemo: true }).select('_id').session(session);
    const demoAppIds = demoApps.map((app) => app._id);
    if (demoAppIds.length) {
      await ActivityHistory.deleteMany({ appId: { $in: demoAppIds }, isDemo: true }).session(session);
      await Recommendation.deleteMany({ appId: { $in: demoAppIds }, isDemo: true }).session(session);
      await TrustHistory.deleteMany({ appId: { $in: demoAppIds }, isDemo: true }).session(session);
      await SecurityFinding.deleteMany({ appId: { $in: demoAppIds }, isDemo: true }).session(session);
      await Alert.deleteMany({ appId: { $in: demoAppIds }, isDemo: true }).session(session);
      await Event.deleteMany({ appId: { $in: demoAppIds }, isDemo: true }).session(session);
      await App.deleteMany({ _id: { $in: demoAppIds }, isDemo: true }).session(session);
    }
    await SecurityPolicy.deleteMany({ isDemo: true }).session(session);
    await seedApplications(session);
    await seedPostureDemoData(session);
    return { reset: true };
  });
}
