import { isAuthenticated } from '../server/middleware/auth.js';
import { createCache } from '../server/middleware/cache.js';
import { fetchJson } from '../server/services/streamed.js';
import { ESPN_TEAMS, parseEspnTeams } from '../server/services/espn.js';

const teamsCache = createCache(24 * 60 * 60 * 1000);

export default async function handler(req, res) {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'unauthorized' });

  const league = req.query.league || 'nfl';
  const force = req.query.force === '1';

  if (!force) {
    const cached = teamsCache.get(league);
    if (cached && !cached.stale) {
      return res.json({ teams: cached.data, meta: { fromCache: true } });
    }
  }

  const endpoint = ESPN_TEAMS[league];
  if (!endpoint) return res.status(400).json({ teams: [], error: 'Unsupported league' });

  try {
    const payload = await fetchJson(endpoint);
    const teams = parseEspnTeams(payload);
    teamsCache.set(league, teams);
    res.json({ teams, meta: { league, count: teams.length } });
  } catch (err) {
    const stale = teamsCache.get(league);
    if (stale) return res.json({ teams: stale.data, meta: { stale: true } });
    res.status(500).json({ teams: [], error: err.message });
  }
}
