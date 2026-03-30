/**
 * GET /api/games — game list
 * GET /api/games/:slug — single game + embed URLs
 *
 * Primary: SportSRC API (cleaner embeds)
 * Fallback: streamed.pk → ESPN scoreboard
 */

import { Router } from 'express';
import { createCache } from '../middleware/cache.js';
import { fetchSportsrcMatches, fetchSportsrcDetail } from '../services/sportsrc.js';
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
const detailCache = createCache(5 * 60 * 1000); // 5 min for detail

async function getGamesForRequest(league, filter, force) {
  const cacheKey = `${league}:${filter}`;

  if (!force) {
    const cached = gamesCache.get(cacheKey);
    if (cached && !cached.stale) {
      return { games: cached.data.games, meta: { ...cached.data.meta, fromCache: true, cacheAgeSec: Math.round(cached.age / 1000) } };
    }
    var staleFallback = cached?.data || null;
  }

  // Try SportSRC first (cleaner embeds, less ads)
  try {
    const raw = await fetchSportsrcMatches(league);
    const sorted = sortGames(raw, league);
    const filtered = filterGames(sorted, filter);
    const result = { games: filtered, meta: { sourceType: 'sportsrc', league, filter, count: filtered.length } };
    gamesCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('SportSRC failed:', err.message);
  }

  // Fallback: streamed.pk
  try {
    const [live] = await fetchMatches('matches/live');
    const [all] = await fetchMatches('matches/all');
    const snapshot = { live, all };
    const raw = league === 'all' ? buildGamesForAll(snapshot) : buildGamesForLeague(snapshot, league);
    const sorted = sortGames(raw, league);
    const filtered = filterGames(sorted, filter);
    const result = { games: filtered, meta: { sourceType: 'streamed', league, filter, count: filtered.length } };
    gamesCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('Streamed.pk failed:', err.message);
  }

  // Fallback: ESPN scoreboard
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
  } catch (err) {
    console.warn('ESPN fallback failed:', err.message);
  }

  if (staleFallback) {
    return { games: staleFallback.games, meta: { ...staleFallback.meta, stale: true } };
  }
  return { games: [], meta: { error: 'All sources failed', league, filter } };
}

gamesRouter.get('/', async (req, res) => {
  const league = req.query.league || 'all';
  const filter = req.query.filter || 'all';
  const force = req.query.force === '1';

  try {
    const result = await getGamesForRequest(league, filter, force);
    res.json(result);
  } catch (err) {
    res.status(500).json({ games: [], meta: { error: err.message } });
  }
});

gamesRouter.get('/:slug', async (req, res) => {
  const slug = req.params.slug;
  const league = req.query.league || 'all';

  // Check detail cache first
  const detailKey = `${league}:${slug}`;
  const cachedDetail = detailCache.get(detailKey);
  if (cachedDetail && !cachedDetail.stale) {
    return res.json({ game: cachedDetail.data });
  }

  // Try SportSRC detail (gives us embed URLs directly)
  try {
    const detail = await fetchSportsrcDetail(slug, league);
    if (detail && detail.sources?.length) {
      detailCache.set(detailKey, detail);
      return res.json({ game: detail });
    }
  } catch (err) {
    console.warn('SportSRC detail failed:', err.message);
  }

  // Fallback: find in games list
  try {
    const { games } = await getGamesForRequest(league, 'all', false);
    const game = findGameBySlug(games, slug);
    if (game) {
      detailCache.set(detailKey, game);
      return res.json({ game });
    }
  } catch {}

  res.status(404).json({ game: null, error: 'Game not found' });
});
