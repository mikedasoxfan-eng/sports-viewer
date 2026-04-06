/**
 * Keyboard shortcuts handler.
 */

import { router } from '../lib/router.js';
import { state } from '../lib/state.js';
import { emit } from '../lib/events.js';

const SHORTCUTS = [
  { key: '/', description: 'Go to games' },
  { key: 'c', description: 'Go to scores' },
  { key: 's', description: 'Go to standings' },
  { key: 'h', description: 'Go to schedule' },
  { key: 'd', description: 'Cycle theme (system/light/dark)' },
  { key: ',', description: 'Open settings' },
  { key: 'r', description: 'Refresh games' },
  { key: 'f', description: 'Fullscreen (watch page)' },
  { key: 't', description: 'Theater mode (watch page)' },
  { key: ']', description: 'Next stream' },
  { key: '[', description: 'Previous stream' },
  { key: '?', description: 'Show shortcuts' },
];

let overlayEl = null;

function createOverlay() {
  if (overlayEl) return overlayEl;
  overlayEl = document.createElement('div');
  overlayEl.id = 'shortcuts-overlay';
  overlayEl.className = 'fixed inset-0 z-[60] hidden';
  overlayEl.innerHTML = `
    <div class="absolute inset-0 bg-ink/40 backdrop-blur-sm" data-dismiss></div>
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                w-full max-w-md bg-surface-card rounded-3xl shadow-diffused border border-ink-faint/15
                p-8 space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="font-mono text-lg font-semibold text-ink tracking-tight">Keyboard Shortcuts</h2>
        <button data-dismiss class="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center
                  text-ink-muted hover:text-ink transition-colors duration-300 ease-smooth">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="space-y-1">
        ${SHORTCUTS.map(s => `
          <div class="flex items-center justify-between py-2">
            <span class="font-sans text-sm text-ink-secondary">${s.description}</span>
            <kbd class="font-mono text-xs bg-surface-elevated border border-ink-faint/20
                        rounded-lg px-2.5 py-1 text-ink-secondary">${s.key}</kbd>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(overlayEl);
  overlayEl.addEventListener('click', e => {
    if (e.target.closest('[data-dismiss]')) toggleOverlay(false);
  });
  return overlayEl;
}

function toggleOverlay(show) {
  const el = createOverlay();
  el.classList.toggle('hidden', !show);
}

export function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    const isInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'SELECT';

    if (e.key === 'Escape') {
      if (overlayEl && !overlayEl.classList.contains('hidden')) { toggleOverlay(false); return; }
      emit('settings:close');
      if (document.body.classList.contains('theater-mode')) {
        document.querySelector('#theater-btn')?.click();
        return;
      }
      if (document.fullscreenElement) document.exitFullscreen();
      return;
    }

    if (isInput) return;

    if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
      e.preventDefault();
      toggleOverlay(!overlayEl || overlayEl.classList.contains('hidden'));
      return;
    }

    if (e.key === '/') { e.preventDefault(); router.navigate('/'); return; }
    if (e.key === 'c' || e.key === 'C') { e.preventDefault(); router.navigate('/scores'); return; }
    if (e.key === 's' || e.key === 'S') { e.preventDefault(); router.navigate('/standings'); return; }
    if (e.key === 'h' || e.key === 'H') { e.preventDefault(); router.navigate('/schedule'); return; }
    if (e.key === ',') { e.preventDefault(); emit('settings:toggle'); return; }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); emit('games:refresh'); return; }

    if (e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      const cycle = { system: 'light', light: 'dark', dark: 'system' };
      const current = state.settings.darkMode || 'system';
      const next = cycle[current] || 'system';
      const newSettings = { ...state.settings, darkMode: next };
      state.settings = newSettings;
      // Resolve actual theme
      const isDark = next === 'dark' || (next === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', isDark);
      return;
    }

    if (e.key === 'f' || e.key === 'F') {
      const box = document.querySelector('#embed-box');
      if (box) {
        e.preventDefault();
        document.fullscreenElement ? document.exitFullscreen() : box.requestFullscreen?.();
      }
      return;
    }

    if (e.key === 't' || e.key === 'T') {
      const theaterBtn = document.querySelector('#theater-btn');
      if (theaterBtn) { e.preventDefault(); theaterBtn.click(); }
      return;
    }

    if (e.key === ']') {
      const active = document.querySelector('[data-stream].bg-ink');
      const next = active?.nextElementSibling;
      if (next?.dataset?.stream) { e.preventDefault(); next.click(); }
      return;
    }
    if (e.key === '[') {
      const active = document.querySelector('[data-stream].bg-ink');
      const prev = active?.previousElementSibling;
      if (prev?.dataset?.stream) { e.preventDefault(); prev.click(); }
    }
  });
}
