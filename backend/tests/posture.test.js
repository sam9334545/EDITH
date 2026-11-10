import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { app } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../database/connection.js';
import App from '../models/App.js';
import Event from '../models/Event.js';
import Alert from '../models/Alert.js';
import TrustHistory from '../models/TrustHistory.js';
import Recommendation from '../models/Recommendation.js';
import ActivityHistory from '../models/ActivityHistory.js';
import SecurityFinding from '../models/SecurityFinding.js';
import SecurityPolicy from '../models/SecurityPolicy.js';
import { resetDemoData, seedApplications, updatePermission } from '../services/mongoService.js';
import { seedPostureDemoData } from '../services/demoDataService.js';
import {
  getApplicationPosture,
  getPostureFindings,
  getPostureIncidents,
  getPostureOverview,
  getPosturePolicies,
  updateFindingStatus,
  updatePosturePolicy,
} from '../services/postureService.js';
import seedData from '../data/seedData.js';

let replicaSet;
let databaseUri;

before(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  databaseUri = replicaSet.getUri('edith_posture_test');
  await connectDatabase(databaseUri);
});

beforeEach(async () => {
  await SecurityFinding.deleteMany({});
  await SecurityPolicy.deleteMany({});
  await ActivityHistory.deleteMany({});
  await Recommendation.deleteMany({});
  await TrustHistory.deleteMany({});
  await Alert.deleteMany({});
  await Event.deleteMany({});
  await App.deleteMany({});
  await seedApplications();
  await seedPostureDemoData();
  await getPostureOverview({ days: 30 });
});

after(async () => {
  await disconnectDatabase();
  await replicaSet.stop();
});

test('demo profiles produce the documented 2/3/5/5 risk distribution', async () => {
  const overview = await getPostureOverview({ days: 30 });
  assert.equal(overview.summary.totalApplications, 15);
  assert.deepEqual(Object.fromEntries(overview.riskDistribution.map(({ riskLevel, count }) => [riskLevel, count])), {
    critical: 2,
    high: 3,
    medium: 5,
    low: 5,
  }, JSON.stringify(overview.applications.map(({ id, trustScore, postureScore, riskLevel }) => ({
    id, trustScore, postureScore, riskLevel,
  }))));
  assert.ok(overview.summary.openFindings > 0);
  assert.ok(overview.summary.unacknowledgedCriticalAlerts > 0);
  assert.ok(overview.runtime.demoEvents > 0);
});

test('permission findings explain excessive access and distinguish unused monitored access', async () => {
  const excessive = await getPostureFindings({
    appId: 'app_07',
    findingType: 'excessive_permission',
  });
  assert.ok(excessive.items.some((finding) => (
    finding.permissionResources.includes('camera')
      && finding.reason.includes('not listed in its declared requirements')
  )));

  const unused = await getPostureFindings({
    appId: 'app_15',
    findingType: 'unused_permission',
  });
  assert.ok(unused.items.some((finding) => (
    finding.reason.includes('at least 30 days')
      && finding.reason.includes('no matching access event')
  )));

  const combination = await getPostureFindings({
    appId: 'app_14',
    findingType: 'risky_combination',
  });
  assert.ok(combination.items.some((finding) => (
    finding.permissionResources.includes('camera')
      && finding.permissionResources.includes('microphone')
      && finding.reason.includes('not proof of malicious activity')
  )));
});

test('repeated violation findings and incidents preserve unique event relationships', async () => {
  const repeated = await getPostureFindings({
    appId: 'app_13',
    findingType: 'policy_violation',
    limit: 100,
  });
  const repeatedFinding = repeated.items.find((finding) => finding.ruleId === 'REPEATED_RESTRICTED_ACCESS');
  assert.ok(repeatedFinding);
  assert.equal(repeatedFinding.relatedEventIds.length, 3);
  assert.equal(repeatedFinding.alertIds.length, 1);

  const appPosture = await getApplicationPosture('app_15');
  assert.equal(new Set(appPosture.riskBreakdown.alertLinkedEventIds).size, 11);
  assert.equal(appPosture.riskBreakdown.uniqueUnlinkedSecurityEvents.count, 0);

  const incidents = await getPostureIncidents({ appId: 'app_15', limit: 100 });
  assert.equal(incidents.total, 11);
  assert.equal(new Set(incidents.items.map((incident) => incident.eventId)).size, 11);
  assert.ok(incidents.items.every((incident) => incident.simulated && incident.ruleTriggered.length));
  assert.ok(incidents.items.every((incident) => incident.timeline.every((item, index, timeline) => (
    index === 0 || new Date(timeline[index - 1].timestamp) <= new Date(item.timestamp)
  ))));
  const scoredIncident = incidents.items.find((incident) => incident.trustScoreBefore !== null);
  assert.ok(scoredIncident);
  assert.equal(
    scoredIncident.trustScoreAfter - scoredIncident.trustScoreBefore,
    scoredIncident.trustScoreChange,
  );
});

test('finding acknowledgement updates linked alert and permission remediation resolves findings', async () => {
  const critical = await getPostureFindings({
    appId: 'app_14',
    findingType: 'unacknowledged_critical_alert',
  });
  assert.equal(critical.items.length, 1);
  const acknowledged = await updateFindingStatus(critical.items[0].id, 'acknowledge');
  assert.equal(acknowledged.status, 'acknowledged');
  assert.equal(await Alert.countDocuments({ appId: (await App.findOne({ id: 'app_14' }))._id, acknowledged: false }), 0);

  const excessive = await getPostureFindings({
    appId: 'app_07',
    findingType: 'excessive_permission',
  });
  await assert.rejects(updateFindingStatus(excessive.items[0].id, 'resolve'), { code: 'VALIDATION_ERROR' });
  await updatePermission('app_07', 'camera', false);
  const afterRemediation = await getPostureFindings({
    appId: 'app_07',
    findingType: 'excessive_permission',
    status: 'resolved',
  });
  assert.ok(afterRemediation.items.some((finding) => finding.id === excessive.items[0].id));
});

test('policy updates validate input and are reflected in posture policy data', async () => {
  const policy = await updatePosturePolicy('REPEATED_RESTRICTED_ACCESS', { threshold: 4, enabled: false });
  assert.equal(policy.threshold, 4);
  assert.equal(policy.enabled, false);
  assert.equal((await getPosturePolicies()).find((item) => item.ruleId === policy.ruleId).threshold, 4);
  await assert.rejects(updatePosturePolicy(policy.ruleId, { threshold: 0 }), { code: 'VALIDATION_ERROR' });

  const before = await getApplicationPosture('app_10');
  await updatePosturePolicy('UNUSED_SENSITIVE_PERMISSION', { weight: 8 });
  const after = await getApplicationPosture('app_10');
  assert.equal(after.riskBreakdown.unusedSensitivePermissions.weight, 8);
  assert.equal(
    after.postureScore,
    before.postureScore - (4 * before.riskBreakdown.unusedSensitivePermissions.count),
  );
  assert.equal((await getPosturePolicies()).find((item) => item.ruleId === 'UNUSED_SENSITIVE_PERMISSION').weight, 8);

  const excessiveBefore = await getApplicationPosture('app_07');
  await updatePosturePolicy('PERMISSION_NOT_DECLARED', { weight: 28 });
  const excessiveAfter = await getApplicationPosture('app_07');
  assert.equal(
    excessiveAfter.postureScore,
    excessiveBefore.postureScore - (10 * excessiveBefore.riskBreakdown.excessivePermissions.count),
  );
});

test('demo seeding is idempotent and reset preserves unmarked application data', async () => {
  const before = {
    apps: await App.countDocuments(),
    events: await Event.countDocuments(),
    alerts: await Alert.countDocuments(),
    findings: await SecurityFinding.countDocuments(),
  };
  await seedPostureDemoData();
  await getPostureOverview({ days: 30 });
  assert.deepEqual({
    apps: await App.countDocuments(),
    events: await Event.countDocuments(),
    alerts: await Alert.countDocuments(),
    findings: await SecurityFinding.countDocuments(),
  }, before);

  await App.create({
    ...seedData().apps[0],
    id: 'real_app',
    name: 'Unmarked application',
    isDemo: false,
    demoId: null,
  });
  const previousEnvironment = process.env.NODE_ENV;
  const previousResetFlag = process.env.ALLOW_DEMO_RESET;
  process.env.NODE_ENV = 'development';
  process.env.ALLOW_DEMO_RESET = 'true';
  try {
    await resetDemoData();
    assert.ok(await App.findOne({ id: 'real_app', isDemo: false }));
    assert.equal(await App.countDocuments({ isDemo: true }), 15);
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
    if (previousResetFlag === undefined) delete process.env.ALLOW_DEMO_RESET;
    else process.env.ALLOW_DEMO_RESET = previousResetFlag;
  }
});

test('posture HTTP routes preserve the shared envelope and filter findings', async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/posture`;
  try {
    const overviewResponse = await fetch(`${base}/overview?days=30`);
    const overview = await overviewResponse.json();
    assert.equal(overviewResponse.status, 200);
    assert.equal(overview.success, true);
    assert.equal(overview.data.summary.totalApplications, 15);

    const findingsResponse = await fetch(`${base}/findings?appId=app_14&severity=critical`);
    const findings = await findingsResponse.json();
    assert.equal(findingsResponse.status, 200);
    assert.equal(findings.success, true);
    assert.ok(findings.data.items.every((finding) => finding.appId === 'app_14' && finding.severity === 'critical'));

    const invalidResponse = await fetch(`${base}/findings?from=not-a-date`);
    const invalid = await invalidResponse.json();
    assert.equal(invalidResponse.status, 400);
    assert.equal(invalid.error.code, 'VALIDATION_ERROR');

  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
