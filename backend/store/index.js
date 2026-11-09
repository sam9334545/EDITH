import seedData from '../data/seedData.js';
import { trustLevelFor } from '../../shared/contracts.js';

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
}

export const store = new DataStore();
export default store;
