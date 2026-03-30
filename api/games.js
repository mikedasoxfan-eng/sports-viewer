import { isAuthenticated } from '../server/middleware/auth.js';
import { createCache } from '../server/middleware/cache.js';
import { fetchSportsrcMatches, fetchSportsrcDetail } from '../server/services/sportsrc.js';
import { fetchMatches } from '../server/services/streamed.js';
import { fetchScoreboard } from '../server/services/espn.js';
import {
  buildGamesForAll, buildGamesForLeague, buildGamesFromScoreboard,
  sortGames, filterGames
} from '../server/services/game-builder.js';

const CACHE_TTL = parseInt(process.env.CACHE_TTL_SEC || '45', 10) * 1000;
const CACHE_STALE = parseInt(process.env.CACHE_STALE_SEC || '600', 10) * 1000;
const gamesCache = createCache(CACHE_TTL, CACHE_STALE);

export default async function handler(req, res) {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'unauthorized' });

  const league = req.query.league || 'all';
  const filter = req.query.filter || 'all';
  const force = req.query.force === '1';
  const cacheKey = `${league}:${filter}`;

  if (!force) {
    const cached = gamesCache.get(cacheKey);
    if (cached && !cached.stale) {
      return res.json({ games: cached.data.games, meta: { ...cached.data.meta, fromCache: true } });
    }
  }

  // Try SportSRC first
  try {
    const raw = await fetchSportsrcMatches(league);
    const sorted = sortGames(raw, league);
    const filtered = filterGames(sorted, filter);
    const result = { games: filtered, meta: { sourceType: 'sportsrc', league, filter, count: filtered.length } };
    gamesCache.set(cacheKey, result);
    return res.json(result);
  } catch {}

  // Fallback: streamed.pk
  try {
    const [live] = await fetchMatches('matches/live');
    const [all] = await fetchMatches('matches/all');
    const raw = league === 'all' ? buildGamesForAll({ live, all }) : buildGamesForLeague({ live, all }, league);
    const sorted = sortGames(raw, league);
    const filtered = filterGames(sorted, filter);
    const result = { games: filtered, meta: { sourceType: 'streamed', league, filter, count: filtered.length } };
    gamesCache.set(cacheKey, result);
    return res.json(result);
  } catch {}

  // Fallback: ESPN
  try {
    if (league !== 'all') {
      const events = await fetchScoreboard(league);
      const games = buildGamesFromScoreboard(events, league);
      const sorted = sortGames(games, league);
      const filtered = filterGames(sorted, filter);
      return res.json({ games: filtered, meta: { sourceType: 'espn_scoreboard', league, filter, count: filtered.length } });
    }
  } catch {}

  return res.json({ games: [], meta: { error: 'All sources failed' } });
}
