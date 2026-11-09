// M1 In-Memory Store for E.D.I.T.H.
import { seedData } from '../data/seedData.js';
import { trustLevelFor } from '../../shared/contracts.js';

let state = seedData();

export const clock = {
  now: () => new Date().toISOString(),
};

export const store = {
  clock,

  getState() {
    return state;
  },

  resetToSeed() {
    state = seedData();
    return state;
  },

  nextId(prefix) {
    if (!state.counters[prefix]) {
      state.counters[prefix] = 0;
    }
    state.counters[prefix] += 1;
    return `${prefix}_${String(state.counters[prefix]).padStart(4, '0')}`;
  },

  getApps(statusFilter = null) {
    let list = state.apps.map((app) => ({
      ...app,
      permissions: Object.fromEntries(
        Object.entries(app.permissions).map(([k, v]) => [k, { ...v }])
      ),
      trustLevel: trustLevelFor(app.trustScore),
    }));

    if (statusFilter) {
      list = list.filter((a) => a.status === statusFilter);
    }
    return list;
  },

  getApp(id) {
    const app = state.apps.find((a) => a.id === id);
    if (!app) return null;
    return {
      ...app,
      permissions: Object.fromEntries(
        Object.entries(app.permissions).map(([k, v]) => [k, { ...v }])
      ),
      trustLevel: trustLevelFor(app.trustScore),
    };
  },

  updateApp(id, updater) {
    const idx = state.apps.findIndex((a) => a.id === id);
    if (idx === -1) return null;

    const current = state.apps[idx];
    const updated = updater({
      ...current,
      permissions: Object.fromEntries(
        Object.entries(current.permissions).map(([k, v]) => [k, { ...v }])
      ),
    });

    state.apps[idx] = updated;
    return {
      ...updated,
      permissions: Object.fromEntries(
        Object.entries(updated.permissions).map(([k, v]) => [k, { ...v }])
      ),
      trustLevel: trustLevelFor(updated.trustScore),
    };
  },

  addHistory({ appId, eventType, description, metadata = {}, timestamp = null }) {
    const entry = {
      id: this.nextId('act'),
      appId,
      eventType,
      description,
      timestamp: timestamp || this.clock.now(),
      metadata,
    };
    state.history.unshift(entry);
    return entry;
  },

  getHistory(filter = {}) {
    let list = [...state.history];
    if (filter.appId) list = list.filter((h) => h.appId === filter.appId);
    if (filter.type) list = list.filter((h) => h.eventType === filter.type);
    if (filter.limit) list = list.slice(0, filter.limit);
    return list;
  },

  addEvent(event) {
    const entry = {
      ...event,
      id: event.id || this.nextId('evt'),
      timestamp: event.timestamp || this.clock.now(),
    };
    state.events.unshift(entry);
    return entry;
  },

  getEvents(filter = {}) {
    let list = [...state.events];
    if (filter.appId) list = list.filter((e) => e.appId === filter.appId);
    if (filter.resource) list = list.filter((e) => e.resource === filter.resource);
    if (filter.status) list = list.filter((e) => e.status === filter.status);
    if (typeof filter.suspicious === 'boolean') list = list.filter((e) => e.suspicious === filter.suspicious);
    if (filter.limit) list = list.slice(0, filter.limit);
    return list;
  },

  addAlert(alert) {
    const entry = {
      ...alert,
      id: alert.id || this.nextId('alt'),
      timestamp: alert.timestamp || this.clock.now(),
      relatedEventIds: alert.relatedEventIds || [],
      recommendationId: alert.recommendationId || null,
      acknowledged: alert.acknowledged ?? false,
    };
    state.alerts.unshift(entry);
    return entry;
  },

  getAlerts(filter = {}) {
    let list = [...state.alerts];
    if (filter.appId) list = list.filter((a) => a.appId === filter.appId);
    if (filter.severity) list = list.filter((a) => a.severity === filter.severity);
    if (typeof filter.acknowledged === 'boolean') list = list.filter((a) => a.acknowledged === filter.acknowledged);
    if (filter.limit) list = list.slice(0, filter.limit);
    return list;
  },

  updateAlert(id, updater) {
    const idx = state.alerts.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    const current = state.alerts[idx];
    const updated = updater({ ...current, relatedEventIds: [...current.relatedEventIds] });
    state.alerts[idx] = updated;
    return updated;
  },

  addRecommendation(rec) {
    const entry = {
      ...rec,
      id: rec.id || this.nextId('rec'),
      createdAt: rec.createdAt || this.clock.now(),
    };
    state.recommendations.unshift(entry);
    return entry;
  },

  getRecommendations(filter = {}) {
    let list = [...state.recommendations];
    if (filter.appId) list = list.filter((r) => r.appId === filter.appId);
    if (filter.status) list = list.filter((r) => r.status === filter.status);
    if (filter.limit) list = list.slice(0, filter.limit);
    return list;
  },

  updateRecommendation(id, updater) {
    const idx = state.recommendations.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const current = state.recommendations[idx];
    const updated = updater({ ...current });
    state.recommendations[idx] = updated;
    return updated;
  },

  addTrustHistory(th) {
    const entry = {
      ...th,
      id: th.id || this.nextId('ts'),
      timestamp: th.timestamp || this.clock.now(),
    };
    state.trustHistory.unshift(entry);
    return entry;
  },

  getTrustHistory(filter = {}) {
    let list = [...state.trustHistory];
    if (filter.appId) list = list.filter((t) => t.appId === filter.appId);
    if (filter.limit) list = list.slice(0, filter.limit);
    return list;
  },
};

export default store;