/**
 * Proxy-based reactive state store.
 *
 * Usage:
 *   import { state, subscribe } from './state.js';
 *   state.games = [...];
 *   const unsub = subscribe('games', (newVal) => { ... });
 */

const listeners = new Map();
let batching = false;
const pendingKeys = new Set();

function notify(key, value) {
  if (batching) {
    pendingKeys.add(key);
    return;
  }
  const set = listeners.get(key);
  if (set) {
    for (const cb of set) {
      try { cb(value); } catch (e) { console.error(`State listener error [${key}]:`, e); }
    }
  }
}

const _state = {
  // Games data
  games: [],
  filter: 'all',
  league: 'all',
  loading: false,

  // Settings
  settings: {
    showScores: true,
    darkMode: false
  },

  // Favorites (array of slug strings)
  favorites: [],

  // Search query
  search: '',

  // UI
  toasts: []
};

export const state = new Proxy(_state, {
  set(target, key, value) {
    const old = target[key];
    target[key] = value;
    if (old !== value) {
      notify(key, value);
    }
    return true;
  }
});

/**
 * Subscribe to changes on a specific state key.
 * Returns an unsubscribe function.
 */
export function subscribe(key, callback) {
  if (!listeners.has(key)) {
    listeners.set(key, new Set());
  }
  listeners.get(key).add(callback);
  return () => listeners.get(key).delete(callback);
}

/**
 * Batch multiple state updates, deferring notifications until done.
 */
export function batch(fn) {
  batching = true;
  try {
    fn();
  } finally {
    batching = false;
    for (const key of pendingKeys) {
      notify(key, _state[key]);
    }
    pendingKeys.clear();
  }
}

/**
 * Read a state value without subscribing.
 */
export function getState(key) {
  return _state[key];
}
