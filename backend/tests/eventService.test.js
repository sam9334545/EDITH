import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  RESOURCE_TYPES,
  ACCESS_STATUS,
  ACTIVITY_EVENT_TYPES,
  APPLICATION_STATUS,
} from '../../shared/contracts.js';
import { store } from '../store/index.js';
import { createEvent } from '../services/eventService.js';
import { processAccessRequest } from '../services/accessPipeline.js';

describe('M3 - eventService', () => {
  beforeEach(() => {
    store.resetToSeed();
  });

  test('validates app input', () => {
    assert.throws(
      () => createEvent({ app: null, resource: 'location', decision: 'allowed' }),
      (err) => err.code === 'VALIDATION_ERROR'
    );
    assert.throws(
      () => createEvent({ app: { id: '' }, resource: 'location', decision: 'allowed' }),
      (err) => err.code === 'VALIDATION_ERROR'
    );
  });

  test('validates resource input', () => {
    const app = store.apps[0];
    assert.throws(
      () => createEvent({ app, resource: 'invalid_resource', decision: 'allowed' }),
      (err) => err.code === 'RESOURCE_INVALID'
    );
  });

  test('validates decision input', () => {
    const app = store.apps[0];
    assert.throws(
      () => createEvent({ app, resource: 'location', decision: null }),
      (err) => err.code === 'VALIDATION_ERROR'
    );
  });

  test('creates allowed event with evt_XXXX id, pushes to store and creates ActivityHistory', () => {
    const app = store.apps[0];
    const initialEventsCount = store.events.length;
    const initialHistoryCount = store.history.length;

    const event = createEvent({
      app,
      resource: 'location',
      reason: 'Workout tracking',
      timestamp: '2026-11-09T10:00:00.000Z',
      decision: { allowed: true, reason: 'ok' },
    });

    assert.equal(event.id, 'evt_0006');
    assert.equal(event.appId, app.id);
    assert.equal(event.resource, 'location');
    assert.equal(event.reason, 'Workout tracking');
    assert.equal(event.timestamp, '2026-11-09T10:00:00.000Z');
    assert.equal(event.status, ACCESS_STATUS.ALLOWED);
    assert.equal(event.suspicious, false);
    assert.equal(event.alertId, null);
    assert.equal(event.denialReason, undefined);

    // Verify pushed to store.events
    assert.equal(store.events.length, initialEventsCount + 1);
    assert.deepEqual(store.events[store.events.length - 1], event);

    // Verify ActivityHistory
    assert.equal(store.history.length, initialHistoryCount + 1);
    const lastHistory = store.history[store.history.length - 1];
    assert.equal(lastHistory.id, 'act_0006');
    assert.equal(lastHistory.appId, app.id);
    assert.equal(lastHistory.eventType, ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED);
    assert.equal(lastHistory.description, 'location access allowed');
    assert.equal(lastHistory.timestamp, '2026-11-09T10:00:00.000Z');
    assert.deepEqual(lastHistory.metadata, { resource: 'location', eventId: event.id });
  });

  test('creates denied event with denialReason permission_disabled', () => {
    const app = store.apps[0];
    const event = createEvent({
      app,
      resource: 'contacts',
      reason: 'Read contacts',
      decision: { allowed: false, reason: 'permission_disabled' },
    });

    assert.equal(event.status, ACCESS_STATUS.DENIED);
    assert.equal(event.denialReason, 'permission_disabled');

    const lastHistory = store.history[store.history.length - 1];
    assert.equal(lastHistory.eventType, ACTIVITY_EVENT_TYPES.ACCESS_DENIED);
    assert.equal(lastHistory.description, 'contacts access denied');
    assert.equal(lastHistory.metadata.denialReason, 'permission_disabled');
  });

  test('creates denied event with denialReason app_suspended when app is suspended', () => {
    const app = { ...store.apps[0], status: APPLICATION_STATUS.SUSPENDED };
    const event = createEvent({
      app,
      resource: 'location',
      decision: 'denied',
    });

    assert.equal(event.status, ACCESS_STATUS.DENIED);
    assert.equal(event.denialReason, 'app_suspended');
  });

  test('processAccessRequest stub integrates properly with createEvent', async () => {
    const res = await processAccessRequest({
      appId: 'app_01',
      resource: 'location',
      reason: 'Testing access pipeline stub',
      timestamp: '2026-11-09T10:30:00.000Z',
    });

    assert.ok(res.event);
    assert.equal(res.event.appId, 'app_01');
    assert.equal(res.event.status, ACCESS_STATUS.ALLOWED);
    assert.equal(res.app.permissions.location.lastAccessedAt, '2026-11-09T10:30:00.000Z');
  });
});

