/**
 * Games list page — FilterBar + GameGrid.
 */

import { state } from '../lib/state.js';
import { fetchGames } from '../lib/api.js';
import { on } from '../lib/events.js';
import { FilterBar } from '../components/FilterBar.js';
import { GameGrid } from '../components/GameGrid.js';
import { GamesGridSkeleton } from '../components/Loader.js';
import { enrichGame, sortEnrichedGames, applyEspnStatus } from '../lib/enrich.js';

/** Dedup games by normalized team names + league */
function dedup(games) {
  const seen = new Map();
  for (const g of games) {
    const a = (g.awayTeam?.name || '').toLowerCase().trim();
    const h = (g.homeTeam?.name || '').toLowerCase().trim();
    if (!a && !h) continue;
    const key = `${g.league}:${[a, h].sort().join('|')}`;
    const existing = seen.get(key);
    if (!existing) { seen.set(key, g); continue; }
    // Prefer live, then more sources
    if (g.isLive && !existing.isLive) seen.set(key, g);
    else if ((g.sources?.length || 0) > (existing.sources?.length || 0)) seen.set(key, g);
  }
  return [...seen.values()];
}

export function GamesPage(container) {
  const cleanups = [];
  let isFirstLoad = true;

  container.innerHTML = `
    <div class="pt-6">
      <div class="mb-6">
        <h1 class="font-mono text-2xl sm:text-3xl font-bold tracking-tighter text-ink mb-1">Games</h1>
        <p class="font-sans text-sm text-ink-secondary">Live and upcoming matchups</p>
      </div>
      <div id="filter-bar"></div>
      <div id="games-grid"></div>
    </div>
  `;

  const filterMount = container.querySelector('#filter-bar');
  const gridMount = container.querySelector('#games-grid');

  const filterCleanup = FilterBar(filterMount);
  cleanups.push(filterCleanup);

  gridMount.innerHTML = GamesGridSkeleton(6);

  async function loadGames(force = false) {
    state.loading = true;

    if (isFirstLoad) {
      gridMount.innerHTML = GamesGridSkeleton(6);
    }

    try {
      const { games } = await fetchGames(state.filter, state.league, { force });

      const enriched = games.map(g => enrichGame(g)).filter(Boolean);
      await applyEspnStatus(enriched);
      const unique = dedup(enriched);
      const sorted = sortEnrichedGames(unique);
      state.games = sorted;
      GameGrid(gridMount, sorted);
    } catch (err) {
      console.error('Failed to load games:', err);
      if (isFirstLoad) GameGrid(gridMount, []);
    } finally {
      state.loading = false;
      isFirstLoad = false;
    }
  }

  loadGames();

  cleanups.push(on('games:refresh', () => loadGames(true)));

  const interval = setInterval(() => loadGames(), 60_000);
  cleanups.push(() => clearInterval(interval));

  return () => cleanups.forEach(fn => fn());
}
