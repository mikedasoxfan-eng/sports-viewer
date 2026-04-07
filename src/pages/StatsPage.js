/**
 * Stats page — column-header sorting, category tabs only for different stat groups.
 * ESPN byathlete for NBA/NFL/NHL, MLB Stats API for baseball.
 */

import { SUPPORTED_LEAGUES, getLeagueName } from '../config.js';
import { delegate } from '../lib/dom.js';

const LIMIT = 25;

function headshot(url, size = 96) {
  if (!url) return '';
  if (url.includes('espncdn.com')) {
    const path = url.replace(/^https?:\/\/a\.espncdn\.com/, '');
    return `https://a.espncdn.com/combiner/i?img=${path}&w=${size}&h=${size}`;
  }
  return url;
}

/* ── Column definitions ──
   Each col has: label, cat+stat (ESPN) or stat (MLB), hide?, lowIsBetter?
   lowIsBetter: when first clicked, sort ascending (ERA, GAA, WHIP, etc.)
*/

const CONFIGS = {
  nba: {
    sport: 'basketball', league: 'nba', season: 2026, type: 'espn',
    tabs: [
      { id: 'traditional', label: 'Players', defaultSort: { cat: 'offensive', stat: 'avgPoints' }, cols: [
        { cat: 'general', stat: 'gamesPlayed', label: 'GP' },
        { cat: 'general', stat: 'avgMinutes', label: 'MIN', hide: 'lg' },
        { cat: 'offensive', stat: 'avgPoints', label: 'PTS' },
        { cat: 'offensive', stat: 'avgFieldGoalsMade', label: 'FGM', hide: 'md' },
        { cat: 'offensive', stat: 'avgFieldGoalsAttempted', label: 'FGA', hide: 'lg' },
        { cat: 'offensive', stat: 'fieldGoalPct', label: 'FG%', hide: 'sm' },
        { cat: 'offensive', stat: 'avgThreePointFieldGoalsMade', label: '3PM', hide: 'md' },
        { cat: 'offensive', stat: 'avgThreePointFieldGoalsAttempted', label: '3PA', hide: 'lg' },
        { cat: 'offensive', stat: 'threePointFieldGoalPct', label: '3P%', hide: 'sm' },
        { cat: 'offensive', stat: 'avgFreeThrowsMade', label: 'FTM', hide: 'lg' },
        { cat: 'offensive', stat: 'avgFreeThrowsAttempted', label: 'FTA', hide: 'lg' },
        { cat: 'offensive', stat: 'freeThrowPct', label: 'FT%', hide: 'md' },
        { cat: 'general', stat: 'avgRebounds', label: 'REB' },
        { cat: 'offensive', stat: 'avgAssists', label: 'AST' },
        { cat: 'offensive', stat: 'avgTurnovers', label: 'TOV', hide: 'sm' },
        { cat: 'defensive', stat: 'avgSteals', label: 'STL', hide: 'sm' },
        { cat: 'defensive', stat: 'avgBlocks', label: 'BLK', hide: 'sm' },
        { cat: 'general', stat: 'avgFouls', label: 'PF', hide: 'lg' },
      ]},
    ]
  },

  nfl: {
    sport: 'football', league: 'nfl', season: 2025, seasontype: 2, type: 'espn',
    tabs: [
      { id: 'passing', label: 'Passing', defaultSort: { cat: 'passing', stat: 'passingYards' }, cols: [
        { cat: 'general', stat: 'gamesPlayed', label: 'GP' },
        { cat: 'passing', stat: 'completions', label: 'CMP' },
        { cat: 'passing', stat: 'passingAttempts', label: 'ATT' },
        { cat: 'passing', stat: 'completionPct', label: 'CMP%', hide: 'sm' },
        { cat: 'passing', stat: 'passingYards', label: 'YDS' },
        { cat: 'passing', stat: 'yardsPerPassAttempt', label: 'Y/A', hide: 'sm' },
        { cat: 'passing', stat: 'passingTouchdowns', label: 'TD' },
        { cat: 'passing', stat: 'interceptions', label: 'INT' },
        { cat: 'passing', stat: 'sacks', label: 'SCK', hide: 'md' },
        { cat: 'passing', stat: 'QBRating', label: 'RTG', hide: 'sm' },
        { cat: 'passing', stat: 'longPassing', label: 'LNG', hide: 'lg' },
        { cat: 'passing', stat: 'passingYardsPerGame', label: 'YPG', hide: 'md' },
      ]},
      { id: 'rushing', label: 'Rushing', defaultSort: { cat: 'rushing', stat: 'rushingYards' }, cols: [
        { cat: 'general', stat: 'gamesPlayed', label: 'GP' },
        { cat: 'rushing', stat: 'rushingAttempts', label: 'ATT' },
        { cat: 'rushing', stat: 'rushingYards', label: 'YDS' },
        { cat: 'rushing', stat: 'yardsPerRushAttempt', label: 'Y/A' },
        { cat: 'rushing', stat: 'rushingTouchdowns', label: 'TD' },
        { cat: 'rushing', stat: 'rushingBigPlays', label: '20+', hide: 'sm' },
        { cat: 'rushing', stat: 'longRushing', label: 'LNG', hide: 'sm' },
        { cat: 'rushing', stat: 'rushingFirstDowns', label: '1D', hide: 'md' },
        { cat: 'rushing', stat: 'rushingFumbles', label: 'FUM', hide: 'md' },
        { cat: 'rushing', stat: 'rushingYardsPerGame', label: 'YPG', hide: 'md' },
      ]},
      { id: 'receiving', label: 'Receiving', defaultSort: { cat: 'receiving', stat: 'receivingYards' }, cols: [
        { cat: 'general', stat: 'gamesPlayed', label: 'GP' },
        { cat: 'receiving', stat: 'receptions', label: 'REC' },
        { cat: 'receiving', stat: 'receivingTargets', label: 'TGT', hide: 'sm' },
        { cat: 'receiving', stat: 'receivingYards', label: 'YDS' },
        { cat: 'receiving', stat: 'yardsPerReception', label: 'Y/R' },
        { cat: 'receiving', stat: 'receivingTouchdowns', label: 'TD' },
        { cat: 'receiving', stat: 'receivingBigPlays', label: '20+', hide: 'sm' },
        { cat: 'receiving', stat: 'longReception', label: 'LNG', hide: 'md' },
        { cat: 'receiving', stat: 'receivingFirstDowns', label: '1D', hide: 'md' },
        { cat: 'receiving', stat: 'receivingYardsAfterCatch', label: 'YAC', hide: 'lg' },
        { cat: 'receiving', stat: 'receivingYardsPerGame', label: 'YPG', hide: 'md' },
      ]},
      { id: 'defense', label: 'Defense', defaultSort: { cat: 'defensive', stat: 'totalTackles' }, cols: [
        { cat: 'general', stat: 'gamesPlayed', label: 'GP' },
        { cat: 'defensive', stat: 'soloTackles', label: 'SOLO' },
        { cat: 'defensive', stat: 'assistTackles', label: 'AST', hide: 'sm' },
        { cat: 'defensive', stat: 'totalTackles', label: 'TOT' },
        { cat: 'defensive', stat: 'sacks', label: 'SACK' },
        { cat: 'defensive', stat: 'sackYards', label: 'SCKYDS', hide: 'lg' },
        { cat: 'defensive', stat: 'tacklesForLoss', label: 'TFL', hide: 'sm' },
        { cat: 'defensive', stat: 'passesDefended', label: 'PD', hide: 'sm' },
        { cat: 'defensiveinterceptions', stat: 'interceptions', label: 'INT' },
        { cat: 'defensiveinterceptions', stat: 'interceptionYards', label: 'IYDS', hide: 'md' },
        { cat: 'defensiveinterceptions', stat: 'interceptionTouchdowns', label: 'ITD', hide: 'md' },
      ]},
      { id: 'kicking', label: 'Kicking', defaultSort: { cat: 'kicking', stat: 'fieldGoalsMade' }, cols: [
        { cat: 'general', stat: 'gamesPlayed', label: 'GP' },
        { cat: 'kicking', stat: 'fieldGoalsMade', label: 'FGM' },
        { cat: 'kicking', stat: 'fieldGoalAttempts', label: 'FGA' },
        { cat: 'kicking', stat: 'fieldGoalPct', label: 'FG%' },
        { cat: 'kicking', stat: 'longFieldGoalMade', label: 'LNG', hide: 'sm' },
        { cat: 'kicking', stat: 'fieldGoalsMade20_29', label: '20-29', hide: 'md' },
        { cat: 'kicking', stat: 'fieldGoalsMade30_39', label: '30-39', hide: 'md' },
        { cat: 'kicking', stat: 'fieldGoalsMade40_49', label: '40-49', hide: 'md' },
        { cat: 'kicking', stat: 'fieldGoalsMade50', label: '50+', hide: 'md' },
        { cat: 'kicking', stat: 'extraPointsMade', label: 'XPM', hide: 'sm' },
        { cat: 'kicking', stat: 'extraPointAttempts', label: 'XPA', hide: 'lg' },
      ]},
      { id: 'returns', label: 'Returns', defaultSort: { cat: 'returning', stat: 'kickReturnYards' }, cols: [
        { cat: 'general', stat: 'gamesPlayed', label: 'GP' },
        { cat: 'returning', stat: 'kickReturns', label: 'KR' },
        { cat: 'returning', stat: 'kickReturnYards', label: 'KYDS' },
        { cat: 'returning', stat: 'yardsPerKickReturn', label: 'KAVG', hide: 'sm' },
        { cat: 'returning', stat: 'kickReturnTouchdowns', label: 'KTD' },
        { cat: 'returning', stat: 'puntReturns', label: 'PR', hide: 'sm' },
        { cat: 'returning', stat: 'puntReturnYards', label: 'PYDS', hide: 'sm' },
        { cat: 'returning', stat: 'yardsPerPuntReturn', label: 'PAVG', hide: 'md' },
        { cat: 'returning', stat: 'puntReturnTouchdowns', label: 'PTD', hide: 'md' },
      ]},
      { id: 'punting', label: 'Punting', defaultSort: { cat: 'punting', stat: 'puntYards' }, cols: [
        { cat: 'general', stat: 'gamesPlayed', label: 'GP' },
        { cat: 'punting', stat: 'punts', label: 'PUNTS' },
        { cat: 'punting', stat: 'puntYards', label: 'YDS' },
        { cat: 'punting', stat: 'grossAvgPuntYards', label: 'AVG' },
        { cat: 'punting', stat: 'netAvgPuntYards', label: 'NET', hide: 'sm' },
        { cat: 'punting', stat: 'longPunt', label: 'LNG', hide: 'sm' },
        { cat: 'punting', stat: 'puntsInside20', label: 'IN20', hide: 'md' },
        { cat: 'punting', stat: 'touchbacks', label: 'TB', hide: 'md' },
      ]},
    ]
  },

  nhl: {
    sport: 'hockey', league: 'nhl', season: 2026, type: 'espn',
    tabs: [
      { id: 'skaters', label: 'Skaters', defaultSort: { cat: 'offensive', stat: 'points' }, cols: [
        { cat: 'general', stat: 'games', label: 'GP' },
        { cat: 'offensive', stat: 'goals', label: 'G' },
        { cat: 'offensive', stat: 'assists', label: 'A' },
        { cat: 'offensive', stat: 'points', label: 'PTS' },
        { cat: 'general', stat: 'plusMinus', label: '+/-' },
        { cat: 'penalties', stat: 'penaltyMinutes', label: 'PIM', hide: 'sm' },
        { cat: 'offensive', stat: 'powerPlayGoals', label: 'PPG', hide: 'md' },
        { cat: 'offensive', stat: 'powerPlayAssists', label: 'PPA', hide: 'md' },
        { cat: 'offensive', stat: 'shotsTotal', label: 'S', hide: 'sm' },
        { cat: 'offensive', stat: 'shootingPct', label: 'S%', hide: 'sm' },
        { cat: 'offensive', stat: 'gameWinningGoals', label: 'GWG', hide: 'lg' },
        { cat: 'general', stat: 'timeOnIcePerGame', label: 'TOI/G', hide: 'md' },
      ]},
      { id: 'goalies', label: 'Goalies', defaultSort: { cat: 'defensive', stat: 'savePct' }, cols: [
        { cat: 'general', stat: 'games', label: 'GP' },
        { cat: 'general', stat: 'wins', label: 'W' },
        { cat: 'general', stat: 'losses', label: 'L' },
        { cat: 'defensive', stat: 'overtimeLosses', label: 'OTL' },
        { cat: 'defensive', stat: 'avgGoalsAgainst', label: 'GAA', lowIsBetter: true },
        { cat: 'defensive', stat: 'shotsAgainst', label: 'SA', hide: 'sm' },
        { cat: 'defensive', stat: 'saves', label: 'SV', hide: 'sm' },
        { cat: 'defensive', stat: 'savePct', label: 'SV%' },
        { cat: 'defensive', stat: 'shutouts', label: 'SO' },
      ]},
    ]
  },

  mlb: {
    type: 'mlb', season: 2026,
    tabs: [
      { id: 'hitting', label: 'Hitting', group: 'hitting', defaultSort: { stat: 'battingAverage' }, cols: [
        { stat: 'gamesPlayed', label: 'G' },
        { stat: 'plateAppearances', label: 'PA', hide: 'lg' },
        { stat: 'atBats', label: 'AB' },
        { stat: 'runs', label: 'R', hide: 'md' },
        { stat: 'hits', label: 'H' },
        { stat: 'doubles', label: '2B', hide: 'md' },
        { stat: 'triples', label: '3B', hide: 'lg' },
        { stat: 'homeRuns', label: 'HR' },
        { stat: 'rbi', label: 'RBI' },
        { stat: 'stolenBases', label: 'SB', hide: 'sm' },
        { stat: 'baseOnBalls', label: 'BB', hide: 'md' },
        { stat: 'strikeOuts', label: 'SO', hide: 'md' },
        { stat: 'avg', label: 'AVG' },
        { stat: 'obp', label: 'OBP', hide: 'sm' },
        { stat: 'slg', label: 'SLG', hide: 'sm' },
        { stat: 'ops', label: 'OPS' },
      ]},
      { id: 'pitching', label: 'Pitching', group: 'pitching', defaultSort: { stat: 'earnedRunAverage', asc: true }, cols: [
        { stat: 'gamesPlayed', label: 'G' },
        { stat: 'gamesStarted', label: 'GS', hide: 'md' },
        { stat: 'wins', label: 'W' },
        { stat: 'losses', label: 'L' },
        { stat: 'era', label: 'ERA', lowIsBetter: true },
        { stat: 'inningsPitched', label: 'IP' },
        { stat: 'hits', label: 'H', hide: 'md' },
        { stat: 'earnedRuns', label: 'ER', hide: 'lg' },
        { stat: 'homeRuns', label: 'HR', hide: 'md' },
        { stat: 'baseOnBalls', label: 'BB', hide: 'sm' },
        { stat: 'strikeOuts', label: 'SO' },
        { stat: 'whip', label: 'WHIP', lowIsBetter: true },
        { stat: 'avg', label: 'BAA', hide: 'sm', lowIsBetter: true },
        { stat: 'saves', label: 'SV', hide: 'md' },
      ]},
      { id: 'fielding', label: 'Fielding', group: 'fielding', defaultSort: { stat: 'assists' }, cols: [
        { stat: 'gamesPlayed', label: 'G' },
        { stat: 'gamesStarted', label: 'GS', hide: 'md' },
        { stat: 'innings', label: 'INN', hide: 'md' },
        { stat: 'assists', label: 'A' },
        { stat: 'putOuts', label: 'PO' },
        { stat: 'errors', label: 'E', lowIsBetter: true },
        { stat: 'fielding', label: 'FPCT' },
        { stat: 'doublePlays', label: 'DP', hide: 'sm' },
        { stat: 'rangeFactorPer9Inn', label: 'RF/9', hide: 'sm' },
      ]},
    ]
  }
};

/* ── ESPN fetch ── */
async function fetchEspnStats(config, sortCat, sortStat, asc) {
  // camelCase the category for the sort param (defensiveinterceptions → defensiveInterceptions)
  let sortCatParam = sortCat;
  if (sortCat === 'defensiveinterceptions') sortCatParam = 'defensiveInterceptions';
  const sort = `${sortCatParam}.${sortStat}:${asc ? 'asc' : 'desc'}`;
  const params = new URLSearchParams({ limit: LIMIT, sort, season: config.season });
  if (config.seasontype) params.set('seasontype', config.seasontype);
  const url = `https://site.web.api.espn.com/apis/common/v3/sports/${config.sport}/${config.league}/statistics/byathlete?${params}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

function getEspnStat(athlete, categories, catName, statName) {
  const catIdx = categories.findIndex(c => c.name === catName);
  if (catIdx < 0) return '-';
  const statIdx = categories[catIdx].names.indexOf(statName);
  if (statIdx < 0) return '-';
  return athlete.categories?.[catIdx]?.totals?.[statIdx] ?? '-';
}

/* ── MLB fetch ── */
async function fetchMlbStats(group, sortStat, asc) {
  const url = `https://statsapi.mlb.com/api/v1/stats?stats=season&group=${group}&season=${CONFIGS.mlb.season}&sportId=1&order=${asc ? 'asc' : 'desc'}&sortStat=${sortStat}&limit=${LIMIT}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(res.status);
  const data = await res.json();
  return data.stats?.[0]?.splits || [];
}

/* ── Rendering ── */
function hideClass(col) {
  if (!col.hide) return '';
  return col.hide === 'sm' ? 'hidden sm:table-cell' : col.hide === 'md' ? 'hidden md:table-cell' : 'hidden lg:table-cell';
}

function playerCell(name, sub, hsUrl, logoUrl, href) {
  const hs = headshot(hsUrl);
  const tag = href ? 'a' : 'div';
  const linkAttr = href ? `href="${href}" class="flex items-center gap-2 min-w-0 no-underline group"` : `class="flex items-center gap-2 min-w-0"`;
  return `
    <td class="px-3 py-2 whitespace-nowrap">
      <${tag} ${linkAttr}>
        ${hs ? `<img src="${hs}" class="w-8 h-8 rounded-full object-cover bg-surface-elevated shrink-0" loading="lazy" onerror="this.style.display='none'" />` : `<div class="w-8 h-8 rounded-full bg-surface-elevated shrink-0"></div>`}
        <div class="min-w-0">
          <div class="font-sans text-[13px] font-medium text-ink truncate ${href ? 'group-hover:text-accent transition-colors' : ''}">${name}</div>
          <div class="flex items-center gap-1">
            ${logoUrl ? `<img src="${logoUrl}" class="w-3.5 h-3.5 object-contain shrink-0" loading="lazy" onerror="this.style.display='none'" />` : ''}
            <span class="font-mono text-[10px] text-ink-muted">${sub}</span>
          </div>
        </div>
      </${tag}>
    </td>
  `;
}

function sortableHeader(cols, activeSortStat, sortAsc) {
  return `
    <thead>
      <tr class="border-b border-ink-faint/10 bg-surface-elevated/30">
        <th class="text-left font-mono text-[10px] text-ink-muted uppercase tracking-widest px-3 py-2 w-8 sticky left-0 bg-surface-elevated/30">#</th>
        <th class="text-left font-mono text-[10px] text-ink-muted uppercase tracking-widest px-3 py-2 min-w-[160px] sticky left-8 bg-surface-elevated/30">Player</th>
        ${cols.map(c => {
          const sortKey = c.stat; // ESPN cols use cat+stat, MLB just stat
          const isActive = sortKey === activeSortStat;
          const arrow = isActive ? (sortAsc ? ' \u2191' : ' \u2193') : '';
          return `
            <th class="text-center font-mono text-[10px] uppercase tracking-widest px-2 py-2
                      select-none cursor-pointer transition-colors hover:text-ink
                      ${isActive ? 'text-accent font-semibold' : 'text-ink-muted'}
                      ${hideClass(c)}"
                data-sort-stat="${sortKey}"
                data-sort-cat="${c.cat || ''}"
                data-sort-low="${c.lowIsBetter ? '1' : ''}">${c.label}${arrow}</th>
          `;
        }).join('')}
      </tr>
    </thead>
  `;
}

function renderEspnTable(data, cols, activeSortStat, sortAsc, league) {
  const cats = data.categories || [];
  const athletes = data.athletes || [];
  if (!athletes.length) return emptyState();

  return `
    <div class="rounded-2xl bg-surface-card border border-ink-faint/15 overflow-x-auto">
      <table class="w-full text-sm">
        ${sortableHeader(cols, activeSortStat, sortAsc)}
        <tbody>
          ${athletes.map((entry, i) => {
            const a = entry.athlete || {};
            const logo = a.teamLogos?.[0]?.href || '';
            const playerUrl = league === 'nhl'
              ? `#/player/0?league=nhl&name=${encodeURIComponent(a.displayName || '')}`
              : `#/player/${a.id}?league=${league}`;
            return `
              <tr class="border-b border-ink-faint/5 last:border-0 hover:bg-surface-elevated/40 transition-colors">
                <td class="px-3 py-2 font-mono text-xs text-ink-muted sticky left-0 bg-surface-card">${i + 1}</td>
                ${playerCell(a.displayName || '?', `${a.teamShortName || ''} \u00b7 ${a.position?.abbreviation || ''}`, a.headshot?.href, logo, playerUrl)}
                ${cols.map(col => {
                  const val = getEspnStat(entry, cats, col.cat, col.stat);
                  const isActive = col.stat === activeSortStat;
                  return `<td class="text-center px-2 py-2 font-mono text-[13px] tabular-nums
                                    ${isActive ? 'font-semibold text-ink' : 'text-ink-secondary'} ${hideClass(col)}">${val}</td>`;
                }).join('')}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderMlbTable(splits, cols, activeSortStat, sortAsc) {
  if (!splits.length) return emptyState();

  return `
    <div class="rounded-2xl bg-surface-card border border-ink-faint/15 overflow-x-auto">
      <table class="w-full text-sm">
        ${sortableHeader(cols, activeSortStat, sortAsc)}
        <tbody>
          ${splits.map((split, i) => {
            const player = split.player || {};
            const team = split.team || {};
            const pos = split.position || {};
            const stat = split.stat || {};
            const logo = team.id ? `https://www.mlbstatic.com/team-logos/${team.id}.svg` : '';
            const hsImg = player.id ? `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_96,q_auto:best/v1/people/${player.id}/headshot/67/current` : '';
            const playerUrl = `#/player/${player.id}?league=mlb`;
            return `
              <tr class="border-b border-ink-faint/5 last:border-0 hover:bg-surface-elevated/40 transition-colors">
                <td class="px-3 py-2 font-mono text-xs text-ink-muted sticky left-0 bg-surface-card">${i + 1}</td>
                ${playerCell(player.fullName || '?', `${team.name || ''} \u00b7 ${pos.abbreviation || ''}`, hsImg, logo, playerUrl)}
                ${cols.map(col => {
                  const val = stat[col.stat] ?? '-';
                  const isActive = col.stat === activeSortStat;
                  return `<td class="text-center px-2 py-2 font-mono text-[13px] tabular-nums
                                    ${isActive ? 'font-semibold text-ink' : 'text-ink-secondary'} ${hideClass(col)}">${val}</td>`;
                }).join('')}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function emptyState() {
  return `
    <div class="flex flex-col items-center justify-center py-20 text-center">
      <p class="font-mono text-xs text-ink-muted uppercase tracking-widest mb-2">No stats available</p>
      <p class="font-sans text-ink-secondary text-sm">Try a different category.</p>
    </div>
  `;
}

/* ── Page ── */
export function StatsPage(container) {
  const cleanups = [];
  let currentLeague = 'nba';
  let currentTabId = null;
  let sortStat = null;   // the stat name currently sorted by
  let sortCat = null;     // ESPN category of the sort stat
  let sortAsc = false;

  function getConfig() { return CONFIGS[currentLeague]; }
  function getTabs() { return getConfig().tabs; }
  function getActiveTab() {
    if (currentTabId) {
      const found = getTabs().find(t => t.id === currentTabId);
      if (found) return found;
    }
    return getTabs()[0];
  }

  function applyDefaultSort(tab) {
    const ds = tab.defaultSort;
    sortStat = ds.stat;
    sortCat = ds.cat || null;
    sortAsc = ds.asc || false;
  }

  function renderShell() {
    const tabs = getTabs();
    const active = getActiveTab();
    const showTabs = tabs.length > 1;

    container.innerHTML = `
      <div class="pt-6 opacity-0 animate-fade-up">
        <div class="mb-6">
          <h1 class="font-mono text-2xl sm:text-3xl font-bold tracking-tighter text-ink mb-1">Stats</h1>
          <p class="font-sans text-sm text-ink-secondary">${getLeagueName(currentLeague)} ${getConfig().season} season leaders</p>
        </div>

        <div class="flex items-center gap-1 ${showTabs ? 'mb-4' : 'mb-6 pb-5 border-b border-ink-faint/8'}">
          ${SUPPORTED_LEAGUES.map(lg =>
            `<button class="filter-pill ${lg === currentLeague ? 'active' : ''}" data-stats-league="${lg}">${getLeagueName(lg)}</button>`
          ).join('')}
        </div>

        ${showTabs ? `
          <div class="flex items-center gap-1 mb-6 pb-5 border-b border-ink-faint/8 pill-scroll -mx-1 px-1">
            ${tabs.map(t =>
              `<button class="filter-pill whitespace-nowrap shrink-0 ${t.id === active.id ? 'active' : ''}" data-stats-tab="${t.id}">${t.label}</button>`
            ).join('')}
          </div>
        ` : ''}

        <div id="stats-content">
          <div class="flex justify-center py-16"><div class="w-6 h-6 border-2 border-ink-faint border-t-ink rounded-full animate-[spin_0.8s_linear_infinite]"></div></div>
        </div>
      </div>
    `;
  }

  async function loadStats() {
    const content = container.querySelector('#stats-content');
    if (!content) return;
    content.innerHTML = `<div class="flex justify-center py-16"><div class="w-6 h-6 border-2 border-ink-faint border-t-ink rounded-full animate-[spin_0.8s_linear_infinite]"></div></div>`;

    const config = getConfig();
    const tab = getActiveTab();

    try {
      if (config.type === 'espn') {
        const data = await fetchEspnStats(config, sortCat, sortStat, sortAsc);
        content.innerHTML = renderEspnTable(data, tab.cols, sortStat, sortAsc, currentLeague);
      } else {
        const splits = await fetchMlbStats(tab.group, sortStat, sortAsc);
        content.innerHTML = renderMlbTable(splits, tab.cols, sortStat, sortAsc);
      }
    } catch (err) {
      console.error('Stats load failed:', err);
      content.innerHTML = `<p class="text-ink-muted text-center py-8 font-mono text-sm">Failed to load stats</p>`;
    }
  }

  // Init
  applyDefaultSort(getActiveTab());
  renderShell();
  loadStats();

  // League switch
  cleanups.push(delegate(container, 'click', '[data-stats-league]', (e, target) => {
    currentLeague = target.dataset.statsLeague;
    currentTabId = null;
    applyDefaultSort(getActiveTab());
    renderShell();
    loadStats();
  }));

  // Tab switch (for leagues with multiple tabs)
  cleanups.push(delegate(container, 'click', '[data-stats-tab]', (e, target) => {
    currentTabId = target.dataset.statsTab;
    const tab = getActiveTab();
    applyDefaultSort(tab);
    container.querySelectorAll('[data-stats-tab]').forEach(b => {
      b.classList.toggle('active', b.dataset.statsTab === tab.id);
    });
    loadStats();
  }));

  // Column header sort
  cleanups.push(delegate(container, 'click', '[data-sort-stat]', (e, target) => {
    const stat = target.dataset.sortStat;
    const cat = target.dataset.sortCat || null;
    const lowIsBetter = target.dataset.sortLow === '1';

    if (stat === sortStat) {
      // Toggle direction
      sortAsc = !sortAsc;
    } else {
      // New column — default direction based on stat type
      sortStat = stat;
      sortCat = cat;
      sortAsc = lowIsBetter;
    }
    loadStats();
  }));

  return () => cleanups.forEach(fn => fn());
}
