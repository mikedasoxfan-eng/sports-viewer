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

// Only show major US professional league teams
// Matches containing these keywords are filtered OUT
const EXCLUDE_KEYWORDS = [
  // Minor/college leagues
  'ncaa', 'college', 'university', 'g league', 'gleague', 'g-league',
  'wnba', 'cfl', 'xfl', 'ufl', 'usfl', 'arena',
  'minor league', 'triple-a', 'double-a', 'single-a',
  'ahl', 'echl', 'khl', 'shl', 'liiga',
  // International
  'euroleague', 'eurocup', 'fiba', 'bbl', 'acb', 'lnb',
  'kbo', 'npb', 'cpbl', 'wbc',
  'iihf', 'champions hockey', 'world juniors',
  'premier league', 'la liga', 'serie a', 'bundesliga', 'ligue 1',
  'mls', 'liga mx', 'champions league', 'europa league',
  'afl', 'nrl', 'super rugby', 'top 14',
  // Other
  'olympics', 'paralympics', 'all-star', 'all star', 'pro bowl',
  'draft', 'combine', 'preseason', 'exhibition',
  'women', 'u19', 'u20', 'u21', 'u23', 'junior',
];

// Known pro team keywords per league — at least one must appear
const PRO_TEAM_KEYWORDS = {
  nba: [
    'hawks', 'celtics', 'nets', 'hornets', 'bulls', 'cavaliers', 'mavericks',
    'nuggets', 'pistons', 'warriors', 'rockets', 'pacers', 'clippers', 'lakers',
    'grizzlies', 'heat', 'bucks', 'timberwolves', 'pelicans', 'knicks', 'thunder',
    'magic', '76ers', 'sixers', 'suns', 'trail blazers', 'blazers', 'kings',
    'spurs', 'raptors', 'jazz', 'wizards',
  ],
  nfl: [
    'bills', 'dolphins', 'patriots', 'jets', 'ravens', 'bengals', 'browns',
    'steelers', 'texans', 'colts', 'jaguars', 'titans', 'broncos', 'chiefs',
    'raiders', 'chargers', 'cowboys', 'giants', 'eagles', 'commanders', 'bears',
    'lions', 'packers', 'vikings', 'falcons', 'panthers', 'saints', 'buccaneers',
    'cardinals', 'rams', '49ers', 'seahawks',
  ],
  mlb: [
    'orioles', 'red sox', 'yankees', 'rays', 'blue jays', 'white sox', 'guardians',
    'tigers', 'royals', 'twins', 'astros', 'angels', 'athletics', 'mariners',
    'rangers', 'braves', 'marlins', 'mets', 'phillies', 'nationals', 'cubs',
    'reds', 'brewers', 'pirates', 'cardinals', 'diamondbacks', 'rockies',
    'dodgers', 'padres', 'giants',
  ],
  nhl: [
    'ducks', 'bruins', 'sabres', 'flames', 'hurricanes', 'blackhawks', 'avalanche',
    'blue jackets', 'stars', 'red wings', 'oilers', 'panthers', 'kings', 'wild',
    'canadiens', 'predators', 'devils', 'islanders', 'rangers', 'senators',
    'flyers', 'penguins', 'sharks', 'kraken', 'blues', 'lightning', 'maple leafs',
    'canucks', 'golden knights', 'capitals', 'jets', 'utah hockey',
  ]
};

function isProfessionalMatch(match, league) {
  const title = (match.title || '').toLowerCase();
  const id = (match.id || '').toLowerCase();
  const text = `${title} ${id}`;

  // Exclude known non-pro keywords
  if (EXCLUDE_KEYWORDS.some(kw => text.includes(kw))) return false;

  // Must contain at least one known pro team name
  const teams = PRO_TEAM_KEYWORDS[league];
  if (teams) {
    return teams.some(t => text.includes(t));
  }

  return true;
}

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
    return (matches || []).filter(m => isProfessionalMatch(m, league)).map(m => normalizeMatch(m, league));
  }

  // Fetch all leagues in parallel
  const results = await Promise.allSettled(
    Object.entries(CATEGORY_MAP).map(async ([lg, cat]) => {
      const matches = await apiFetch({ data: 'matches', category: cat });
      return (matches || []).filter(m => isProfessionalMatch(m, lg)).map(m => normalizeMatch(m, lg));
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
