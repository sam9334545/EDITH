import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { store } from '../store/index.js';
import securityRoutes from '../test-support/inMemorySecurityRoutes.js';

beforeEach(() => store.resetToSeed());

async function withServer(run) {
  const app = express();
  app.use('/api/security', securityRoutes);
  const server = app.listen(0);
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/security`;
    await run(base);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function seedAlerts(count) {
  for (let index = 0; index < count; index += 1) {
    store.alerts.push({
      id: store.nextId('alt'),
      appId: index % 2 === 0 ? 'app_01' : 'app_02',
      type: 'excessive_access',
      severity: index % 2 === 0 ? 'high' : 'medium',
      message: `Seeded alert ${index}`,
      timestamp: new Date(Date.UTC(2026, 10, 9, 10, index)).toISOString(),
      relatedEventIds: [],
      recommendationId: null,
      acknowledged: index % 3 === 0,
    });
  }
}

test('GET /alerts defaults to 50, filters in combination, and returns newest first', async () => {
  seedAlerts(60);
  await withServer(async (base) => {
    const defaultResponse = await fetch(`${base}/alerts`);
    const defaultBody = await defaultResponse.json();
    assert.equal(defaultResponse.status, 200);
    assert.equal(defaultBody.data.length, 50);
    assert.equal(defaultBody.data[0].id, store.alerts.at(-1).id);

    const filteredResponse = await fetch(
      `${base}/alerts?appId=app_01&severity=high&acknowledged=false&limit=4`,
    );
    const filteredBody = await filteredResponse.json();
    assert.equal(filteredResponse.status, 200);
    assert.ok(filteredBody.data.length <= 4);
    assert.ok(filteredBody.data.every((alert) => (
      alert.appId === 'app_01' && alert.severity === 'high' && !alert.acknowledged
    )));
  });
});

test('GET /alerts validates query values and accepts the maximum limit', async () => {
  seedAlerts(60);
  await withServer(async (base) => {
    for (const query of [
      'appId=',
      'severity=urgent',
      'acknowledged=yes',
      'limit=0',
      'limit=1.5',
      'limit=201',
    ]) {
      const response = await fetch(`${base}/alerts?${query}`);
      const body = await response.json();
      assert.equal(response.status, 400, query);
      assert.equal(body.error.code, 'VALIDATION_ERROR', query);
    }

    const response = await fetch(`${base}/alerts?limit=200`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.length, 60);
  });
});

test('PATCH /alerts/:id/acknowledge updates alerts and returns 404 for missing alerts', async () => {
  seedAlerts(1);
  const alert = store.alerts[0];
  await withServer(async (base) => {
    const response = await fetch(`${base}/alerts/${alert.id}/acknowledge`, { method: 'PATCH' });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.acknowledged, true);
    assert.equal(alert.acknowledged, true);

    const missingResponse = await fetch(`${base}/alerts/alt_9999/acknowledge`, { method: 'PATCH' });
    const missingBody = await missingResponse.json();
    assert.equal(missingResponse.status, 404);
    assert.equal(missingBody.error.code, 'ALERT_NOT_FOUND');
  });
});
