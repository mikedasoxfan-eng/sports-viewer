/**
 * Games list page — search, filters, favorites, game grid.
 */

import { state } from '../lib/state.js';
import { fetchGames } from '../lib/api.js';
import { on, emit } from '../lib/events.js';
import { delegate } from '../lib/dom.js';
import { FilterBar } from '../components/FilterBar.js';
import { GameGrid } from '../components/GameGrid.js';
import { GamesGridSkeleton } from '../components/Loader.js';
import { enrichGame, sortEnrichedGames, applyEspnStatus } from '../lib/enrich.js';
import { showToast } from '../components/Toast.js';

function dedup(games) {
  const seen = new Map();
  for (const g of games) {
    const a = (g.awayTeam?.name || '').toLowerCase().trim();
    const h = (g.homeTeam?.name || '').toLowerCase().trim();
    if (!a && !h) continue;
    const key = `${g.league}:${[a, h].sort().join('|')}`;
    const existing = seen.get(key);
    if (!existing) { seen.set(key, g); continue; }
    if (g.isLive && !existing.isLive) seen.set(key, g);
    else if ((g.sources?.length || 0) > (existing.sources?.length || 0)) seen.set(key, g);
  }
  return [...seen.values()];
}

function filterBySearch(games, query) {
  if (!query) return games;
  const q = query.toLowerCase();
  return games.filter(g => {
    const text = `${g.awayTeam?.name || ''} ${g.homeTeam?.name || ''} ${g.title || ''} ${g.league || ''}`.toLowerCase();
    return text.includes(q);
  });
}

function sortWithFavorites(games) {
  const favs = new Set(state.favorites);
  return games.slice().sort((a, b) => {
    const af = favs.has(a.slug) ? 1 : 0;
    const bf = favs.has(b.slug) ? 1 : 0;
    if (af !== bf) return bf - af; // favorites first
    if (a.isEnded && !b.isEnded) return 1;
    if (!a.isEnded && b.isEnded) return -1;
    if (a.isLive && !b.isLive) return -1;
    if (!a.isLive && b.isLive) return 1;
    return (a.timestamp || 0) - (b.timestamp || 0);
  });
}

export function GamesPage(container) {
  const cleanups = [];
  let isFirstLoad = true;
  let lastUpdated = null;
  let allGames = []; // unfiltered for counts

  container.innerHTML = `
    <div class="pt-6">
      <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <h1 class="font-mono text-2xl sm:text-3xl font-bold tracking-tighter text-ink mb-1">Games</h1>
          <p id="status-line" class="font-sans text-sm text-ink-secondary">Live and upcoming matchups</p>
        </div>
        <div class="relative w-full sm:w-64">
          <input id="search-input" type="text" placeholder="Search teams..."
            class="w-full pl-9 pr-4 py-2 rounded-xl bg-surface-elevated border border-ink-faint/15
                   font-sans text-sm text-ink placeholder-ink-muted/50
                   transition-all duration-300 ease-smooth
                   focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-ink-faint/30" />
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
      </div>
      <div id="filter-bar"></div>
      <div id="games-grid"></div>
    </div>
  `;

  const filterMount = container.querySelector('#filter-bar');
  const gridMount = container.querySelector('#games-grid');
  const searchInput = container.querySelector('#search-input');
  const statusLine = container.querySelector('#status-line');

  const filterCleanup = FilterBar(filterMount);
  cleanups.push(filterCleanup);

  gridMount.innerHTML = GamesGridSkeleton(6);

  function updateStatusLine() {
    if (!statusLine) return;
    const live = allGames.filter(g => g.isLive).length;
    const total = allGames.length;
    const timeStr = lastUpdated ? new Date(lastUpdated).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
    const parts = [];
    if (live > 0) parts.push(`${live} live`);
    parts.push(`${total} games`);
    if (timeStr) parts.push(`updated ${timeStr}`);
    statusLine.textContent = parts.join(' \u00b7 ');
  }

  function renderGames() {
    const searched = filterBySearch(allGames, state.search);
    const sorted = sortWithFavorites(searched);
    state.games = sorted;
    GameGrid(gridMount, sorted);
  }

  async function loadGames(force = false) {
    state.loading = true;
    if (isFirstLoad) gridMount.innerHTML = GamesGridSkeleton(6);

    try {
      const { games } = await fetchGames(state.filter, state.league, { force });
      const enriched = games.map(g => enrichGame(g)).filter(Boolean);
      await applyEspnStatus(enriched);
      allGames = dedup(enriched);
      lastUpdated = Date.now();
      updateStatusLine();
      renderGames();
    } catch (err) {
      console.error('Failed to load games:', err);
      if (isFirstLoad) GameGrid(gridMount, []);
    } finally {
      state.loading = false;
      isFirstLoad = false;
    }
  }

  // Search
  let searchTimer = null;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = searchInput.value.trim();
      renderGames();
    }, 200);
  });
  cleanups.push(() => clearTimeout(searchTimer));

  // Favorite toggle via event delegation
  cleanups.push(delegate(gridMount, 'click', '[data-fav]', (e, target) => {
    e.preventDefault();
    e.stopPropagation();
    const slug = target.dataset.fav;
    const favs = [...state.favorites];
    const idx = favs.indexOf(slug);
    if (idx >= 0) {
      favs.splice(idx, 1);
      showToast('Removed from favorites');
    } else {
      favs.push(slug);
      showToast('Added to favorites');
    }
    state.favorites = favs;
    renderGames();
  }));

  loadGames();

  cleanups.push(on('games:refresh', () => loadGames(true)));

  const interval = setInterval(() => loadGames(), 60_000);
  cleanups.push(() => clearInterval(interval));

  return () => cleanups.forEach(fn => fn());
}
