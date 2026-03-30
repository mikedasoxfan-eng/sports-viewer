/**
 * ESPN API client — scoreboard, standings, teams.
 */

import { fetchJson } from './streamed.js';

export const ESPN_SCOREBOARD = {
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard'
};

export const ESPN_STANDINGS = {
  nfl: 'https://site.api.espn.com/apis/v2/sports/football/nfl/standings',
  nba: 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings',
  mlb: 'https://site.api.espn.com/apis/v2/sports/baseball/mlb/standings',
  nhl: 'https://site.api.espn.com/apis/v2/sports/hockey/nhl/standings'
};

export const ESPN_TEAMS = {
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams',
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams',
  mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams'
};

const selectLogo = logos => {
  if (!Array.isArray(logos) || !logos.length) return null;
  const best = logos.reduce((prev, cur) => {
    const ps = (parseInt(prev.width) || 0) * (parseInt(prev.height) || 0);
    const cs = (parseInt(cur.width) || 0) * (parseInt(cur.height) || 0);
    return cs > ps ? cur : prev;
  }, logos[0]);
  return best.href || logos[0].href || null;
};

export async function fetchScoreboard(league) {
  const url = ESPN_SCOREBOARD[league];
  if (!url) throw new Error('Unsupported league');
  const data = await fetchJson(url);
  return Array.isArray(data?.events) ? data.events : [];
}

export function normalizeScoreboardTeam(competitor) {
  if (!competitor) return null;
  const t = competitor.team || {};
  const name = t.displayName || t.shortDisplayName || t.name || '';
  const logo = t.logo || selectLogo(Array.isArray(t.logos) ? t.logos : []);
  const raw = competitor.score ?? competitor?.score?.displayValue ?? null;
  const score = raw === '' ? null : raw;
  if (!name && !logo && score === null) return null;
  return {
    id: t.id || null,
    name: name || null,
    shortName: t.shortDisplayName || t.abbreviation || name || null,
    abbreviation: t.abbreviation || null,
    logo: logo || null,
    color: t.color || null,
    alternateColor: t.alternateColor || null,
    score
  };
}

export function parseEspnTeams(payload) {
  const teams = [];
  (payload.sports || []).forEach(sport => {
    (sport.leagues || []).forEach(league => {
      (league.teams || []).forEach(entry => {
        const t = entry.team || {};
        if (!t.abbreviation) return;
        teams.push({
          id: t.id,
          abbreviation: t.abbreviation.toUpperCase(),
          name: t.displayName || t.shortDisplayName || t.name,
          shortName: t.shortDisplayName || t.abbreviation,
          logo: selectLogo(t.logos || []),
          color: t.color || null,
          alternateColor: t.alternateColor || null
        });
      });
    });
  });
  return teams;
}

const extractStat = (stats, names) => {
  for (const s of stats || []) {
    if (names.includes(s.name)) return s.displayValue ?? s.value ?? null;
  }
  return null;
};

export function parseEspnStandings(payload) {
  const groups = [];
  let season = null;
  let seasonType = null;
  const leagueName = payload.shortName || payload.name || payload.abbreviation || '';

  const parseEntries = entries => (entries || []).map(entry => {
    const t = entry.team || {};
    const stats = entry.stats || [];
    return {
      team: {
        id: t.id,
        name: t.displayName || t.shortDisplayName || t.name,
        abbreviation: t.abbreviation,
        logo: selectLogo(t.logos || [])
      },
      stats: {
        wins: extractStat(stats, ['wins']),
        losses: extractStat(stats, ['losses']),
        ties: extractStat(stats, ['ties']),
        otLosses: extractStat(stats, ['otLosses', 'overtimeLosses']),
        winPercent: extractStat(stats, ['winPercent', 'pointsPercentage']),
        points: extractStat(stats, ['points']),
        gamesBehind: extractStat(stats, ['gamesBehind', 'gamesBack']),
        streak: extractStat(stats, ['streak'])
      }
    };
  });

  const addGroup = (name, standings) => {
    if (!standings) return;
    season = season || standings.seasonDisplayName || String(standings.season || '');
    seasonType = seasonType || standings.seasonType || null;
    groups.push({ name: name || 'Standings', entries: parseEntries(standings.entries || []) });
  };

  const children = payload.children || [];
  if (children.length) {
    children.forEach(c => addGroup(c.shortName || c.name || c.abbreviation, c.standings));
  } else {
    addGroup(leagueName, payload.standings);
  }

  return { league: leagueName, season, seasonType, groups };
}
