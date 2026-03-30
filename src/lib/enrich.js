/**
 * Game enrichment — resolves teams with ESPN logos, formats display data, sorts.
 */

import { DEFAULT_LEAGUE, GAME_END_GRACE_HOURS, LEAGUE_CONFIGS } from '../config.js';
import { resolveTeam, normalizeTeamString } from './teams.js';

/**
 * ESPN CDN logo URL from abbreviation.
 */
function espnLogo(abbreviation, league) {
  if (!abbreviation || !league) return null;
  const sport = LEAGUE_CONFIGS[league]?.sport;
  if (!sport) return null;
  const abbr = abbreviation.toLowerCase();
  return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/${league}/500/${abbr}.png&h=80&w=80`;
}

/**
 * Resolve a team object — look up in our teams DB, attach ESPN logo.
 */
function resolveTeamWithLogo(raw, league) {
  if (!raw) return {};
  const resolved = resolveTeam(raw, league) || {};
  const merged = { ...resolved, ...raw };

  // Prefer ESPN CDN logo over streamed.pk badge
  if (merged.abbreviation) {
    merged.logo = espnLogo(merged.abbreviation, league) || merged.logo;
  } else if (resolved.abbreviation) {
    merged.abbreviation = resolved.abbreviation;
    merged.logo = espnLogo(resolved.abbreviation, league) || merged.logo;
  }

  return merged;
}

/**
 * Enrich a raw game object with display-ready fields.
 */
export function enrichGame(game) {
  if (!game) return null;

  const league = game.league || DEFAULT_LEAGUE;
  const rawAway = (game.awayTeam && game.awayTeam.name) ? game.awayTeam
    : game.teams?.away || game.awayTeam || {};
  const rawHome = (game.homeTeam && game.homeTeam.name) ? game.homeTeam
    : game.teams?.home || game.homeTeam || {};

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
    displayTitle: matchupTitle || game.title || 'Unknown Game',
    watchUrl: `#/watch/${game.slug}?league=${league}`
  };
}

/**
 * Sort games: live first, then by date ascending, ended last.
 */
export function sortEnrichedGames(games) {
  return games.slice().sort((a, b) => {
    if (a.isEnded && !b.isEnded) return 1;
    if (!a.isEnded && b.isEnded) return -1;
    if (a.isLive && !b.isLive) return -1;
    if (!a.isLive && b.isLive) return 1;
    const ta = a.timestamp || 0;
    const tb = b.timestamp || 0;
    return ta - tb;
  });
}
