/**
 * Scores page — deep game detail with line scores, leaders, odds, broadcasts.
 * ESPN for NBA/NFL/NHL, MLB Stats API for baseball.
 */

import { state } from '../lib/state.js';
import { SUPPORTED_LEAGUES, getLeagueName, LEAGUE_CONFIGS } from '../config.js';
import { delegate } from '../lib/dom.js';

/* ── ESPN endpoints ── */
const ESPN_SCOREBOARD = {
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
  mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
};
const MLB_SCHEDULE = 'https://statsapi.mlb.com/api/v1/schedule';

/* ── Date helpers ── */
function pad(n) { return String(n).padStart(2, '0'); }
function espnDate(d) { return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; }
function mlbDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function dayLabel(d) {
  const today = new Date(); today.setHours(0,0,0,0);
  const cmp = new Date(d); cmp.setHours(0,0,0,0);
  const diff = Math.round((cmp - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function shiftDay(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

/* ── ESPN helpers ── */
function espnLogoUrl(teamObj) {
  return teamObj?.logo || teamObj?.team?.logo || '';
}
function optimizeHeadshot(url) {
  if (!url) return '';
  if (url.includes('espncdn.com')) {
    const path = url.replace(/^https?:\/\/a\.espncdn\.com/, '');
    return `https://a.espncdn.com/combiner/i?img=${path}&w=96&h=96`;
  }
  return url;
}

/* ── Fetch helpers ── */
async function fetchEspn(league, date) {
  const url = `${ESPN_SCOREBOARD[league]}?dates=${espnDate(date)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.events || []).map(ev => ({ ...ev, _league: league }));
}

async function fetchMlb(date) {
  const url = `${MLB_SCHEDULE}?sportId=1&date=${mlbDate(date)}&hydrate=linescore,team,probablePitcher,stats,broadcasts`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.dates?.[0]?.games || []).map(g => ({ ...g, _league: 'mlb' }));
  } catch {
    // CORS or network failure — fall back to ESPN for MLB
    return fetchEspn('mlb', date);
  }
}

/* ── ESPN card renderer ── */
function renderEspnCard(event, index) {
  const comp = event.competitions?.[0] || {};
  const competitors = comp.competitors || [];
  const away = competitors.find(c => c.homeAway === 'away') || competitors[0] || {};
  const home = competitors.find(c => c.homeAway === 'home') || competitors[1] || {};
  const status = comp.status || event.status || {};
  const statusType = status.type || {};
  const league = event._league;
  const leagueName = getLeagueName(league);

  const awayTeam = away.team || {};
  const homeTeam = home.team || {};
  const awayRecord = (away.records?.find(r => r.type === 'total') || away.records?.find(r => r.type === 'ytd') || away.records?.[0])?.summary || '';
  const homeRecord = (home.records?.find(r => r.type === 'total') || home.records?.find(r => r.type === 'ytd') || home.records?.[0])?.summary || '';
  const awayScore = away.score ?? '';
  const homeScore = home.score ?? '';

  // Status
  const isLive = statusType.state === 'in';
  const isFinal = statusType.state === 'post';
  const statusText = statusType.shortDetail || statusType.detail || statusType.description || '';

  // Broadcasts
  const broadcasts = comp.broadcasts || [];
  const broadcastStr = broadcasts.flatMap(b => b.names || []).join(', ');

  // Odds
  const odds = comp.odds?.[0];
  const spread = odds?.details || '';
  const ou = odds?.overUnder ? `O/U ${odds.overUnder}` : '';
  const oddsProvider = odds?.provider?.name || '';

  // Venue
  const venue = comp.venue?.fullName || comp.venue?.shortName || '';

  // Line scores
  const awayLines = away.linescores || [];
  const homeLines = home.linescores || [];
  const hasLines = awayLines.length > 0 && (isFinal || isLive);

  // Period labels
  const periodLabels = awayLines.map((ls, i) => {
    if (league === 'nhl') {
      if (i < 3) return ['1st', '2nd', '3rd'][i];
      if (i === 3) return 'OT';
      return 'SO';
    }
    if (i < 4) return `Q${i + 1}`;
    if (i === 4) return 'OT';
    return `${i - 3}OT`;
  });

  // Leaders — check competition level first, then merge from competitors
  let leaders = comp.leaders || [];
  if (!leaders.length) {
    // NBA/NHL put leaders on each competitor — merge top performers from both teams
    const awayLeaders = away.leaders || [];
    const homeLeaders = home.leaders || [];
    // Combine into a unified leaders array picking the top performer per category
    const catMap = new Map();
    for (const cat of [...awayLeaders, ...homeLeaders]) {
      const top = cat.leaders?.[0];
      if (!top) continue;
      const existing = catMap.get(cat.name);
      if (!existing || top.value > existing.leaders[0].value) {
        catMap.set(cat.name, cat);
      }
    }
    leaders = [...catMap.values()];
  }

  // Winner highlight
  const awayWon = isFinal && Number(awayScore) > Number(homeScore);
  const homeWon = isFinal && Number(homeScore) > Number(awayScore);

  return `
    <div class="rounded-2xl bg-surface-card border border-ink-faint/15 overflow-hidden
                opacity-0 animate-fade-up" style="animation-delay: ${index * 40}ms">

      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-2 border-b border-ink-faint/8 bg-surface-elevated/30">
        <div class="flex items-center gap-2">
          <span class="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-muted">${leagueName}</span>
          ${venue ? `<span class="font-sans text-[10px] text-ink-muted/50 hidden sm:inline">${venue}</span>` : ''}
        </div>
        <div class="flex items-center gap-2">
          ${broadcastStr ? `<span class="font-mono text-[10px] text-ink-muted/60 hidden sm:inline">${broadcastStr}</span>` : ''}
          ${isLive
            ? `<span class="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-live">
                <span class="w-1.5 h-1.5 rounded-full bg-live animate-pulse-live"></span>${statusText}
              </span>`
            : `<span class="font-mono text-[10px] font-medium ${isFinal ? 'text-ink-muted' : 'text-ink-secondary'}">${statusText}</span>`
          }
        </div>
      </div>

      <!-- Teams + Scores -->
      <div class="px-4 py-3 space-y-1.5">
        ${teamRow(awayTeam, awayRecord, awayScore, awayWon)}
        ${teamRow(homeTeam, homeRecord, homeScore, homeWon)}
      </div>

      <!-- Line Score -->
      ${hasLines ? `
        <div class="px-4 py-2 border-t border-ink-faint/8 bg-surface-elevated/20 overflow-x-auto">
          <table class="w-full text-center font-mono text-[11px] tabular-nums">
            <thead>
              <tr class="text-ink-muted/60">
                <th class="text-left font-normal w-16 py-0.5"></th>
                ${periodLabels.map(l => `<th class="font-normal px-2 py-0.5 min-w-[28px]">${l}</th>`).join('')}
                <th class="font-semibold px-2 py-0.5 text-ink-muted min-w-[32px]">T</th>
              </tr>
            </thead>
            <tbody>
              <tr class="${awayWon ? 'text-ink font-semibold' : 'text-ink-secondary'}">
                <td class="text-left py-0.5">${awayTeam.abbreviation || ''}</td>
                ${awayLines.map(ls => `<td class="px-2 py-0.5">${ls.displayValue ?? ls.value ?? '-'}</td>`).join('')}
                <td class="px-2 py-0.5 font-semibold text-ink">${awayScore}</td>
              </tr>
              <tr class="${homeWon ? 'text-ink font-semibold' : 'text-ink-secondary'}">
                <td class="text-left py-0.5">${homeTeam.abbreviation || ''}</td>
                ${homeLines.map(ls => `<td class="px-2 py-0.5">${ls.displayValue ?? ls.value ?? '-'}</td>`).join('')}
                <td class="px-2 py-0.5 font-semibold text-ink">${homeScore}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- Leaders -->
      ${leaders.length > 0 && (isFinal || isLive) ? `
        <div class="px-4 py-2.5 border-t border-ink-faint/8 flex flex-wrap gap-x-5 gap-y-2">
          ${leaders.slice(0, 3).map(cat => {
            const top = cat.leaders?.[0];
            if (!top) return '';
            const athlete = top.athlete || {};
            const headshot = optimizeHeadshot(athlete.headshot?.href || athlete.headshot || '');
            return `
              <div class="flex items-center gap-2 min-w-0">
                ${headshot ? `<img src="${headshot}" class="w-6 h-6 rounded-full object-cover bg-surface-elevated shrink-0" onerror="this.style.display='none'" />` : ''}
                <div class="min-w-0">
                  <div class="font-sans text-[11px] font-medium text-ink truncate">${athlete.shortName || athlete.displayName || '?'}</div>
                  <div class="font-mono text-[10px] text-ink-muted truncate">${cat.shortDisplayName || cat.abbreviation || ''}: ${top.displayValue || ''}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}

      <!-- Odds -->
      ${(spread || ou) ? `
        <div class="px-4 py-1.5 border-t border-ink-faint/8 flex items-center gap-3 font-mono text-[10px] text-ink-muted/50">
          ${spread ? `<span>${spread}</span>` : ''}
          ${ou ? `<span>${ou}</span>` : ''}
          ${oddsProvider ? `<span class="ml-auto">${oddsProvider}</span>` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

function teamRow(team, record, score, isWinner) {
  const logo = espnLogoUrl(team);
  const name = team.shortDisplayName || team.displayName || team.name || '?';
  const abbr = team.abbreviation || '';
  return `
    <div class="flex items-center gap-2.5 min-w-0">
      ${logo ? `<div class="w-7 h-7 rounded-lg bg-surface-elevated shrink-0 flex items-center justify-center overflow-hidden p-0.5">
        <img src="${logo}" class="w-full h-full object-contain" onerror="this.style.display='none'" /></div>` : `<div class="w-7 h-7 rounded-lg bg-surface-elevated shrink-0"></div>`}
      <span class="font-sans text-sm ${isWinner ? 'font-semibold text-ink' : 'text-ink-secondary'} truncate">${name}</span>
      ${record ? `<span class="font-mono text-[10px] text-ink-muted/60 tabular-nums shrink-0">${record}</span>` : ''}
      <span class="font-mono text-lg ${isWinner ? 'font-bold text-ink' : 'font-semibold text-ink-secondary'} tabular-nums ml-auto shrink-0">${score}</span>
    </div>
  `;
}

/* ── MLB card renderer ── */
function renderMlbCard(game, index) {
  const status = game.status || {};
  const isLive = status.abstractGameState === 'Live';
  const isFinal = status.abstractGameState === 'Final';
  const isPre = status.abstractGameState === 'Preview';

  const away = game.teams?.away || {};
  const home = game.teams?.home || {};
  const awayTeam = away.team || {};
  const homeTeam = home.team || {};
  const awayRecord = away.leagueRecord || away.record || {};
  const homeRecord = home.leagueRecord || home.record || {};
  const awayRecordStr = awayRecord.wins != null ? `${awayRecord.wins}-${awayRecord.losses}` : '';
  const homeRecordStr = homeRecord.wins != null ? `${homeRecord.wins}-${homeRecord.losses}` : '';

  const ls = game.linescore || {};
  const innings = ls.innings || [];
  const awayRuns = ls.teams?.away?.runs ?? '';
  const homeRuns = ls.teams?.home?.runs ?? '';
  const awayHits = ls.teams?.away?.hits ?? '';
  const homeHits = ls.teams?.home?.hits ?? '';
  const awayErrors = ls.teams?.away?.errors ?? '';
  const homeErrors = ls.teams?.home?.errors ?? '';
  const hasLinescore = innings.length > 0;

  const awayWon = isFinal && Number(awayRuns) > Number(homeRuns);
  const homeWon = isFinal && Number(homeRuns) > Number(awayRuns);

  // Status text
  let statusText = status.detailedState || '';
  if (isLive) {
    const half = ls.isTopInning ? 'Top' : 'Bot';
    const inn = ls.currentInningOrdinal || '';
    statusText = `${half} ${inn}`;
  } else if (isPre) {
    const t = new Date(game.gameDate);
    statusText = t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  // Pitchers
  const awayPitcher = away.probablePitcher;
  const homePitcher = home.probablePitcher;
  const awayPitcherStats = awayPitcher?.stats?.find(s => s.type?.displayName === 'statsSingleSeason' && s.group?.displayName === 'pitching')?.stats;
  const homePitcherStats = homePitcher?.stats?.find(s => s.type?.displayName === 'statsSingleSeason' && s.group?.displayName === 'pitching')?.stats;

  // Count (BSO) if live
  const balls = ls.balls ?? null;
  const strikes = ls.strikes ?? null;
  const outs = ls.outs ?? null;
  const hasCount = isLive && balls != null;

  // Venue
  const venue = game.venue?.name || '';

  // Broadcasts
  const broadcastStr = (game.broadcasts || []).map(b => b.name).filter(Boolean).join(', ');

  // MLB logo URLs
  const mlbLogo = (id) => id ? `https://www.mlbstatic.com/team-logos/${id}.svg` : '';

  return `
    <div class="rounded-2xl bg-surface-card border border-ink-faint/15 overflow-hidden
                opacity-0 animate-fade-up" style="animation-delay: ${index * 40}ms">

      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-2 border-b border-ink-faint/8 bg-surface-elevated/30">
        <div class="flex items-center gap-2">
          <span class="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-muted">MLB</span>
          ${venue ? `<span class="font-sans text-[10px] text-ink-muted/50 hidden sm:inline">${venue}</span>` : ''}
        </div>
        <div class="flex items-center gap-2">
          ${broadcastStr ? `<span class="font-mono text-[10px] text-ink-muted/60 hidden sm:inline">${broadcastStr}</span>` : ''}
          ${isLive
            ? `<span class="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-live">
                <span class="w-1.5 h-1.5 rounded-full bg-live animate-pulse-live"></span>${statusText}
              </span>`
            : `<span class="font-mono text-[10px] font-medium ${isFinal ? 'text-ink-muted' : 'text-ink-secondary'}">${statusText}</span>`
          }
        </div>
      </div>

      <!-- Teams + Scores -->
      <div class="px-4 py-3 space-y-1.5">
        ${mlbTeamRow(awayTeam, awayRecordStr, awayRuns, awayWon, mlbLogo(awayTeam.id))}
        ${mlbTeamRow(homeTeam, homeRecordStr, homeRuns, homeWon, mlbLogo(homeTeam.id))}
      </div>

      <!-- Count (BSO) if live -->
      ${hasCount ? `
        <div class="px-4 pb-2 flex items-center gap-3">
          <div class="flex items-center gap-1.5 font-mono text-[10px] text-ink-muted">
            <span>B</span>${bsoIndicator(balls, 4)}
            <span class="ml-1.5">S</span>${bsoIndicator(strikes, 3)}
            <span class="ml-1.5">O</span>${bsoIndicator(outs, 3)}
          </div>
        </div>
      ` : ''}

      <!-- Inning-by-inning line score -->
      ${hasLinescore ? `
        <div class="px-4 py-2 border-t border-ink-faint/8 bg-surface-elevated/20 overflow-x-auto">
          <table class="w-full text-center font-mono text-[11px] tabular-nums">
            <thead>
              <tr class="text-ink-muted/60">
                <th class="text-left font-normal w-16 py-0.5"></th>
                ${innings.map(inn => `<th class="font-normal px-1.5 py-0.5 min-w-[22px]">${inn.num}</th>`).join('')}
                <th class="font-semibold px-2 py-0.5 text-ink-muted border-l border-ink-faint/10 min-w-[28px]">R</th>
                <th class="font-semibold px-2 py-0.5 text-ink-muted min-w-[28px]">H</th>
                <th class="font-semibold px-2 py-0.5 text-ink-muted min-w-[28px]">E</th>
              </tr>
            </thead>
            <tbody>
              <tr class="${awayWon ? 'text-ink font-semibold' : 'text-ink-secondary'}">
                <td class="text-left py-0.5">${awayTeam.abbreviation || ''}</td>
                ${innings.map(inn => `<td class="px-1.5 py-0.5">${inn.away?.runs ?? '-'}</td>`).join('')}
                <td class="px-2 py-0.5 font-semibold text-ink border-l border-ink-faint/10">${awayRuns}</td>
                <td class="px-2 py-0.5">${awayHits}</td>
                <td class="px-2 py-0.5">${awayErrors}</td>
              </tr>
              <tr class="${homeWon ? 'text-ink font-semibold' : 'text-ink-secondary'}">
                <td class="text-left py-0.5">${homeTeam.abbreviation || ''}</td>
                ${innings.map(inn => `<td class="px-1.5 py-0.5">${inn.home?.runs ?? '-'}</td>`).join('')}
                <td class="px-2 py-0.5 font-semibold text-ink border-l border-ink-faint/10">${homeRuns}</td>
                <td class="px-2 py-0.5">${homeHits}</td>
                <td class="px-2 py-0.5">${homeErrors}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- Pitchers -->
      ${(awayPitcher || homePitcher) ? `
        <div class="px-4 py-2.5 border-t border-ink-faint/8 space-y-1.5">
          ${awayPitcher ? pitcherRow(awayPitcher, awayPitcherStats, awayTeam.abbreviation, isPre ? 'SP' : null) : ''}
          ${homePitcher ? pitcherRow(homePitcher, homePitcherStats, homeTeam.abbreviation, isPre ? 'SP' : null) : ''}
        </div>
      ` : ''}
    </div>
  `;
}

function mlbTeamRow(team, record, runs, isWinner, logo) {
  const name = team.shortName || team.teamName || team.name || '?';
  return `
    <div class="flex items-center gap-2.5 min-w-0">
      ${logo ? `<div class="w-7 h-7 rounded-lg bg-surface-elevated shrink-0 flex items-center justify-center overflow-hidden p-0.5">
        <img src="${logo}" class="w-full h-full object-contain" onerror="this.style.display='none'" /></div>` : `<div class="w-7 h-7 rounded-lg bg-surface-elevated shrink-0"></div>`}
      <span class="font-sans text-sm ${isWinner ? 'font-semibold text-ink' : 'text-ink-secondary'} truncate">${name}</span>
      ${record ? `<span class="font-mono text-[10px] text-ink-muted/60 tabular-nums shrink-0">${record}</span>` : ''}
      <span class="font-mono text-lg ${isWinner ? 'font-bold text-ink' : 'font-semibold text-ink-secondary'} tabular-nums ml-auto shrink-0">${runs}</span>
    </div>
  `;
}

function pitcherRow(pitcher, seasonStats, teamAbbr, label) {
  const name = pitcher.fullName || '?';
  const era = seasonStats?.era ? `${seasonStats.era} ERA` : '';
  const record = seasonStats?.wins != null ? `${seasonStats.wins}-${seasonStats.losses}` : '';
  const statLine = [record, era].filter(Boolean).join(', ');
  return `
    <div class="flex items-center gap-2 min-w-0">
      <span class="font-mono text-[10px] text-ink-muted/50 w-8 shrink-0">${label || teamAbbr || ''}</span>
      <span class="font-sans text-[11px] font-medium text-ink truncate">${name}</span>
      ${statLine ? `<span class="font-mono text-[10px] text-ink-muted tabular-nums shrink-0">${statLine}</span>` : ''}
    </div>
  `;
}

function bsoIndicator(filled, total) {
  return Array.from({ length: total }, (_, i) =>
    `<span class="w-2 h-2 rounded-full ${i < filled ? 'bg-accent' : 'bg-ink-faint/30'}"></span>`
  ).join('');
}

/* ── Main page ── */
export function ScoresPage(container) {
  const cleanups = [];
  let selectedDate = new Date();
  let selectedLeague = 'all';
  let loading = false;

  function dateStrip() {
    const days = [];
    for (let i = -3; i <= 3; i++) {
      const d = shiftDay(selectedDate, i - Math.round((selectedDate - new Date(new Date().setHours(0,0,0,0))) / 86400000));
      // Actually, let's build around selectedDate
    }
    // Build 7 days centered on selectedDate
    const dates = [];
    for (let i = -3; i <= 3; i++) {
      dates.push(shiftDay(selectedDate, i));
    }
    return dates.map(d => {
      const isSelected = d.toDateString() === selectedDate.toDateString();
      const isToday = d.toDateString() === new Date().toDateString();
      return `
        <button class="shrink-0 px-3 py-1.5 rounded-lg font-mono text-[11px] tabular-nums
                      transition-all duration-200 ease-smooth
                      ${isSelected
                        ? 'bg-ink text-surface-card font-semibold shadow-bezel'
                        : isToday
                          ? 'text-accent font-medium hover:bg-surface-elevated'
                          : 'text-ink-muted hover:text-ink hover:bg-surface-elevated'}"
                data-score-date="${espnDate(d)}">
          ${isToday && !isSelected ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </button>
      `;
    }).join('');
  }

  function renderShell() {
    container.innerHTML = `
      <div class="pt-6 opacity-0 animate-fade-up">
        <div class="mb-6">
          <h1 class="font-mono text-2xl sm:text-3xl font-bold tracking-tighter text-ink mb-1">Scores</h1>
          <p class="font-sans text-sm text-ink-secondary">${dayLabel(selectedDate)}</p>
        </div>

        <!-- Date strip -->
        <div class="flex items-center gap-1 mb-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
          <button class="shrink-0 w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center
                        text-ink-muted hover:text-ink transition-colors" data-date-shift="-7" title="Previous week">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          ${dateStrip()}
          <button class="shrink-0 w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center
                        text-ink-muted hover:text-ink transition-colors" data-date-shift="7" title="Next week">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>

        <!-- League filter -->
        <div class="flex items-center gap-1 mb-6 pb-5 border-b border-ink-faint/8">
          <button class="filter-pill ${selectedLeague === 'all' ? 'active' : ''}" data-score-league="all">All</button>
          ${SUPPORTED_LEAGUES.map(lg =>
            `<button class="filter-pill ${lg === selectedLeague ? 'active' : ''}" data-score-league="${lg}">${getLeagueName(lg)}</button>`
          ).join('')}
        </div>

        <div id="scores-content">
          ${loadingSpinner()}
        </div>
      </div>
    `;
  }

  function loadingSpinner() {
    return `<div class="flex justify-center py-16"><div class="w-6 h-6 border-2 border-ink-faint border-t-ink rounded-full animate-[spin_0.8s_linear_infinite]"></div></div>`;
  }

  async function loadScores() {
    const content = container.querySelector('#scores-content');
    if (!content) return;
    loading = true;
    content.innerHTML = loadingSpinner();

    try {
      const leagues = selectedLeague === 'all' ? SUPPORTED_LEAGUES : [selectedLeague];
      const results = await Promise.all(leagues.map(lg => {
        if (lg === 'mlb') return fetchMlb(selectedDate);
        return fetchEspn(lg, selectedDate);
      }));

      const sections = [];
      leagues.forEach((lg, i) => {
        const games = results[i] || [];
        if (games.length > 0) {
          sections.push({ league: lg, games });
        }
      });

      if (sections.length === 0) {
        content.innerHTML = `
          <div class="flex flex-col items-center justify-center py-20 text-center">
            <div class="w-14 h-14 rounded-2xl bg-surface-elevated flex items-center justify-center mb-5">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-ink-muted">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <p class="font-mono text-xs text-ink-muted uppercase tracking-widest mb-2">No games</p>
            <p class="font-sans text-ink-secondary text-sm">No games scheduled for ${dayLabel(selectedDate).toLowerCase()}.</p>
          </div>
        `;
        return;
      }

      let cardIndex = 0;
      content.innerHTML = sections.map(section => {
        const leagueName = getLeagueName(section.league);
        const cards = section.games.map(g => {
          const idx = cardIndex++;
          if (section.league === 'mlb' && g.gamePk) {
            return renderMlbCard(g, idx);
          }
          return renderEspnCard(g, idx);
        }).join('');

        // Show league header when viewing all leagues
        const header = selectedLeague === 'all'
          ? `<div class="flex items-center gap-2 mb-4 mt-6 first:mt-0">
              <h2 class="font-mono text-xs font-semibold uppercase tracking-widest text-ink-muted">${leagueName}</h2>
              <span class="font-mono text-[10px] text-ink-muted/40">${section.games.length} game${section.games.length !== 1 ? 's' : ''}</span>
              <div class="flex-1 h-px bg-ink-faint/10"></div>
            </div>`
          : '';

        return `${header}<div class="grid grid-cols-1 lg:grid-cols-2 gap-3">${cards}</div>`;
      }).join('');

    } catch (err) {
      console.error('Failed to load scores:', err);
      content.innerHTML = `<p class="text-ink-muted text-center py-8 font-mono text-sm">Failed to load scores</p>`;
    } finally {
      loading = false;
    }
  }

  renderShell();
  loadScores();

  // Date selection
  cleanups.push(delegate(container, 'click', '[data-score-date]', (e, target) => {
    const ds = target.dataset.scoreDate;
    const y = parseInt(ds.slice(0, 4));
    const m = parseInt(ds.slice(4, 6)) - 1;
    const d = parseInt(ds.slice(6, 8));
    selectedDate = new Date(y, m, d);
    renderShell();
    loadScores();
  }));

  // Date shift (week arrows)
  cleanups.push(delegate(container, 'click', '[data-date-shift]', (e, target) => {
    const shift = parseInt(target.dataset.dateShift);
    selectedDate = shiftDay(selectedDate, shift);
    renderShell();
    loadScores();
  }));

  // League filter
  cleanups.push(delegate(container, 'click', '[data-score-league]', (e, target) => {
    selectedLeague = target.dataset.scoreLeague;
    container.querySelectorAll('[data-score-league]').forEach(b => {
      b.classList.toggle('active', b.dataset.scoreLeague === selectedLeague);
    });
    loadScores();
  }));

  // Auto-refresh live scores every 30s
  const interval = setInterval(() => {
    if (!loading) loadScores();
  }, 30_000);
  cleanups.push(() => clearInterval(interval));

  return () => cleanups.forEach(fn => fn());
}
