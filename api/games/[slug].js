import { isAuthenticated } from '../../server/middleware/auth.js';
import { createCache } from '../../server/middleware/cache.js';
import { fetchSportsrcMatches, fetchSportsrcDetail } from '../../server/services/sportsrc.js';
import { fetchMatches } from '../../server/services/streamed.js';
import {
  buildGamesForAll, buildGamesForLeague, sortGames, findGameBySlug
} from '../../server/services/game-builder.js';

const detailCache = createCache(5 * 60 * 1000);

export default async function handler(req, res) {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'unauthorized' });

  const slug = req.query.slug;
  const league = req.query.league || 'all';
  const detailKey = `${league}:${slug}`;

  const cached = detailCache.get(detailKey);
  if (cached && !cached.stale) return res.json({ game: cached.data });

  // Try SportSRC detail (gives embed URLs directly)
  try {
    const detail = await fetchSportsrcDetail(slug, league);
    if (detail?.sources?.length) {
      detailCache.set(detailKey, detail);
      return res.json({ game: detail });
    }
  } catch {}

  // Fallback: find in SportSRC list
  try {
    const games = await fetchSportsrcMatches(league);
    const game = games.find(g => g.slug === slug || g.matchId === slug);
    if (game) { detailCache.set(detailKey, game); return res.json({ game }); }
  } catch {}

  // Fallback: streamed.pk
  try {
    const [live] = await fetchMatches('matches/live');
    const [all] = await fetchMatches('matches/all');
    const raw = league === 'all' ? buildGamesForAll({ live, all }) : buildGamesForLeague({ live, all }, league);
    const games = sortGames(raw, league);
    const game = findGameBySlug(games, slug);
    if (game) { detailCache.set(detailKey, game); return res.json({ game }); }
  } catch {}

  res.status(404).json({ game: null, error: 'Game not found' });
}
