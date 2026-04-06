/**
 * Floating pill navbar with live badge and quick league filters.
 */

import { state, subscribe } from '../lib/state.js';
import { emit } from '../lib/events.js';

const GearIcon = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;

function liveBadge(count) {
  if (count <= 0) return '';
  return `<span class="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1
                        rounded-full bg-live text-white font-mono text-[10px] font-bold
                        animate-badge-pop leading-none">${count}</span>`;
}

export function Navbar(container) {
  function render() {
    const count = state.liveCount || 0;

    container.innerHTML = `
      <nav class="mx-auto max-w-2xl rounded-full bg-surface-card/80 backdrop-blur-xl
                  shadow-navbar border border-ink-faint/15
                  px-1.5 py-1
                  flex items-center justify-between
                  transition-all duration-500 ease-smooth">
        <a href="#/" class="font-mono font-bold text-[13px] tracking-tight px-4 py-2
                            text-ink transition-colors duration-300 ease-smooth
                            hover:text-accent no-underline select-none">
          sports<span class="text-ink-muted font-normal">.viewer</span>
        </a>
        <div class="flex items-center gap-0.5">
          <a href="#/" class="nav-pill" data-route="/">
            Games ${liveBadge(count)}
          </a>
          <a href="#/scores" class="nav-pill" data-route="/scores">Scores</a>
          <a href="#/standings" class="nav-pill" data-route="/standings">Standings</a>
          <a href="#/stats" class="nav-pill hidden sm:inline-flex" data-route="/stats">Stats</a>
          <a href="#/schedule" class="nav-pill hidden sm:inline-flex" data-route="/schedule">Schedule</a>
          <button id="settings-trigger" class="nav-pill" aria-label="Settings" title="Settings">
            ${GearIcon}
          </button>
        </div>
      </nav>
    `;

    // Reapply active route class
    const current = window.location.hash.slice(1) || '/';
    container.querySelectorAll('[data-route]').forEach(el => {
      const route = el.dataset.route;
      el.classList.toggle('active', current === route || (route === '/' && current === ''));
    });

    container.querySelector('#settings-trigger')?.addEventListener('click', () => {
      emit('settings:toggle');
    });
  }

  render();

  // Re-render when live count or league changes
  subscribe('liveCount', () => render());
}
