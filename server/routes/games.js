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
  sortGames, filterGames, findGameBySlug
} from '../services/game-builder.js';

export const gamesRouter = Router();

const CACHE_TTL = parseInt(process.env.CACHE_TTL_SEC || '45', 10) * 1000;
const CACHE_STALE = parseInt(process.env.CACHE_STALE_SEC || '600', 10) * 1000;
const gamesCache = createCache(CACHE_TTL, CACHE_STALE);

async function getGames(league, filter, force) {
  const cacheKey = `${league}:${filter}`;
  if (!force) {
    const cached = gamesCache.get(cacheKey);
    if (cached && !cached.stale) {
      return { games: cached.data.games, meta: { ...cached.data.meta, fromCache: true, cacheAgeSec: Math.round(cached.age / 1000) } };
    }
    var staleFallback = cached?.data || null;
  }

  try {
    const [live] = await fetchMatches('matches/live');
    const [all] = await fetchMatches('matches/all');
    const raw = league === 'all' ? buildGamesForAll({ live, all }) : buildGamesForLeague({ live, all }, league);
    const sorted = sortGames(raw, league);
    const filtered = filterGames(sorted, filter);
    const result = { games: filtered, meta: { sourceType: 'api', league, filter, count: filtered.length } };
    gamesCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('Streamed fetch failed:', err.message);
    try {
      if (league !== 'all') {
        const events = await fetchScoreboard(league);
        const games = buildGamesFromScoreboard(events, league);
        const sorted = sortGames(games, league);
        const filtered = filterGames(sorted, filter);
        const result = { games: filtered, meta: { sourceType: 'espn_scoreboard', league, filter, count: filtered.length } };
        gamesCache.set(cacheKey, result);
        return result;
      }
    } catch {}
    if (staleFallback) return { games: staleFallback.games, meta: { ...staleFallback.meta, stale: true } };
    return { games: [], meta: { error: err.message, league, filter } };
  }
}

gamesRouter.get('/', async (req, res) => {
  try {
    res.json(await getGames(req.query.league || 'all', req.query.filter || 'all', req.query.force === '1'));
  } catch (err) {
    res.status(500).json({ games: [], meta: { error: err.message } });
  }
});

gamesRouter.get('/:slug', async (req, res) => {
  try {
    const { games } = await getGames(req.query.league || 'all', 'all', false);
    const game = findGameBySlug(games, req.params.slug);
    if (!game) return res.status(404).json({ game: null, error: 'Game not found' });
    res.json({ game });
  } catch (err) {
    res.status(500).json({ game: null, error: err.message });
  }
});
