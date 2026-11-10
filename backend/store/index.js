// M1 In-Memory Store for E.D.I.T.H.
import seedData from '../data/seedData.js';
import { trustLevelFor, GUARD_MODES, DEFAULT_GUARD_MODE } from '../../shared/contracts.js';

function initialGuardMode() {
  const env = process.env.RUNTIME_GUARD_MODE;
  return Object.values(GUARD_MODES).includes(env) ? env : DEFAULT_GUARD_MODE;
}

class DataStore {
  constructor() {
    this.resetToSeed();
  }

  resetToSeed() {
    const seed = seedData();
    // Deep clone to prevent mutations from leaking across resets
    this.apps = JSON.parse(JSON.stringify(seed.apps));
    this.events = JSON.parse(JSON.stringify(seed.events));
    this.alerts = JSON.parse(JSON.stringify(seed.alerts));
    this.recommendations = JSON.parse(JSON.stringify(seed.recommendations));
    this.history = JSON.parse(JSON.stringify(seed.history));
    this.trustHistory = JSON.parse(JSON.stringify(seed.trustHistory));
    this.counters = JSON.parse(JSON.stringify(seed.counters));
    this.guardMode = initialGuardMode();
    this.guardDecisions = [];
    this._mockClock = null;
    return this.getState();
  }

  nextId(prefix) {
    if (!this.counters[prefix] && this.counters[prefix] !== 0) {
      this.counters[prefix] = 0;
    }
    this.counters[prefix] += 1;
    return `${prefix}_${String(this.counters[prefix]).padStart(4, '0')}`;
  }

  clock = {
    now: () => this._mockClock || new Date().toISOString(),
    setMockTime: (isoString) => {
      this._mockClock = isoString;
    },
    clearMockTime: () => {
      this._mockClock = null;
    },
  };

  getState() {
    return {
      apps: this.apps.map((app) => ({
        ...app,
        permissions: Object.fromEntries(
          Object.entries(app.permissions).map(([k, v]) => [k, { ...v }])
        ),
        trustLevel: trustLevelFor(app.trustScore),
      })),
      events: this.events,
      alerts: this.alerts,
      recommendations: this.recommendations,
      history: this.history,
      trustHistory: this.trustHistory,
      counters: this.counters,
    };
  }

  findAppById(appId) {
    return this.apps.find((a) => a.id === appId) || null;
  }

  getApps(statusFilter = null) {
    let list = this.getState().apps;
    if (statusFilter) {
      list = list.filter((a) => a.status === statusFilter);
    }
    return list;
  }

  getApp(id) {
    const app = this.apps.find((a) => a.id === id);
    if (!app) return null;
    return {
      ...app,
      permissions: Object.fromEntries(
        Object.entries(app.permissions).map(([k, v]) => [k, { ...v }])
      ),
      trustLevel: trustLevelFor(app.trustScore),
    };
  }

  updateApp(id, updater) {
    const idx = this.apps.findIndex((a) => a.id === id);
    if (idx === -1) return null;

    const current = this.apps[idx];
    const updated = updater({
      ...current,
      permissions: Object.fromEntries(
        Object.entries(current.permissions).map(([k, v]) => [k, { ...v }])
      ),
    });

    this.apps[idx] = updated;
    return {
      ...updated,
      permissions: Object.fromEntries(
        Object.entries(updated.permissions).map(([k, v]) => [k, { ...v }])
      ),
      trustLevel: trustLevelFor(updated.trustScore),
    };
  }

  addHistory({ appId, eventType, description, metadata = {}, timestamp = null }) {
    const entry = {
      id: this.nextId('act'),
      appId,
      eventType,
      description,
      timestamp: timestamp || this.clock.now(),
      metadata,
    };
    this.history.push(entry);
    return entry;
  }

  getHistory(filter = {}) {
    let list = [...this.history].reverse();
    if (filter.appId) list = list.filter((h) => h.appId === filter.appId);
    if (filter.type) list = list.filter((h) => h.eventType === filter.type);
    if (filter.limit) list = list.slice(0, filter.limit);
    return list;
  }

  addEvent(event) {
    const entry = {
      ...event,
      id: event.id || this.nextId('evt'),
      timestamp: event.timestamp || this.clock.now(),
    };
    this.events.unshift(entry);
    return entry;
  }

  getEvents(filter = {}) {
    let list = [...this.events];
    if (filter.appId) list = list.filter((e) => e.appId === filter.appId);
    if (filter.resource) list = list.filter((e) => e.resource === filter.resource);
    if (filter.status) list = list.filter((e) => e.status === filter.status);
    if (typeof filter.suspicious === 'boolean') list = list.filter((e) => e.suspicious === filter.suspicious);
    if (filter.limit) list = list.slice(0, filter.limit);
    return list;
  }

  addAlert(alert) {
    const entry = {
      ...alert,
      id: alert.id || this.nextId('alt'),
      timestamp: alert.timestamp || this.clock.now(),
      relatedEventIds: alert.relatedEventIds || [],
      recommendationId: alert.recommendationId || null,
      acknowledged: alert.acknowledged ?? false,
    };
    this.alerts.unshift(entry);
    return entry;
  }

  getAlerts(filter = {}) {
    let list = [...this.alerts];
    if (filter.appId) list = list.filter((a) => a.appId === filter.appId);
    if (filter.severity) list = list.filter((a) => a.severity === filter.severity);
    if (typeof filter.acknowledged === 'boolean') list = list.filter((a) => a.acknowledged === filter.acknowledged);
    if (filter.limit) list = list.slice(0, filter.limit);
    return list;
  }

  updateAlert(id, updater) {
    const idx = this.alerts.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    const current = this.alerts[idx];
    const updated = updater({ ...current, relatedEventIds: [...current.relatedEventIds] });
    this.alerts[idx] = updated;
    return updated;
  }

  addRecommendation(rec) {
    const entry = {
      ...rec,
      id: rec.id || this.nextId('rec'),
      createdAt: rec.createdAt || this.clock.now(),
    };
    this.recommendations.unshift(entry);
    return entry;
  }

  getRecommendations(filter = {}) {
    let list = [...this.recommendations];
    if (filter.appId) list = list.filter((r) => r.appId === filter.appId);
    if (filter.status) list = list.filter((r) => r.status === filter.status);
    if (filter.limit) list = list.slice(0, filter.limit);
    return list;
  }

  updateRecommendation(id, updater) {
    const idx = this.recommendations.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const current = this.recommendations[idx];
    const updated = updater({ ...current });
    this.recommendations[idx] = updated;
    return updated;
  }

  getGuardMode() {
    return this.guardMode;
  }

  setGuardMode(mode) {
    if (!Object.values(GUARD_MODES).includes(mode)) return null;
    const previousMode = this.guardMode;
    this.guardMode = mode;
    return { mode, previousMode, updatedAt: this.clock.now() };
  }

  addGuardDecision(decision) {
    const entry = { ...decision, decisionId: decision.decisionId || this.nextId('gd') };
    this.guardDecisions.push(entry);
    return entry;
  }

  getGuardDecisions(filter = {}) {
    let list = [...this.guardDecisions].reverse(); // newest first
    if (filter.appId) list = list.filter((d) => d.appId === filter.appId);
    if (filter.decision) list = list.filter((d) => d.decision === filter.decision);
    if (filter.limit) list = list.slice(0, filter.limit);
    return list;
  }

  addTrustHistory(th) {
    const entry = {
      ...th,
      id: th.id || this.nextId('ts'),
      timestamp: th.timestamp || this.clock.now(),
    };
    this.trustHistory.unshift(entry);
    return entry;
  }

  getTrustHistory(filter = {}) {
    let list = [...this.trustHistory];
    if (filter.appId) list = list.filter((t) => t.appId === filter.appId);
    if (filter.limit) list = list.slice(0, filter.limit);
    return list;
  }
}

export const store = new DataStore();
export default store;