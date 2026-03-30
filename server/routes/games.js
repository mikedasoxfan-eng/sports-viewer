/**
 * GET /api/games — game list
 * GET /api/games/:slug — single game
 */

import { Router } from 'express';
import { createCache } from '../middleware/cache.js';
import { fetchMatches } from '../services/streamed.js';
import { fetchScoreboard } from '../services/espn.js';
import {
  buildGamesForAll, buildGamesForLeague, buildGamesFromScoreboard,
  sortGames, filterGames, findGameBySlug, dedupeGames
} from '../services/game-builder.js';

export const gamesRouter = Router();

const CACHE_TTL = parseInt(process.env.CACHE_TTL_SEC || '45', 10) * 1000;
const CACHE_STALE = parseInt(process.env.CACHE_STALE_SEC || '600', 10) * 1000;
const gamesCache = createCache(CACHE_TTL, CACHE_STALE);

async function fetchSnapshot() {
  const [live] = await fetchMatches('matches/live');
  const [all] = await fetchMatches('matches/all');
  return { live, all };
}

async function getGamesForRequest(league, filter, force) {
  const cacheKey = `${league}:${filter}`;

  if (!force) {
    const cached = gamesCache.get(cacheKey);
    if (cached && !cached.stale) {
      return { games: cached.data.games, meta: { ...cached.data.meta, fromCache: true, cacheAgeSec: Math.round(cached.age / 1000) } };
    }
    // Stale fallback holder
    var staleFallback = cached?.data || null;
  }

  try {
    const snapshot = await fetchSnapshot();
    const raw = league === 'all'
      ? buildGamesForAll(snapshot)
      : buildGamesForLeague(snapshot, league);
    const sorted = sortGames(raw, league);
    const filtered = filterGames(sorted, filter);
    const result = { games: filtered, meta: { sourceType: 'api', league, filter, count: filtered.length } };
    gamesCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error('Streamed fetch failed:', err.message);

    // Try ESPN scoreboard fallback
    try {
      if (league !== 'all') {
        const events = await fetchScoreboard(league);
        const games = buildGamesFromScoreboard(events, league);
        const sorted = sortGames(games, league);
        const filtered = filterGames(sorted, filter);
        const result = { games: filtered, meta: { sourceType: 'espn_scoreboard', league, filter, count: filtered.length, warning: 'Using ESPN fallback' } };
        gamesCache.set(cacheKey, result);
        return result;
      }
    } catch (espnErr) {
      console.error('ESPN fallback failed:', espnErr.message);
    }

    // Stale data as last resort
    if (staleFallback) {
      return { games: staleFallback.games, meta: { ...staleFallback.meta, stale: true, warning: 'Returning stale data' } };
    }

    return { games: [], meta: { error: err.message, league, filter } };
  }
}

gamesRouter.get('/', async (req, res) => {
  const league = req.query.league || 'all';
  const filter = req.query.filter || 'all';
  const force = req.query.force === '1';

  try {
    const result = await getGamesForRequest(league, filter, force);
    res.json(result);
  } catch (err) {
    console.error('Games route error:', err);
    res.status(500).json({ games: [], meta: { error: err.message } });
  }
});

gamesRouter.get('/:slug', async (req, res) => {
  const slug = req.params.slug;
  const league = req.query.league || 'all';

  try {
    const { games } = await getGamesForRequest(league, 'all', false);
    const game = findGameBySlug(games, slug);
    if (!game) {
      return res.status(404).json({ game: null, error: 'Game not found' });
    }
    res.json({ game });
  } catch (err) {
    console.error('Game slug route error:', err);
    res.status(500).json({ game: null, error: err.message });
  }
});
