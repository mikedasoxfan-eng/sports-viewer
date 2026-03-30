/**
 * SportSRC API client.
 * Primary source for match listings and embed URLs.
 * https://api.sportsrc.org/
 */

const API_BASE = 'https://api.sportsrc.org';

const CATEGORY_MAP = {
  nfl: 'american-football',
  nba: 'basketball',
  mlb: 'baseball',
  nhl: 'hockey'
};

const LEAGUE_FROM_CATEGORY = {
  'american-football': 'nfl',
  'basketball': 'nba',
  'baseball': 'mlb',
  'hockey': 'nhl'
};

async function apiFetch(params) {
  const url = new URL(API_BASE);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) throw new Error(`SportSRC ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'SportSRC error');
  return data.data;
}

/**
 * Fetch matches for a league (or all leagues).
 */
export async function fetchSportsrcMatches(league) {
  if (league && league !== 'all') {
    const cat = CATEGORY_MAP[league];
    if (!cat) return [];
    const matches = await apiFetch({ data: 'matches', category: cat });
    return (matches || []).map(m => normalizeMatch(m, league));
  }

  // Fetch all leagues in parallel
  const results = await Promise.allSettled(
    Object.entries(CATEGORY_MAP).map(async ([lg, cat]) => {
      const matches = await apiFetch({ data: 'matches', category: cat });
      return (matches || []).map(m => normalizeMatch(m, lg));
    })
  );

  return results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);
}

/**
 * Fetch match detail with embed URLs.
 */
export async function fetchSportsrcDetail(matchId, league) {
  const cat = CATEGORY_MAP[league] || league;
  if (!cat) return null;
  const detail = await apiFetch({ data: 'detail', category: cat, id: matchId });
  if (!detail) return null;

  return {
    ...normalizeMatch(detail, league),
    sources: (detail.sources || []).map(s => ({
      source: s.source || 'admin',
      id: s.id || matchId,
      streamNo: s.streamNo || 1,
      embedUrl: s.embedUrl || null,
      hd: s.hd ?? true,
      viewers: s.viewers || 0,
      language: s.language || 'English'
    }))
  };
}

function normalizeMatch(m, league) {
  const now = Date.now();
  const ts = m.date || 0;
  const isLive = ts <= now && (now - ts) < 6 * 60 * 60 * 1000; // within 6 hours of start
  const isUpcoming = ts > now;
  const isEnded = ts <= now && (now - ts) >= 6 * 60 * 60 * 1000;

  const home = m.teams?.home || {};
  const away = m.teams?.away || {};

  return {
    id: `src_${m.id || ''}`,
    matchId: m.id || '',
    slug: m.id || '',
    title: m.title || `${away.name || '?'} vs ${home.name || '?'}`,
    poster: m.poster || null,
    category: CATEGORY_MAP[league] || league,
    gameTime: ts ? new Date(ts).toISOString() : null,
    timestamp: ts,
    isLive,
    isUpcoming,
    isEnded,
    isPopular: Boolean(m.popular),
    sources: [],
    currentSource: 'admin',
    source: 'sportsrc',
    league,
    teams: {
      home: { name: home.name || '', logo: home.badge || null },
      away: { name: away.name || '', logo: away.badge || null }
    }
  };
}
