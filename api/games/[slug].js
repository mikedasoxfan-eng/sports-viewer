import { isAuthenticated } from '../../server/middleware/auth.js';
import { createCache } from '../../server/middleware/cache.js';
import { fetchMatches } from '../../server/services/streamed.js';
import {
  buildGamesForAll, buildGamesForLeague, sortGames, findGameBySlug
} from '../../server/services/game-builder.js';

const CACHE_TTL = parseInt(process.env.CACHE_TTL_SEC || '45', 10) * 1000;
const CACHE_STALE = parseInt(process.env.CACHE_STALE_SEC || '600', 10) * 1000;
const gamesCache = createCache(CACHE_TTL, CACHE_STALE);

export default async function handler(req, res) {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'unauthorized' });

  const slug = req.query.slug;
  const league = req.query.league || 'all';
  const cacheKey = `${league}:all`;

  let games;
  const cached = gamesCache.get(cacheKey);
  if (cached) {
    games = cached.data.games;
  } else {
    try {
      const [live] = await fetchMatches('matches/live');
      const [all] = await fetchMatches('matches/all');
      const snapshot = { live, all };
      const raw = league === 'all' ? buildGamesForAll(snapshot) : buildGamesForLeague(snapshot, league);
      games = sortGames(raw, league);
      gamesCache.set(cacheKey, { games, meta: { league } });
    } catch (err) {
      return res.status(500).json({ game: null, error: err.message });
    }
  }

  const game = findGameBySlug(games, slug);
  if (!game) return res.status(404).json({ game: null, error: 'Game not found' });
  res.json({ game });
}
