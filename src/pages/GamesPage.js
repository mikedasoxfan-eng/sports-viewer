/**
 * Games list page — FilterBar + GameGrid.
 */

import { state } from '../lib/state.js';
import { fetchGames, attachScores } from '../lib/api.js';
import { on } from '../lib/events.js';
import { FilterBar } from '../components/FilterBar.js';
import { GameGrid } from '../components/GameGrid.js';
import { GamesGridSkeleton } from '../components/Loader.js';
import { enrichGame, sortEnrichedGames } from '../lib/enrich.js';

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

  // Only show skeleton on first load
  gridMount.innerHTML = GamesGridSkeleton(6);

  async function loadGames(force = false) {
    state.loading = true;

    // Show skeleton only on first load, not on refreshes
    if (isFirstLoad) {
      gridMount.innerHTML = GamesGridSkeleton(6);
    }

    try {
      const { games } = await fetchGames(state.filter, state.league, { force });
      await attachScores(games, state.league);

      const enriched = sortEnrichedGames(
        games.map(g => enrichGame(g)).filter(Boolean)
      );
      state.games = enriched;
      GameGrid(gridMount, enriched);
    } catch (err) {
      console.error('Failed to load games:', err);
      if (isFirstLoad) {
        GameGrid(gridMount, []);
      }
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
