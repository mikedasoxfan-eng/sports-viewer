/**
 * Status + league filter pills.
 */

import { state } from '../lib/state.js';
import { delegate } from '../lib/dom.js';
import { SUPPORTED_LEAGUES, getLeagueName } from '../config.js';
import { emit } from '../lib/events.js';

export function FilterBar(container) {
  const cleanups = [];

  function render() {
    const f = state.filter;
    const l = state.league;

    container.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6
                  pb-5 border-b border-ink-faint/8">
        <div class="flex items-center gap-1">
          ${pill('all', 'All', f)}
          ${pill('live', 'Live', f, true)}
          ${pill('upcoming', 'Upcoming', f)}
        </div>
        <div class="flex items-center gap-1">
          <button class="filter-pill ${'all' === l ? 'active' : ''}" data-league="all">All</button>
          ${SUPPORTED_LEAGUES.map(lg =>
            `<button class="filter-pill ${lg === l ? 'active' : ''}" data-league="${lg}">${getLeagueName(lg)}</button>`
          ).join('')}
        </div>
      </div>
    `;
  }

  function pill(value, label, active, isLive = false) {
    const dot = isLive
      ? `<span class="w-1.5 h-1.5 rounded-full bg-live ${value === active ? 'animate-pulse-live' : 'opacity-60'}"></span>`
      : '';
    return `<button class="filter-pill ${value === active ? 'active' : ''}" data-filter="${value}">
      ${dot}${label}
    </button>`;
  }

  render();

  cleanups.push(delegate(container, 'click', '[data-filter]', (e, target) => {
    state.filter = target.dataset.filter;
    render();
    emit('games:refresh');
  }));

  cleanups.push(delegate(container, 'click', '[data-league]', (e, target) => {
    state.league = target.dataset.league;
    render();
    emit('games:refresh');
  }));

  return () => cleanups.forEach(fn => fn());
}
