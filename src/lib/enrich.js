/**
 * Game enrichment — resolves teams with ESPN logos, cross-references live status, sorts.
 */

import { DEFAULT_LEAGUE, GAME_END_GRACE_HOURS, LEAGUE_CONFIGS } from '../config.js';
import { resolveTeam } from './teams.js';
import { fetchScoreboard, normalizeTeamName, buildScoreIndex, extractScore } from './api.js';

const ESPN_ABBR_FIX = {
  nba: { NOP: 'no', UTA: 'utah', NYK: 'ny', SAS: 'sa', GSW: 'gs', OKC: 'okc', NOR: 'no', PHX: 'phx', WAS: 'wsh' },
  nfl: { JAX: 'jax', WSH: 'wsh', LVR: 'lv', LAR: 'lar', LAC: 'lac', SFO: 'sf', GNB: 'gb', NWE: 'ne', NOR: 'no', KAN: 'kc', TAM: 'tb', SFN: 'sf' },
  mlb: { ARI: 'ari', CHW: 'chw', CWS: 'chw', KCR: 'kc', SFG: 'sf', TBR: 'tb', WSN: 'wsh', SDN: 'sd', SDP: 'sd', SLN: 'stl' },
  nhl: { VGK: 'vgs', UTA: 'utah', SJS: 'sj', NJD: 'nj', NYI: 'nyi', NYR: 'nyr', TBL: 'tb', WSH: 'wsh' }
};

function espnLogo(abbreviation, league) {
  if (!abbreviation || !league || !LEAGUE_CONFIGS[league]) return null;
  const upper = abbreviation.toUpperCase();
  const fixed = ESPN_ABBR_FIX[league]?.[upper];
  const abbr = (fixed || abbreviation).toLowerCase();
  return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/${league}/500/${abbr}.png&h=80&w=80`;
}

function resolveTeamWithLogo(raw, league) {
  if (!raw) return {};
  const resolved = resolveTeam(raw, league) || {};
  const merged = { ...resolved, ...raw };
  if (merged.abbreviation) {
    merged.logo = espnLogo(merged.abbreviation, league) || merged.logo;
  } else if (resolved.abbreviation) {
    merged.abbreviation = resolved.abbreviation;
    merged.logo = espnLogo(resolved.abbreviation, league) || merged.logo;
  }
  return merged;
}

/**
 * Cross-reference ESPN scoreboard for accurate live/final status and scores.
 * Mutates the games array in place.
 */
export async function applyEspnStatus(games) {
  const leagues = [...new Set(games.map(g => g.league).filter(Boolean))];

  await Promise.all(leagues.map(async league => {
    const sb = await fetchScoreboard(league);
    if (!sb) return;
    const index = buildScoreIndex(sb);
    const events = sb.events || [];

    games.forEach(game => {
      if ((game.league || DEFAULT_LEAGUE) !== league) return;
      const away = game.awayTeam || {};
      const home = game.homeTeam || {};

      // Find matching ESPN event
      let event = null;
      if (away.abbreviation && home.abbreviation) {
        const key = [away.abbreviation.toUpperCase(), home.abbreviation.toUpperCase()].sort().join('|');
        event = index.byAbbr.get(key);
      }
      if (!event) {
        const an = normalizeTeamName(away.name);
        const hn = normalizeTeamName(home.name);
        if (an && hn) event = index.byName.get([an, hn].sort().join('|'));
      }

      if (event) {
        // Update live/ended status from ESPN
        const status = event?.competitions?.[0]?.status?.type || event?.status?.type || {};
        const state = (status.state || '').toLowerCase();
        if (state === 'in' || state === 'live') {
          game.isLive = true;
          game.isEnded = false;
          game.isUpcoming = false;
          game.statusDetail = status.shortDetail || status.detail || 'Live';
        } else if (state === 'post' || status.completed) {
          game.isLive = false;
          game.isEnded = true;
          game.isUpcoming = false;
          game.statusDetail = status.shortDetail || status.detail || 'Final';
        } else if (state === 'pre') {
          game.isLive = false;
          game.isEnded = false;
          game.isUpcoming = true;
          game.statusDetail = status.shortDetail || status.detail || '';
        }

        // Update scores
        const comps = event?.competitions?.[0]?.competitors || [];
        const ac = comps.find(c => c?.homeAway === 'away') || comps[0];
        const hc = comps.find(c => c?.homeAway === 'home') || comps[1];
        const as = extractScore(ac);
        const hs = extractScore(hc);
        if (as != null) game.awayTeam = { ...game.awayTeam, score: as };
        if (hs != null) game.homeTeam = { ...game.homeTeam, score: hs };
      }
    });
  }));
}

export function enrichGame(game) {
  if (!game) return null;

  const league = game.league || DEFAULT_LEAGUE;
  const rawAway = (game.awayTeam?.name) ? game.awayTeam : game.teams?.away || game.awayTeam || {};
  const rawHome = (game.homeTeam?.name) ? game.homeTeam : game.teams?.home || game.homeTeam || {};

  const away = resolveTeamWithLogo(rawAway, league);
  const home = resolveTeamWithLogo(rawHome, league);

  const endGraceMs = GAME_END_GRACE_HOURS * 60 * 60 * 1000;
  const gameTimestamp = game.gameTime ? new Date(game.gameTime).getTime() : null;
  const isEnded = game.isEnded ?? (!game.isLive && gameTimestamp && (Date.now() - gameTimestamp) > endGraceMs);

  const awayName = away.name || away.displayName || '';
  const homeName = home.name || home.displayName || '';
  const matchupTitle = awayName && homeName ? `${awayName} vs ${homeName}` : null;

  return {
    ...game,
    league,
    awayTeam: away,
    homeTeam: home,
    isEnded,
    timestamp: gameTimestamp,
    formattedTime: game.gameTime
      ? new Date(game.gameTime).toLocaleString(undefined, {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit'
        })
      : 'TBD',
    statusDetail: game.statusDetail || null,
    displayTitle: matchupTitle || game.title || 'Unknown Game',
    watchUrl: `#/watch/${game.slug}?league=${league}`
  };
}

export function sortEnrichedGames(games) {
  return games.slice().sort((a, b) => {
    if (a.isEnded && !b.isEnded) return 1;
    if (!a.isEnded && b.isEnded) return -1;
    if (a.isLive && !b.isLive) return -1;
    if (!a.isLive && b.isLive) return 1;
    return (a.timestamp || 0) - (b.timestamp || 0);
  });
}
