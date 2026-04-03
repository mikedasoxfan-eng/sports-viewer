/**
 * Standings page — full ESPN standings with sorting, expanded stats.
 */

import { state } from '../lib/state.js';
import { SUPPORTED_LEAGUES, getLeagueName } from '../config.js';
import { delegate } from '../lib/dom.js';

const ESPN_STANDINGS = {
  nfl: 'https://site.api.espn.com/apis/v2/sports/football/nfl/standings',
  nba: 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings',
  mlb: 'https://site.api.espn.com/apis/v2/sports/baseball/mlb/standings',
  nhl: 'https://site.api.espn.com/apis/v2/sports/hockey/nhl/standings'
};

// Columns per league
const COLUMNS = {
  nba: [
    { key: 'wins', label: 'W', align: 'center' },
    { key: 'losses', label: 'L', align: 'center' },
    { key: 'winPercent', label: 'PCT', align: 'center', hide: 'sm' },
    { key: 'gamesBehind', label: 'GB', align: 'center', hide: 'sm' },
    { key: 'pointDifferential', label: '+/-', align: 'center', hide: 'md' },
    { key: 'streak', label: 'STRK', align: 'center', hide: 'md' },
    { key: 'Last Ten Games', label: 'L10', align: 'center', hide: 'lg' },
  ],
  nfl: [
    { key: 'wins', label: 'W', align: 'center' },
    { key: 'losses', label: 'L', align: 'center' },
    { key: 'winPercent', label: 'PCT', align: 'center', hide: 'sm' },
    { key: 'pointsFor', label: 'PF', align: 'center', hide: 'sm' },
    { key: 'pointsAgainst', label: 'PA', align: 'center', hide: 'md' },
    { key: 'differential', label: '+/-', align: 'center', hide: 'md' },
    { key: 'streak', label: 'STRK', align: 'center', hide: 'lg' },
  ],
  mlb: [
    { key: 'wins', label: 'W', align: 'center' },
    { key: 'losses', label: 'L', align: 'center' },
    { key: 'winPercent', label: 'PCT', align: 'center', hide: 'sm' },
    { key: 'gamesBehind', label: 'GB', align: 'center', hide: 'sm' },
    { key: 'differential', label: '+/-', align: 'center', hide: 'md' },
    { key: 'streak', label: 'STRK', align: 'center', hide: 'md' },
    { key: 'Last Ten Games', label: 'L10', align: 'center', hide: 'lg' },
  ],
  nhl: [
    { key: 'wins', label: 'W', align: 'center' },
    { key: 'losses', label: 'L', align: 'center' },
    { key: 'otLosses', label: 'OTL', align: 'center' },
    { key: 'points', label: 'PTS', align: 'center', hide: 'sm' },
    { key: 'pointDifferential', label: '+/-', align: 'center', hide: 'md' },
    { key: 'streak', label: 'STRK', align: 'center', hide: 'md' },
  ],
};

export function StandingsPage(container) {
  const cleanups = [];
  let currentLeague = state.league !== 'all' ? state.league : 'nba';
  let sortCol = null;
  let sortAsc = false;
  let rawData = null;

  function renderShell() {
    container.innerHTML = `
      <div class="pt-6 opacity-0 animate-fade-up">
        <div class="mb-6">
          <h1 class="font-mono text-2xl sm:text-3xl font-bold tracking-tighter text-ink mb-1">Standings</h1>
          <p class="font-sans text-sm text-ink-secondary">Current season standings</p>
        </div>
        <div class="flex items-center gap-1 mb-6 pb-5 border-b border-ink-faint/8">
          ${SUPPORTED_LEAGUES.map(lg =>
            `<button class="filter-pill ${lg === currentLeague ? 'active' : ''}" data-standing-league="${lg}">${getLeagueName(lg)}</button>`
          ).join('')}
        </div>
        <div id="standings-content">
          <div class="flex justify-center py-16">
            <div class="w-6 h-6 border-2 border-ink-faint border-t-ink rounded-full animate-[spin_0.8s_linear_infinite]"></div>
          </div>
        </div>
      </div>
    `;
  }

  function getStat(stats, names) {
    if (!Array.isArray(names)) names = [names];
    for (const s of stats || []) {
      if (names.includes(s.name)) return s.displayValue ?? s.value ?? '-';
    }
    return '-';
  }

  function getStatNum(stats, names) {
    const v = getStat(stats, names);
    if (v === '-') return -Infinity;
    const n = parseFloat(v);
    return isNaN(n) ? -Infinity : n;
  }

  function sortEntries(entries) {
    if (!sortCol) return entries;
    return [...entries].sort((a, b) => {
      const av = getStatNum(a.stats, [sortCol]);
      const bv = getStatNum(b.stats, [sortCol]);
      return sortAsc ? av - bv : bv - av;
    });
  }

  async function loadStandings() {
    const content = container.querySelector('#standings-content');
    if (!content) return;
    content.innerHTML = `<div class="flex justify-center py-16"><div class="w-6 h-6 border-2 border-ink-faint border-t-ink rounded-full animate-[spin_0.8s_linear_infinite]"></div></div>`;
    sortCol = null;

    try {
      const res = await fetch(ESPN_STANDINGS[currentLeague], { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(res.status);
      rawData = await res.json();
      renderStandings(content);
    } catch {
      content.innerHTML = `<p class="text-ink-muted text-center py-8 font-mono text-sm">Failed to load standings</p>`;
    }
  }

  function renderStandings(el) {
    if (!rawData) return;
    const children = rawData.children || [];
    if (!children.length) { el.innerHTML = '<p class="text-ink-muted text-center py-8">No standings data</p>'; return; }
    const cols = COLUMNS[currentLeague] || COLUMNS.nba;

    el.innerHTML = children.map(group => {
      const name = group.shortName || group.name || '';
      const entries = sortEntries(group.standings?.entries || []);

      return `
        <div class="mb-8">
          <h3 class="font-mono text-xs text-ink-muted uppercase tracking-widest mb-3">${name}</h3>
          <div class="rounded-2xl bg-surface-card border border-ink-faint/15 overflow-x-auto">
            <table class="w-full text-sm min-w-[400px]">
              <thead>
                <tr class="border-b border-ink-faint/10">
                  <th class="text-left font-mono text-[10px] text-ink-muted uppercase tracking-widest px-3 py-2.5 w-8">#</th>
                  <th class="text-left font-mono text-[10px] text-ink-muted uppercase tracking-widest px-3 py-2.5">Team</th>
                  ${cols.map(c => `
                    <th class="text-${c.align} font-mono text-[10px] uppercase tracking-widest px-2 py-2.5 cursor-pointer
                              select-none transition-colors hover:text-ink
                              ${sortCol === c.key ? 'text-accent' : 'text-ink-muted'}
                              ${c.hide === 'sm' ? 'hidden sm:table-cell' : ''}
                              ${c.hide === 'md' ? 'hidden md:table-cell' : ''}
                              ${c.hide === 'lg' ? 'hidden lg:table-cell' : ''}"
                        data-sort-col="${c.key}">
                      ${c.label}${sortCol === c.key ? (sortAsc ? ' ↑' : ' ↓') : ''}
                    </th>
                  `).join('')}
                </tr>
              </thead>
              <tbody>
                ${entries.map((entry, i) => {
                  const team = entry.team || {};
                  const stats = entry.stats || [];
                  const logo = team.logos?.[0]?.href || '';
                  const seed = getStat(stats, ['playoffSeed']);
                  const clincher = getStat(stats, ['clincher']);
                  const seedBadge = seed !== '-' && seed !== '' ? `<span class="font-mono text-[10px] text-ink-muted">${seed}</span>` : '';
                  const clinchBadge = clincher !== '-' && clincher !== '' ? `<span class="font-mono text-[9px] text-accent ml-0.5">${clincher}</span>` : '';

                  return `
                    <tr class="border-b border-ink-faint/5 last:border-0 hover:bg-surface-elevated/50 transition-colors">
                      <td class="px-3 py-2.5 font-mono text-xs text-ink-muted">${i + 1}</td>
                      <td class="px-3 py-2.5">
                        <div class="flex items-center gap-2">
                          ${logo ? `<div class="w-6 h-6 rounded shrink-0 overflow-hidden bg-surface-elevated flex items-center justify-center p-0.5"><img src="${logo}" class="w-full h-full object-contain" onerror="this.style.display='none'" /></div>` : ''}
                          <span class="font-sans text-sm font-medium text-ink truncate">${team.shortDisplayName || team.displayName || '?'}</span>
                          ${seedBadge}${clinchBadge}
                        </div>
                      </td>
                      ${cols.map(c => `
                        <td class="text-${c.align} px-2 py-2.5 font-mono text-sm tabular-nums
                                  ${c.hide === 'sm' ? 'hidden sm:table-cell' : ''}
                                  ${c.hide === 'md' ? 'hidden md:table-cell' : ''}
                                  ${c.hide === 'lg' ? 'hidden lg:table-cell' : ''}
                                  ${c.key.includes('ifferential') ? (getStatNum(stats, [c.key]) > 0 ? 'text-live' : getStatNum(stats, [c.key]) < 0 ? 'text-live' : 'text-ink') : 'text-ink'}">
                          ${getStat(stats, [c.key])}
                        </td>
                      `).join('')}
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');
  }

  renderShell();
  loadStandings();

  // League switch
  cleanups.push(delegate(container, 'click', '[data-standing-league]', (e, target) => {
    currentLeague = target.dataset.standingLeague;
    container.querySelectorAll('[data-standing-league]').forEach(b => {
      b.classList.toggle('active', b.dataset.standingLeague === currentLeague);
    });
    loadStandings();
  }));

  // Column sorting
  cleanups.push(delegate(container, 'click', '[data-sort-col]', (e, target) => {
    const col = target.dataset.sortCol;
    if (sortCol === col) {
      sortAsc = !sortAsc;
    } else {
      sortCol = col;
      sortAsc = false;
    }
    const content = container.querySelector('#standings-content');
    if (content) renderStandings(content);
  }));

  return () => cleanups.forEach(fn => fn());
}
