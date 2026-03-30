import { isAuthenticated } from '../server/middleware/auth.js';
import { createCache } from '../server/middleware/cache.js';
import { fetchMatches } from '../server/services/streamed.js';
import { fetchScoreboard } from '../server/services/espn.js';
import {
  buildGamesForAll, buildGamesForLeague, buildGamesFromScoreboard,
  sortGames, filterGames
} from '../server/services/game-builder.js';

const CACHE_TTL = parseInt(process.env.CACHE_TTL_SEC || '45', 10) * 1000;
const CACHE_STALE = parseInt(process.env.CACHE_STALE_SEC || '600', 10) * 1000;
const gamesCache = createCache(CACHE_TTL, CACHE_STALE);

async function fetchSnapshot() {
  const [live] = await fetchMatches('matches/live');
  const [all] = await fetchMatches('matches/all');
  return { live, all };
}

export default async function handler(req, res) {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'unauthorized' });

  const league = req.query.league || 'all';
  const filter = req.query.filter || 'all';
  const force = req.query.force === '1';
  const cacheKey = `${league}:${filter}`;

  if (!force) {
    const cached = gamesCache.get(cacheKey);
    if (cached && !cached.stale) {
      return res.json({ games: cached.data.games, meta: { ...cached.data.meta, fromCache: true, cacheAgeSec: Math.round(cached.age / 1000) } });
    }
  }

  try {
    const snapshot = await fetchSnapshot();
    const raw = league === 'all' ? buildGamesForAll(snapshot) : buildGamesForLeague(snapshot, league);
    const sorted = sortGames(raw, league);
    const filtered = filterGames(sorted, filter);
    const result = { games: filtered, meta: { sourceType: 'api', league, filter, count: filtered.length } };
    gamesCache.set(cacheKey, result);
    return res.json(result);
  } catch (err) {
    try {
      if (league !== 'all') {
        const events = await fetchScoreboard(league);
        const games = buildGamesFromScoreboard(events, league);
        const sorted = sortGames(games, league);
        const filtered = filterGames(sorted, filter);
        const result = { games: filtered, meta: { sourceType: 'espn_scoreboard', league, filter, count: filtered.length, warning: 'ESPN fallback' } };
        gamesCache.set(cacheKey, result);
        return res.json(result);
      }
    } catch {}
    return res.status(500).json({ games: [], meta: { error: err.message } });
  }
}
