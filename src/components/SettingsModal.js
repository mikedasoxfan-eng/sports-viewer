/**
 * Settings modal overlay.
 */

import { state } from '../lib/state.js';
import { on, emit } from '../lib/events.js';

let modalEl = null;

function applyDarkMode(dark) {
  document.documentElement.classList.toggle('dark', dark);
}

function createModal() {
  if (modalEl) return modalEl;

  modalEl = document.createElement('div');
  modalEl.id = 'settings-modal';
  modalEl.className = 'fixed inset-0 z-[60] hidden';
  document.body.appendChild(modalEl);

  function render() {
    const s = state.settings;
    modalEl.innerHTML = `
      <div class="absolute inset-0 bg-ink/40 backdrop-blur-sm" data-dismiss></div>
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                  w-full max-w-sm bg-surface-card rounded-3xl shadow-diffused border border-ink-faint/15
                  p-8 space-y-6
                  transition-all duration-500 ease-smooth">
        <div class="flex items-center justify-between">
          <h2 class="font-mono text-lg font-semibold text-ink tracking-tight">Settings</h2>
          <button data-dismiss class="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center
                    text-ink-muted hover:text-ink transition-colors duration-300 ease-smooth">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="space-y-4">
          ${toggle('darkMode', 'Dark Mode', 'Switch to dark theme', s.darkMode)}
          ${toggle('showScores', 'Show Scores', 'Display live scores on game cards', s.showScores)}
        </div>
      </div>
    `;
  }

  function toggle(key, label, description, checked) {
    return `
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="font-sans text-sm font-medium text-ink">${label}</p>
          <p class="font-sans text-xs text-ink-muted">${description}</p>
        </div>
        <button class="relative w-11 h-6 rounded-full transition-colors duration-300 ease-smooth
                      ${checked ? 'bg-accent' : 'bg-ink-faint'}"
                data-setting="${key}" aria-pressed="${checked}">
          <span class="absolute top-0.5 ${checked ? 'left-[1.375rem]' : 'left-0.5'}
                      w-5 h-5 rounded-full bg-surface-card shadow-sm
                      transition-all duration-300 ease-smooth"></span>
        </button>
      </div>
    `;
  }

  modalEl.addEventListener('click', e => {
    if (e.target.closest('[data-dismiss]')) {
      toggleModal(false);
      return;
    }
    const btn = e.target.closest('[data-setting]');
    if (btn) {
      const key = btn.dataset.setting;
      const newSettings = { ...state.settings, [key]: !state.settings[key] };
      state.settings = newSettings;

      if (key === 'darkMode') applyDarkMode(newSettings.darkMode);
      if (key === 'showScores') emit('games:refresh');

      render();
    }
  });

  render();
  return modalEl;
}

function toggleModal(show) {
  const el = createModal();
  if (show === undefined) show = el.classList.contains('hidden');
  el.classList.toggle('hidden', !show);
  if (show) createModal();
}

export function initSettingsModal() {
  // Apply dark mode on boot
  applyDarkMode(state.settings.darkMode);

  on('settings:toggle', () => toggleModal());
  on('settings:close', () => toggleModal(false));
}
