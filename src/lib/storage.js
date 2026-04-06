/**
 * LocalStorage persistence bridge.
 * Hydrates state from storage on boot and persists changes automatically.
 */

import { state, subscribe, batch } from './state.js';

const KEYS = {
  settings: 'sv_settings',
  filter: 'sv_filter',
  league: 'sv_league',
  favorites: 'sv_favorites'
};

function safeGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Storage write failed:', e);
  }
}

/**
 * Initialize storage: hydrate state, set up persistence listeners.
 */
export function initStorage() {
  // Hydrate
  batch(() => {
    const settings = safeGet(KEYS.settings);
    if (settings && typeof settings === 'object') {
      // Migrate boolean darkMode to tri-state string
      if (typeof settings.darkMode === 'boolean') {
        settings.darkMode = settings.darkMode ? 'dark' : 'light';
      }
      state.settings = { ...state.settings, ...settings };
    }

    const favorites = safeGet(KEYS.favorites);
    if (Array.isArray(favorites)) state.favorites = favorites;

    const filter = safeGet(KEYS.filter);
    if (filter) state.filter = filter;

    const league = safeGet(KEYS.league);
    if (league) state.league = league;
  });

  // Persist on change
  subscribe('settings', val => safeSet(KEYS.settings, val));
  subscribe('filter', val => safeSet(KEYS.filter, val));
  subscribe('league', val => safeSet(KEYS.league, val));
  subscribe('favorites', val => safeSet(KEYS.favorites, val));
}
