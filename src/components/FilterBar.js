/**
 * Status + league filter pills with game counts.
 */

import { state, subscribe } from '../lib/state.js';
import { delegate } from '../lib/dom.js';
import { SUPPORTED_LEAGUES, getLeagueName } from '../config.js';
import { emit } from '../lib/events.js';

export function FilterBar(container) {
  const cleanups = [];

  function countByFilter(games, filter) {
    if (filter === 'all') return games.length;
    if (filter === 'live') return games.filter(g => g.isLive).length;
    if (filter === 'upcoming') return games.filter(g => !g.isLive && !g.isEnded).length;
    return 0;
  }

  function render() {
    const f = state.filter;
    const l = state.league;
    const games = state.games || [];

    container.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6
                  pb-5 border-b border-ink-faint/8">
        <div class="flex items-center gap-1">
          ${pill('all', 'All', countByFilter(games, 'all'), f)}
          ${pill('live', 'Live', countByFilter(games, 'live'), f, true)}
          ${pill('upcoming', 'Upcoming', countByFilter(games, 'upcoming'), f)}
        </div>
        <div class="flex items-center gap-1 flex-wrap">
          <button class="filter-pill ${'all' === l ? 'active' : ''}" data-league="all">All</button>
          ${SUPPORTED_LEAGUES.map(lg =>
            `<button class="filter-pill ${lg === l ? 'active' : ''}" data-league="${lg}">${getLeagueName(lg)}</button>`
          ).join('')}
        </div>
      </div>
    `;
  }

  function pill(value, label, count, active, isLive = false) {
    const dot = isLive
      ? `<span class="w-1.5 h-1.5 rounded-full bg-live ${value === active ? 'animate-pulse-live' : 'opacity-60'}"></span>`
      : '';
    const badge = count > 0 ? `<span class="font-mono text-[10px] ${value === active ? 'text-ink-secondary' : 'text-ink-muted/60'}">${count}</span>` : '';
    return `<button class="filter-pill ${value === active ? 'active' : ''}" data-filter="${value}">
      ${dot}${label}${badge}
    </button>`;
  }

  render();

  // Re-render counts when games update
  cleanups.push(subscribe('games', () => render()));

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
