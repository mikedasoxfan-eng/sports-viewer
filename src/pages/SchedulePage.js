/**
 * Schedule page — upcoming games across leagues, day-by-day week view.
 */

import { state } from '../lib/state.js';
import { SUPPORTED_LEAGUES, getLeagueName, LEAGUE_CONFIGS } from '../config.js';
import { delegate } from '../lib/dom.js';

const ESPN_SCOREBOARD = {
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
};
const MLB_SCHEDULE = 'https://statsapi.mlb.com/api/v1/schedule';

function pad(n) { return String(n).padStart(2, '0'); }
function espnDate(d) { return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; }
function mlbDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function shiftDay(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function isToday(d) {
  const t = new Date(); t.setHours(0,0,0,0);
  const c = new Date(d); c.setHours(0,0,0,0);
  return c.getTime() === t.getTime();
}

/* ── Fetch ── */
async function fetchEspnDay(league, date) {
  try {
    const res = await fetch(`${ESPN_SCOREBOARD[league]}?dates=${espnDate(date)}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.events || []).map(ev => {
      const comp = ev.competitions?.[0] || {};
      const competitors = comp.competitors || [];
      const away = competitors.find(c => c.homeAway === 'away') || competitors[0] || {};
      const home = competitors.find(c => c.homeAway === 'home') || competitors[1] || {};
      const status = comp.status?.type || {};
      const broadcasts = (comp.broadcasts || []).flatMap(b => b.names || []);
      return {
        league,
        time: ev.date,
        status: status.shortDetail || status.description || '',
        state: status.state || 'pre',
        venue: comp.venue?.shortName || '',
        broadcast: broadcasts.join(', '),
        away: { name: away.team?.shortDisplayName || away.team?.displayName || '?', abbr: away.team?.abbreviation || '', logo: away.team?.logo || '', record: (away.records?.find(r => r.type === 'total') || away.records?.find(r => r.type === 'ytd') || away.records?.[0])?.summary || '' },
        home: { name: home.team?.shortDisplayName || home.team?.displayName || '?', abbr: home.team?.abbreviation || '', logo: home.team?.logo || '', record: (home.records?.find(r => r.type === 'total') || home.records?.find(r => r.type === 'ytd') || home.records?.[0])?.summary || '' },
      };
    });
  } catch { return []; }
}

async function fetchMlbDay(date) {
  try {
    const res = await fetch(`${MLB_SCHEDULE}?sportId=1&date=${mlbDate(date)}&hydrate=team,probablePitcher,broadcasts`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.dates?.[0]?.games || []).map(g => {
      const away = g.teams?.away || {};
      const home = g.teams?.home || {};
      const awayRec = away.leagueRecord || away.record || {};
      const homeRec = home.leagueRecord || home.record || {};
      const broadcasts = (g.broadcasts || []).map(b => b.name).filter(Boolean);
      return {
        league: 'mlb',
        time: g.gameDate,
        status: g.status?.detailedState || '',
        state: g.status?.abstractGameState === 'Live' ? 'in' : g.status?.abstractGameState === 'Final' ? 'post' : 'pre',
        venue: g.venue?.name || '',
        broadcast: broadcasts.join(', '),
        away: { name: away.team?.teamName || away.team?.name || '?', abbr: away.team?.abbreviation || '', logo: away.team?.id ? `https://www.mlbstatic.com/team-logos/${away.team.id}.svg` : '', record: awayRec.wins != null ? `${awayRec.wins}-${awayRec.losses}` : '' },
        home: { name: home.team?.teamName || home.team?.name || '?', abbr: home.team?.abbreviation || '', logo: home.team?.id ? `https://www.mlbstatic.com/team-logos/${home.team.id}.svg` : '', record: homeRec.wins != null ? `${homeRec.wins}-${homeRec.losses}` : '' },
        awayPitcher: away.probablePitcher?.fullName || null,
        homePitcher: home.probablePitcher?.fullName || null,
      };
    });
  } catch { return []; }
}

async function fetchDayAll(date, league) {
  const leagues = league === 'all' ? SUPPORTED_LEAGUES : [league];
  const results = await Promise.all(leagues.map(lg => {
    if (lg === 'mlb') return fetchMlbDay(date);
    return fetchEspnDay(lg, date);
  }));
  return results.flat().sort((a, b) => {
    // Sort by time, then league
    const ta = new Date(a.time || 0).getTime();
    const tb = new Date(b.time || 0).getTime();
    return ta - tb;
  });
}

/* ── Render ── */
function renderGameRow(game) {
  const t = new Date(game.time);
  const timeStr = game.state === 'pre'
    ? t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : game.status;
  const isLive = game.state === 'in';
  const isFinal = game.state === 'post';
  const leagueName = getLeagueName(game.league);

  return `
    <div class="flex items-center gap-3 px-4 py-3 hover:bg-surface-elevated/40 transition-colors rounded-xl">
      <!-- Time / Status -->
      <div class="w-16 shrink-0 text-center">
        ${isLive
          ? `<span class="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-live">
              <span class="w-1.5 h-1.5 rounded-full bg-live animate-pulse-live"></span>Live
            </span>`
          : `<span class="font-mono text-[11px] ${isFinal ? 'text-ink-muted' : 'text-ink-secondary'} tabular-nums">${timeStr}</span>`
        }
      </div>

      <!-- League badge -->
      <span class="font-mono text-[9px] text-ink-muted/50 uppercase tracking-widest w-8 shrink-0">${leagueName}</span>

      <!-- Matchup -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          ${game.away.logo ? `<img src="${game.away.logo}" class="w-4 h-4 object-contain shrink-0" onerror="this.style.display='none'" />` : ''}
          <span class="font-sans text-sm text-ink truncate">${game.away.name}</span>
          ${game.away.record ? `<span class="font-mono text-[9px] text-ink-muted/50 tabular-nums">${game.away.record}</span>` : ''}
          <span class="font-sans text-xs text-ink-muted mx-1">@</span>
          ${game.home.logo ? `<img src="${game.home.logo}" class="w-4 h-4 object-contain shrink-0" onerror="this.style.display='none'" />` : ''}
          <span class="font-sans text-sm text-ink truncate">${game.home.name}</span>
          ${game.home.record ? `<span class="font-mono text-[9px] text-ink-muted/50 tabular-nums">${game.home.record}</span>` : ''}
        </div>
      </div>

      <!-- Broadcast -->
      <div class="hidden sm:block shrink-0">
        ${game.broadcast ? `<span class="font-mono text-[10px] text-ink-muted/40">${game.broadcast}</span>` : ''}
      </div>
    </div>
  `;
}

/* ── Page ── */
export function SchedulePage(container) {
  const cleanups = [];
  let weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  // Start from today
  let selectedLeague = 'all';

  function getWeekDays() {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(shiftDay(weekStart, i));
    }
    return days;
  }

  function renderShell() {
    const days = getWeekDays();
    const weekLabel = `${days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${days[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

    container.innerHTML = `
      <div class="pt-6 opacity-0 animate-fade-up">
        <div class="mb-6">
          <h1 class="font-mono text-2xl sm:text-3xl font-bold tracking-tighter text-ink mb-1">Schedule</h1>
          <p class="font-sans text-sm text-ink-secondary">${weekLabel}</p>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-5 border-b border-ink-faint/8">
          <div class="flex items-center gap-1">
            <button class="filter-pill ${selectedLeague === 'all' ? 'active' : ''}" data-sched-league="all">All</button>
            ${SUPPORTED_LEAGUES.map(lg =>
              `<button class="filter-pill ${lg === selectedLeague ? 'active' : ''}" data-sched-league="${lg}">${getLeagueName(lg)}</button>`
            ).join('')}
          </div>
          <div class="flex items-center gap-1">
            <button class="w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center
                          text-ink-muted hover:text-ink transition-colors" data-week-shift="-7">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <button class="filter-pill" data-week-today>This Week</button>
            <button class="w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center
                          text-ink-muted hover:text-ink transition-colors" data-week-shift="7">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>

        <div id="schedule-content">
          <div class="flex justify-center py-16"><div class="w-6 h-6 border-2 border-ink-faint border-t-ink rounded-full animate-[spin_0.8s_linear_infinite]"></div></div>
        </div>
      </div>
    `;
  }

  async function loadSchedule() {
    const content = container.querySelector('#schedule-content');
    if (!content) return;
    content.innerHTML = `<div class="flex justify-center py-16"><div class="w-6 h-6 border-2 border-ink-faint border-t-ink rounded-full animate-[spin_0.8s_linear_infinite]"></div></div>`;

    const days = getWeekDays();

    try {
      const dayResults = await Promise.all(days.map(d => fetchDayAll(d, selectedLeague)));

      const hasAnyGames = dayResults.some(r => r.length > 0);
      if (!hasAnyGames) {
        content.innerHTML = `
          <div class="flex flex-col items-center justify-center py-20 text-center">
            <p class="font-mono text-xs text-ink-muted uppercase tracking-widest mb-2">No games scheduled</p>
            <p class="font-sans text-ink-secondary text-sm">Try a different week or league.</p>
          </div>
        `;
        return;
      }

      content.innerHTML = days.map((day, i) => {
        const games = dayResults[i];
        const today = isToday(day);
        const dayName = day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

        if (games.length === 0) {
          return `
            <div class="mb-6">
              <div class="flex items-center gap-2 mb-2">
                <h3 class="font-mono text-[11px] uppercase tracking-widest ${today ? 'text-accent font-semibold' : 'text-ink-muted'}">${today ? 'Today' : dayName}</h3>
                <div class="flex-1 h-px bg-ink-faint/10"></div>
                <span class="font-mono text-[10px] text-ink-muted/40">No games</span>
              </div>
            </div>
          `;
        }

        return `
          <div class="mb-6">
            <div class="flex items-center gap-2 mb-2">
              <h3 class="font-mono text-[11px] uppercase tracking-widest ${today ? 'text-accent font-semibold' : 'text-ink-muted'}">${today ? 'Today' : dayName}</h3>
              <div class="flex-1 h-px bg-ink-faint/10"></div>
              <span class="font-mono text-[10px] text-ink-muted/40">${games.length} game${games.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="rounded-2xl bg-surface-card border border-ink-faint/15 divide-y divide-ink-faint/5 overflow-hidden">
              ${games.map(g => renderGameRow(g)).join('')}
            </div>
          </div>
        `;
      }).join('');

    } catch (err) {
      console.error('Failed to load schedule:', err);
      content.innerHTML = `<p class="text-ink-muted text-center py-8 font-mono text-sm">Failed to load schedule</p>`;
    }
  }

  renderShell();
  loadSchedule();

  // League filter
  cleanups.push(delegate(container, 'click', '[data-sched-league]', (e, target) => {
    selectedLeague = target.dataset.schedLeague;
    container.querySelectorAll('[data-sched-league]').forEach(b => {
      b.classList.toggle('active', b.dataset.schedLeague === selectedLeague);
    });
    loadSchedule();
  }));

  // Week navigation
  cleanups.push(delegate(container, 'click', '[data-week-shift]', (e, target) => {
    const shift = parseInt(target.dataset.weekShift);
    weekStart = shiftDay(weekStart, shift);
    renderShell();
    loadSchedule();
  }));

  cleanups.push(delegate(container, 'click', '[data-week-today]', () => {
    weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    renderShell();
    loadSchedule();
  }));

  return () => cleanups.forEach(fn => fn());
}
