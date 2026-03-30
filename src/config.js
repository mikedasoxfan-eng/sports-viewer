/**
 * Application configuration.
 */

export const SUPPORTED_LEAGUES = ['nfl', 'nba', 'mlb', 'nhl'];
export const DEFAULT_LEAGUE = 'nfl';
export const GAME_END_GRACE_HOURS = 6;
export const MULTI_VIEW_MAX = 4;
export const EMBED_LOAD_TIMEOUT = 6_000;
export const MAX_STREAMS = 5;

export const LEAGUE_CONFIGS = {
  nfl: { name: 'NFL', fullName: 'National Football League', sport: 'football' },
  nba: { name: 'NBA', fullName: 'National Basketball Association', sport: 'basketball' },
  mlb: { name: 'MLB', fullName: 'Major League Baseball', sport: 'baseball' },
  nhl: { name: 'NHL', fullName: 'National Hockey League', sport: 'hockey' }
};

export const VALID_SOURCES = ['admin', 'charlie', 'delta', 'echo', 'golf', 'alpha', 'bravo'];

export const SOURCE_LABELS = {
  admin: 'Source 1',
  charlie: 'Source 2',
  delta: 'Source 3',
  echo: 'Source 4',
  golf: 'Source 5',
  alpha: 'Source 6',
  bravo: 'Source 7'
};

export function getLeagueName(league) {
  return LEAGUE_CONFIGS[league]?.name || league?.toUpperCase() || 'ALL';
}
