import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import appServer from '../mongoApp.js';
import App from '../models/App.js';
import Event from '../models/Event.js';
import Alert from '../models/Alert.js';
import TrustHistory from '../models/TrustHistory.js';
import Recommendation from '../models/Recommendation.js';
import ActivityHistory from '../models/ActivityHistory.js';
import { connectDatabase, disconnectDatabase } from '../database/connection.js';
import {
  applyRecommendation,
  getAlerts,
  getApp,
  getRecommendations,
  processAccessRequest,
  resetDemoData,
  seedApplications,
  updateAppStatus,
  updatePermission,
} from '../services/mongoService.js';

let replicaSet;
let databaseUri;

before(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  databaseUri = replicaSet.getUri('edith_test');
  await connectDatabase(databaseUri);
});

beforeEach(async () => {
  await ActivityHistory.deleteMany({});
  await Recommendation.deleteMany({});
  await TrustHistory.deleteMany({});
  await Alert.deleteMany({});
  await Event.deleteMany({});
  await App.deleteMany({});
  await seedApplications();
});

after(async () => {
  await disconnectDatabase();
  await replicaSet.stop();
});

test('seeding inserts three apps and never overwrites existing state', async () => {
  assert.equal(await App.countDocuments(), 3);
  await updatePermission('app_01', 'contacts', true);
  await App.updateOne({ id: 'app_01' }, { $set: { trustScore: 37 } });

  await seedApplications();

  const app = await getApp('app_01');
  assert.equal(await App.countDocuments(), 3);
  assert.equal(app.trustScore, 37);
  assert.equal(app.permissions.contacts.enabled, true);
});

test('access pipeline stores events, deduplicates alerts, applies one penalty, and links a recommendation', async () => {
  const start = Date.parse('2026-11-09T10:00:00.000Z');
  const responses = [];
  for (let index = 0; index < 12; index += 1) {
    responses.push(await processAccessRequest({
      appId: 'app_01',
      resource: 'location',
      timestamp: new Date(start + index * 2000).toISOString(),
    }));
  }

  assert.equal(await Event.countDocuments({ appId: (await App.findOne({ id: 'app_01' }))._id }), 12);
  assert.equal(await Alert.countDocuments(), 1);
  const alert = (await getAlerts({ appId: 'app_01' }))[0];
  assert.equal(alert.type, 'excessive_access');
  assert.equal(alert.severity, 'high');
  assert.equal(alert.relatedEventIds.length, 12);
  assert.equal((await getApp('app_01')).trustScore, 79);
  assert.equal(await TrustHistory.countDocuments({ alertId: alert.id }), 1);

  const recommendations = await getRecommendations('app_01');
  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0].alertId, alert.id);
  assert.ok(responses[10].alertsCreated.length === 1);
  assert.equal(responses[11].alertsCreated.length, 0);
  assert.equal(await ActivityHistory.countDocuments({ eventType: 'access_allowed' }), 12);
});

test('R4 only counts permission-disabled denials', async () => {
  const start = Date.parse('2026-11-09T11:00:00.000Z');
  for (let index = 0; index < 3; index += 1) {
    await processAccessRequest({
      appId: 'app_01',
      resource: 'contacts',
      timestamp: new Date(start + index * 2000).toISOString(),
    });
  }
  await updateAppStatus('app_01', 'suspended');
  await processAccessRequest({
    appId: 'app_01',
    resource: 'location',
    timestamp: new Date(start + 6000).toISOString(),
  });

  const alerts = await getAlerts({ appId: 'app_01' });
  assert.deepEqual(new Set(alerts.map((alert) => alert.type)), new Set([
    'unauthorized_resource',
    'repeated_restricted_access',
    'suspended_app_access',
  ]));
  assert.equal(alerts.find((alert) => alert.type === 'repeated_restricted_access').severity, 'high');
});

test('concurrent access requests serialize per application without duplicate alerts or penalties', async () => {
  const start = Date.parse('2026-11-09T11:30:00.000Z');
  await Promise.all(Array.from({ length: 12 }, (_, index) => processAccessRequest({
    appId: 'app_01',
    resource: 'location',
    timestamp: new Date(start).toISOString(),
  })));

  assert.equal(await Event.countDocuments(), 12);
  assert.equal(await Alert.countDocuments({ alertType: 'excessive_access' }), 1);
  assert.equal(await TrustHistory.countDocuments(), 1);
  assert.equal((await getApp('app_01')).trustScore, 79);
});

test('recommendation application is atomic and idempotent', async () => {
  for (let index = 0; index < 11; index += 1) {
    await processAccessRequest({
      appId: 'app_01',
      resource: 'location',
      timestamp: new Date(Date.parse('2026-11-09T12:00:00.000Z') + index * 2000).toISOString(),
    });
  }
  const [recommendation] = await getRecommendations('app_01');

  const first = await applyRecommendation(recommendation.id);
  const second = await applyRecommendation(recommendation.id);

  assert.equal(first.recommendation.status, 'applied');
  assert.equal(second.recommendation.status, 'applied');
  assert.equal(second.app.permissions.location.enabled, false);
  assert.equal(await ActivityHistory.countDocuments({
    eventType: 'recommendation_applied',
    'metadata.recommendationId': recommendation.id,
  }), 1);
});

test('database state survives a connection restart', async () => {
  await updatePermission('app_01', 'contacts', true);
  await disconnectDatabase();
  await connectDatabase(databaseUri);

  const app = await getApp('app_01');
  assert.equal(app.permissions.contacts.enabled, true);
});

test('HTTP API keeps response contracts through the persistent demo workflow', async () => {
  const server = appServer.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const healthResponse = await fetch(`${base}/health`);
    const health = await healthResponse.json();
    assert.equal(healthResponse.status, 200);
    assert.equal(health.data.database, 'ok');

    const statsResponse = await fetch(`${base}/stats`);
    const stats = await statsResponse.json();
    assert.equal(statsResponse.status, 200);
    assert.equal(stats.data.totalApps, 3);

    const appResponse = await fetch(`${base}/apps`);
    const apps = await appResponse.json();
    assert.equal(apps.success, true);
    assert.equal(apps.data.length, 3);

    const simulationResponse = await fetch(`${base}/events/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: 'app_01',
        resource: 'location',
        count: 12,
        startTime: '2026-11-09T14:00:00.000Z',
      }),
    });
    const simulation = await simulationResponse.json();
    assert.equal(simulationResponse.status, 200);
    assert.deepEqual(simulation.data.summary, { total: 12, allowed: 12, denied: 0 });
    assert.equal(simulation.data.trustScore.score, 79);
    assert.equal(simulation.data.alertsCreated.length, 1);
    assert.equal(simulation.data.recommendations.length, 1);

    const alertResponse = await fetch(`${base}/security/alerts?appId=app_01&severity=high&type=excessive_access`);
    const alertList = await alertResponse.json();
    assert.equal(alertList.data.length, 1);
    const scoreResponse = await fetch(`${base}/security/score/app_01`);
    const score = await scoreResponse.json();
    assert.equal(score.data.score, 79);
    assert.equal(score.data.history.length, 1);

    const ackResponse = await fetch(`${base}/security/alerts/${alertList.data[0].id}/acknowledge`, { method: 'PATCH' });
    assert.equal((await ackResponse.json()).data.acknowledged, true);

    const statusResponse = await fetch(`${base}/apps/app_01/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'suspended' }),
    });
    assert.equal((await statusResponse.json()).data.status, 'suspended');
    const reactivateResponse = await fetch(`${base}/apps/app_01/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    assert.equal((await reactivateResponse.json()).data.status, 'active');

    const grantResponse = await fetch(`${base}/apps/app_01/permissions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'contacts', enabled: true }),
    });
    assert.equal((await grantResponse.json()).data.permissions.contacts.enabled, true);

    const recommendationId = simulation.data.recommendations[0].id;
    const applyResponse = await fetch(`${base}/security/recommendations/${recommendationId}/apply`, {
      method: 'POST',
    });
    const applied = await applyResponse.json();
    assert.equal(applied.data.recommendation.status, 'applied');
    assert.equal(applied.data.app.permissions.location.enabled, false);

    const deniedResponse = await fetch(`${base}/events/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: 'app_01',
        resource: 'location',
        startTime: '2026-11-09T14:05:00.000Z',
      }),
    });
    const denied = await deniedResponse.json();
    assert.equal(denied.data.events[0].status, 'denied');
    assert.equal(denied.data.events[0].denialReason, 'permission_disabled');

    const historyResponse = await fetch(`${base}/history?appId=app_01&limit=100`);
    const history = await historyResponse.json();
    assert.equal(history.success, true);
    assert.ok(history.data.some((item) => item.eventType === 'recommendation_applied'));
    assert.ok(history.data.some((item) => item.eventType === 'access_denied'));
    const eventResponse = await fetch(`${base}/events?appId=app_01&resource=location&limit=1&offset=1`);
    const eventList = await eventResponse.json();
    assert.equal(eventList.success, true);
    assert.equal(eventList.data.length, 1);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('demo reset refuses to run in production even when its development flag is set', async () => {
  const previousEnvironment = process.env.NODE_ENV;
  const previousResetFlag = process.env.ALLOW_DEMO_RESET;
  process.env.NODE_ENV = 'production';
  process.env.ALLOW_DEMO_RESET = 'true';
  try {
    await assert.rejects(resetDemoData(), { code: 'RESET_DISABLED' });
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
    if (previousResetFlag === undefined) delete process.env.ALLOW_DEMO_RESET;
    else process.env.ALLOW_DEMO_RESET = previousResetFlag;
  }
});
