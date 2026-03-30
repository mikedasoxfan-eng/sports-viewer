/**
 * GET /api/teams — ESPN team data with logos
 */

import { Router } from 'express';
import { createCache } from '../middleware/cache.js';
import { fetchJson } from '../services/streamed.js';
import { ESPN_TEAMS, parseEspnTeams } from '../services/espn.js';

export const teamsRouter = Router();
const teamsCache = createCache(24 * 60 * 60 * 1000); // 24 hours

teamsRouter.get('/', async (req, res) => {
  const league = req.query.league || 'nfl';
  const force = req.query.force === '1';

  if (!force) {
    const cached = teamsCache.get(league);
    if (cached && !cached.stale) {
      return res.json({ teams: cached.data, meta: { fromCache: true } });
    }
  }

  const endpoint = ESPN_TEAMS[league];
  if (!endpoint) {
    return res.status(400).json({ teams: [], error: 'Unsupported league' });
  }

  try {
    const payload = await fetchJson(endpoint);
    const teams = parseEspnTeams(payload);
    teamsCache.set(league, teams);
    res.json({ teams, meta: { league, count: teams.length } });
  } catch (err) {
    console.error('Teams route error:', err);
    const stale = teamsCache.get(league);
    if (stale) {
      return res.json({ teams: stale.data, meta: { stale: true, warning: 'Returning stale data' } });
    }
    res.status(500).json({ teams: [], error: err.message });
  }
});
