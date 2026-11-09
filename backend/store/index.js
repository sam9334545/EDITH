// STUB: replace with M1 implementation
import seedData from '../data/seedData.js';

let state = seedData();

export const store = {
  getState: () => state,
  resetToSeed: () => {
    state = seedData();
    return state;
  },
  nextId: (prefix) => {
    if (!state.counters) {
      state.counters = {};
    }
    state.counters[prefix] = (state.counters[prefix] || 0) + 1;
    return `${prefix}_${String(state.counters[prefix]).padStart(4, '0')}`;
  },
  clock: {
    now: () => new Date().toISOString(),
  },
  get apps() { return state.apps; },
  get events() { return state.events; },
  get alerts() { return state.alerts; },
  get recommendations() { return state.recommendations; },
  get history() { return state.history; },
  get trustHistory() { return state.trustHistory; },
  get counters() { return state.counters; },
};

export const getState = store.getState;
export const resetToSeed = store.resetToSeed;
export const nextId = store.nextId;
export default store;

