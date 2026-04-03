/**
 * Game normalization, dedup, filtering, sorting.
 * Ported from lib/api-helpers.js.
 */

import { LEAGUE_CONFIGS, PRIORITY_LEAGUES } from '../data/league-configs.js';
import { buildStreamedTeam, buildStreamedPoster } from './streamed.js';
import { normalizeScoreboardTeam } from './espn.js';

const LIVE_MAX_AGE_SEC = parseInt(process.env.LIVE_MAX_AGE_SEC || '14400', 10);
const ENDED_GRACE_SEC = parseInt(process.env.ENDED_GRACE_SEC || '21600', 10);

const sanitizeSlug = v => v ? String(v).toLowerCase().replace(/[^a-z0-9\-_]/g, '') : '';
const normalizeCategory = v => v ? String(v).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '';
const normalizeTeamName = v => v ? String(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() : '';

// All 124 pro team names, built once at startup
const PRO_TEAMS = new Set([
  // NFL
  'buffalo bills','miami dolphins','new england patriots','new york jets',
  'baltimore ravens','cincinnati bengals','cleveland browns','pittsburgh steelers',
  'houston texans','indianapolis colts','jacksonville jaguars','tennessee titans',
  'denver broncos','kansas city chiefs','las vegas raiders','los angeles chargers',
  'dallas cowboys','new york giants','philadelphia eagles','washington commanders',
  'chicago bears','detroit lions','green bay packers','minnesota vikings',
  'atlanta falcons','carolina panthers','new orleans saints','tampa bay buccaneers',
  'arizona cardinals','los angeles rams','san francisco 49ers','seattle seahawks',
  // NBA
  'atlanta hawks','boston celtics','brooklyn nets','charlotte hornets',
  'chicago bulls','cleveland cavaliers','dallas mavericks','denver nuggets',
  'detroit pistons','golden state warriors','houston rockets','indiana pacers',
  'los angeles clippers','los angeles lakers','memphis grizzlies','miami heat',
  'milwaukee bucks','minnesota timberwolves','new orleans pelicans','new york knicks',
  'oklahoma city thunder','orlando magic','philadelphia 76ers','phoenix suns',
  'portland trail blazers','sacramento kings','san antonio spurs',
  'toronto raptors','utah jazz','washington wizards',
  // MLB
  'baltimore orioles','boston red sox','new york yankees','tampa bay rays',
  'toronto blue jays','chicago white sox','cleveland guardians','detroit tigers',
  'kansas city royals','minnesota twins','houston astros','los angeles angels',
  'oakland athletics','athletics','seattle mariners','texas rangers',
  'atlanta braves','miami marlins','new york mets','philadelphia phillies',
  'washington nationals','chicago cubs','cincinnati reds','milwaukee brewers',
  'pittsburgh pirates','st. louis cardinals','arizona diamondbacks',
  'colorado rockies','los angeles dodgers','san diego padres','san francisco giants',
  // NHL
  'anaheim ducks','boston bruins','buffalo sabres','calgary flames',
  'carolina hurricanes','chicago blackhawks','colorado avalanche','columbus blue jackets',
  'dallas stars','detroit red wings','edmonton oilers','florida panthers',
  'los angeles kings','minnesota wild','montreal canadiens','nashville predators',
  'new jersey devils','new york islanders','new york rangers','ottawa senators',
  'philadelphia flyers','pittsburgh penguins','san jose sharks','seattle kraken',
  'st. louis blues','tampa bay lightning','toronto maple leafs',
  'vancouver canucks','vegas golden knights','washington capitals','winnipeg jets',
]);

function isProTeam(name) {
  if (!name) return false;
  return PRO_TEAMS.has(name.toLowerCase().trim());
}

function isLeagueMatch(match, league) {
  const config = LEAGUE_CONFIGS[league];
  if (!config) return false;
  const cat = (match.category || '').toLowerCase();
  // Must be in a matching category
  if (cat && !config.categories.some(c => cat.includes(c))) return false;
  // At least one team must be a known pro team
  const home = match.teams?.home?.name;
  const away = match.teams?.away?.name;
  if (home || away) {
    return isProTeam(home) || isProTeam(away);
  }
  // No team objects — try to find two pro teams in the title
  const title = (match.title || '').toLowerCase();
  const matched = [...PRO_TEAMS].filter(t => title.includes(t));
  return matched.length >= 2;
}

function identifyMatchLeague(match) {
  for (const league of PRIORITY_LEAGUES) {
    if (isLeagueMatch(match, league)) return league;
  }
  for (const league of Object.keys(LEAGUE_CONFIGS)) {
    if (isLeagueMatch(match, league)) return league;
  }
  return null;
}

function parseMatch(match, { isLive, league }) {
  const matchId = match.id || '';
  const title = match.title || '';
  const category = (match.category || '').toLowerCase();
  const timestamp = match.date || Date.now();
  const now = Date.now();
  const isLiveNow = Boolean(isLive) && (now - timestamp) <= LIVE_MAX_AGE_SEC * 1000;
  const isUpcoming = !isLiveNow && timestamp > now;
  const isEnded = !isLiveNow && timestamp <= (now - ENDED_GRACE_SEC * 1000);

  const sources = (match.sources || [])
    .map(s => ({ source: s.source, id: s.id }))
    .filter(s => s.source && s.id);
  if (!sources.length && matchId) sources.push({ source: 'admin', id: matchId });
  const best = sources[0] || { source: 'admin', id: matchId };

  const teams = match.teams || {};
  const homeTeam = buildStreamedTeam(teams.home);
  const awayTeam = buildStreamedTeam(teams.away);
  const poster = buildStreamedPoster(match.poster);

  return {
    id: matchId ? `api_${matchId}` : `api_${sanitizeSlug(title) || Date.now()}`,
    matchId,
    slug: best.id || matchId,
    title,
    poster,
    category,
    sport: normalizeCategory(category),
    gameTime: new Date(timestamp).toISOString(),
    timestamp,
    isLive: isLiveNow,
    isUpcoming,
    isEnded,
    isPopular: Boolean(match.popular),
    sources,
    currentSource: best.source || 'admin',
    source: 'api',
    league,
    teams: homeTeam || awayTeam ? { home: homeTeam, away: awayTeam } : null
  };
}

function extractTeamsFromTitle(title) {
  if (!title) return [];
  const parts = String(title).split(/\s+vs\.?\s+|\s+@\s+/i);
  return parts.length >= 2 ? [parts[0], parts[1]] : [];
}

function buildGameKey(game) {
  if (!game) return '';
  const date = game.timestamp ? new Date(game.timestamp).toISOString().slice(0, 10) : 'unknown';
  let teams = [game.teams?.away?.name, game.teams?.home?.name].filter(Boolean);
  if (teams.length < 2) teams = extractTeamsFromTitle(game.title || '');
  const normalized = teams.map(normalizeTeamName).filter(Boolean).sort();
  if (normalized.length < 2) {
    const fallback = normalizeTeamName(game.title || '');
    return fallback ? `${game.league || 'unknown'}:${date}:${fallback}` : '';
  }
  return `${game.league || 'unknown'}:${date}:${normalized.join('-')}`;
}

export function dedupeGames(games) {
  const map = new Map();
  (games || []).forEach(game => {
    const key = buildGameKey(game);
    if (!key) { map.set(Symbol('game'), game); return; }
    const existing = map.get(key);
    if (!existing) { map.set(key, game); return; }
    if (game.isLive && !existing.isLive) { map.set(key, game); return; }
    if ((game.sources || []).length > (existing.sources || []).length) map.set(key, game);
  });
  return Array.from(map.values());
}

export function buildGamesForLeague(snapshot, league) {
  const liveMatches = (snapshot.live || []).filter(m => isLeagueMatch(m, league));
  const allMatches = (snapshot.all || []).filter(m => isLeagueMatch(m, league));
  const liveIds = new Set(liveMatches.map(m => m.id).filter(Boolean));
  const liveGames = liveMatches.map(m => parseMatch(m, { isLive: true, league }));
  const upcoming = allMatches
    .filter(m => !m.id || !liveIds.has(m.id))
    .map(m => parseMatch(m, { isLive: false, league }));
  return dedupeGames([...liveGames, ...upcoming]);
}

export function buildGamesForAll(snapshot) {
  const liveMatches = snapshot.live || [];
  const allMatches = snapshot.all || [];
  const liveIds = new Set(liveMatches.map(m => m.id).filter(Boolean));
  const liveGames = [];
  liveMatches.forEach(m => {
    const league = identifyMatchLeague(m);
    if (league) liveGames.push(parseMatch(m, { isLive: true, league }));
  });
  const upcoming = [];
  allMatches.forEach(m => {
    if (m.id && liveIds.has(m.id)) return;
    const league = identifyMatchLeague(m);
    if (league) upcoming.push(parseMatch(m, { isLive: false, league }));
  });
  return dedupeGames([...liveGames, ...upcoming]);
}

export function buildGamesFromScoreboard(events, league) {
  const now = Date.now();
  const games = (events || []).map(event => {
    const comp = event?.competitions?.[0] || {};
    const competitors = comp?.competitors || [];
    const home = competitors.find(c => c.homeAway === 'home') || competitors[0];
    const away = competitors.find(c => c.homeAway === 'away') || competitors[1];
    const homeTeam = normalizeScoreboardTeam(home);
    const awayTeam = normalizeScoreboardTeam(away);
    if (!homeTeam && !awayTeam) return null;

    const status = comp?.status?.type || event?.status?.type || {};
    const state = (status.state || '').toLowerCase();
    const isLive = state === 'in' || state === 'live';
    const isEnded = Boolean(status.completed) || state === 'post';
    const startDate = comp.startDate || event.date || null;
    const ts = startDate ? new Date(startDate).getTime() : null;
    const safeTs = Number.isNaN(ts) ? null : ts;

    const title = event.name || event.shortName || (
      awayTeam?.name && homeTeam?.name ? `${awayTeam.name} vs ${homeTeam.name}` : 'Matchup'
    );
    const id = event.id || comp.id || null;

    return {
      id: id ? `espn_${id}` : `espn_${sanitizeSlug(title) || Date.now()}`,
      matchId: id,
      slug: id ? `espn-${sanitizeSlug(id)}` : `espn-${sanitizeSlug(title) || Date.now()}`,
      title,
      poster: null,
      category: league,
      sport: normalizeCategory(league),
      gameTime: safeTs ? new Date(safeTs).toISOString() : null,
      timestamp: safeTs,
      isLive,
      isUpcoming: !isLive && !isEnded && safeTs && safeTs > now,
      isEnded,
      isPopular: Boolean(comp?.featured || event?.featured),
      sources: [],
      currentSource: null,
      source: 'scoreboard',
      streamAvailable: false,
      league,
      teams: homeTeam || awayTeam ? { home: homeTeam, away: awayTeam } : null,
      awayScore: awayTeam?.score ?? null,
      homeScore: homeTeam?.score ?? null
    };
  }).filter(Boolean);
  return dedupeGames(games);
}

export function sortGames(games, league) {
  const priority = PRIORITY_LEAGUES.reduce((acc, k, i) => { acc[k] = i; return acc; }, {});
  return games.sort((a, b) => {
    const ta = a.timestamp || 0, tb = b.timestamp || 0;
    if (ta !== tb) return ta - tb;
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
    if (league === 'all') {
      const pa = priority[a.league] ?? PRIORITY_LEAGUES.length;
      const pb = priority[b.league] ?? PRIORITY_LEAGUES.length;
      if (pa !== pb) return pa - pb;
    }
    return 0;
  });
}

export function filterGames(games, filterValue) {
  if (filterValue === 'live') return games.filter(g => g.isLive);
  if (filterValue === 'upcoming') return games.filter(g => g.isUpcoming && !g.isLive);
  return games;
}

export function findGameBySlug(games, slug) {
  if (!slug) return null;
  const norm = sanitizeSlug(slug);
  for (const game of games) {
    if ([game.slug, game.matchId].some(v => sanitizeSlug(v) === norm)) return game;
    for (const src of game.sources || []) {
      if (sanitizeSlug(src.id) === norm) return { ...game, slug: src.id, currentSource: src.source };
    }
  }
  return null;
}
