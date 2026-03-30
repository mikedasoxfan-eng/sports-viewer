/**
 * League category configs for matching streamed.pk matches.
 * Actual filtering is done by checking team names against the PRO_TEAMS set
 * in game-builder.js. These configs just map categories and provide brand keywords
 * as a fallback for matches without team objects.
 */

export const LEAGUE_CONFIGS = {
  nfl: {
    categories: ['american-football', 'nfl', 'football-am'],
    brand_keywords: ['nfl', 'redzone', 'nfl network'],
    team_keywords: []
  },
  nba: {
    categories: ['basketball', 'nba'],
    brand_keywords: ['nba', 'nba tv'],
    team_keywords: []
  },
  mlb: {
    categories: ['baseball', 'mlb'],
    brand_keywords: ['mlb', 'mlb network', 'world series'],
    team_keywords: []
  },
  nhl: {
    categories: ['hockey', 'ice-hockey', 'nhl'],
    brand_keywords: ['nhl', 'stanley cup'],
    team_keywords: []
  }
};

export const PRIORITY_LEAGUES = ['nfl', 'nba', 'mlb', 'nhl'];
