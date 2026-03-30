/**
 * Frontend API client with client-side caching.
 */

const API_BASE = '/api';

const caches = {
  games: { byKey: {}, ttl: 30_000 },
  scoreboard: { byKey: {}, ttl: 20_000 }
};

function cacheGet(store, key) {
  const entry = store.byKey[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > store.ttl) return null;
  return entry.data;
}

function cacheSet(store, key, data) {
  store.byKey[key] = { data, ts: Date.now() };
}

async function request(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

/**
 * Fetch games list.
 */
export async function fetchGames(filter = 'all', league = 'all', { force = false } = {}) {
  const key = `${league}:${filter}`;
  if (!force) {
    const cached = cacheGet(caches.games, key);
    if (cached) return cached;
  }

  try {
    const data = await request('/games', { filter, league, ...(force ? { force: '1' } : {}) });
    const games = Array.isArray(data.games) ? data.games : [];
    const result = { games, meta: data.meta || null };
    cacheSet(caches.games, key, result);
    return result;
  } catch (error) {
    console.error('fetchGames failed:', error);
    return { games: [], meta: null };
  }
}

/**
 * Fetch a single game by slug.
 */
export async function fetchGameBySlug(slug, league) {
  try {
    const data = await request(`/games/${encodeURIComponent(slug)}`, { league, includeHealth: '1' });
    return data.game || null;
  } catch (error) {
    console.error('fetchGameBySlug failed:', error);
    return null;
  }
}

/**
 * Fetch teams for a league.
 */
export async function fetchTeams(league) {
  try {
    const data = await request('/teams', { league });
    return data.teams || [];
  } catch (error) {
    console.error('fetchTeams failed:', error);
    return [];
  }
}

/**
 * ESPN scoreboard (client-side, for live scores).
 */
const ESPN_SCOREBOARD = {
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard'
};

export async function fetchScoreboard(league) {
  const key = league;
  const cached = cacheGet(caches.scoreboard, key);
  if (cached) return cached;

  const endpoint = ESPN_SCOREBOARD[league];
  if (!endpoint) return null;

  try {
    const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    cacheSet(caches.scoreboard, key, data);
    return data;
  } catch {
    return null;
  }
}

/**
 * Normalize a team name for matching.
 */
export function normalizeTeamName(value) {
  if (!value) return '';
  return value.toString().toLowerCase()
    .replace(/&/g, 'and')
    .replace(/st\./g, 'st')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a scoreboard index for fast team matching.
 */
export function buildScoreIndex(scoreboard) {
  const byAbbr = new Map();
  const byName = new Map();
  const events = scoreboard?.events || [];
  events.forEach(event => {
    const competitors = event?.competitions?.[0]?.competitors || [];
    if (competitors.length < 2) return;
    const abbrs = competitors.map(c => c?.team?.abbreviation).filter(Boolean).map(a => a.toUpperCase());
    if (abbrs.length === 2) {
      byAbbr.set([...abbrs].sort().join('|'), event);
    }
    const names = competitors.map(c => normalizeTeamName(c?.team?.displayName || c?.team?.name)).filter(Boolean);
    if (names.length === 2) {
      byName.set([...names].sort().join('|'), event);
    }
  });
  return { byAbbr, byName };
}

/**
 * Extract score from an ESPN competitor.
 */
export function extractScore(competitor) {
  if (!competitor) return null;
  const s = competitor?.score?.displayValue ?? competitor?.score?.value ?? competitor?.score ?? null;
  return s === '' ? null : s;
}

/**
 * Attach scores from ESPN scoreboard to games list.
 */
export async function attachScores(games, league) {
  if (!games?.length) return;
  const leagues = league === 'all'
    ? [...new Set(games.map(g => g.league).filter(Boolean))]
    : [league];

  await Promise.all(leagues.map(async lk => {
    const sb = await fetchScoreboard(lk);
    if (!sb) return;
    const index = buildScoreIndex(sb);
    games.forEach(game => {
      if ((game.league || 'nfl') !== lk) return;
      const away = game.awayTeam || game.teams?.away || {};
      const home = game.homeTeam || game.teams?.home || {};

      let event = null;
      if (away.abbreviation && home.abbreviation) {
        const key = [away.abbreviation.toUpperCase(), home.abbreviation.toUpperCase()].sort().join('|');
        event = index.byAbbr.get(key);
      }
      if (!event) {
        const an = normalizeTeamName(away.name || away.displayName);
        const hn = normalizeTeamName(home.name || home.displayName);
        if (an && hn) event = index.byName.get([an, hn].sort().join('|'));
      }
      if (event) {
        const comps = event?.competitions?.[0]?.competitors || [];
        const ac = comps.find(c => c?.homeAway === 'away') || comps[0];
        const hc = comps.find(c => c?.homeAway === 'home') || comps[1];
        const as = extractScore(ac);
        const hs = extractScore(hc);
        if (as != null) {
          const base = game.awayTeam || game.teams?.away || {};
          game.awayTeam = { ...base, score: as };
          if (game.teams?.away) game.teams.away.score = as;
        }
        if (hs != null) {
          const base = game.homeTeam || game.teams?.home || {};
          game.homeTeam = { ...base, score: hs };
          if (game.teams?.home) game.teams.home.score = hs;
        }
      }
    });
  }));
}

/**
 * Clear all caches.
 */
export function clearCache() {
  caches.games.byKey = {};
  caches.scoreboard.byKey = {};
}
