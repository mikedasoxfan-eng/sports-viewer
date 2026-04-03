/**
 * Standings page — league standings from ESPN.
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

export function StandingsPage(container) {
  const cleanups = [];
  let currentLeague = state.league !== 'all' ? state.league : 'nba';

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

  async function loadStandings() {
    const content = container.querySelector('#standings-content');
    if (!content) return;
    content.innerHTML = `<div class="flex justify-center py-16"><div class="w-6 h-6 border-2 border-ink-faint border-t-ink rounded-full animate-[spin_0.8s_linear_infinite]"></div></div>`;

    const url = ESPN_STANDINGS[currentLeague];
    if (!url) { content.innerHTML = '<p class="text-ink-muted text-center py-8">Unsupported league</p>'; return; }

    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      renderStandings(content, data);
    } catch (err) {
      content.innerHTML = `<p class="text-ink-muted text-center py-8 font-mono text-sm">Failed to load standings</p>`;
    }
  }

  function renderStandings(el, data) {
    const children = data.children || [];
    if (!children.length) {
      el.innerHTML = '<p class="text-ink-muted text-center py-8">No standings data</p>';
      return;
    }

    el.innerHTML = children.map(group => {
      const name = group.shortName || group.name || group.abbreviation || '';
      const entries = group.standings?.entries || [];

      return `
        <div class="mb-8">
          <h3 class="font-mono text-xs text-ink-muted uppercase tracking-widest mb-3">${name}</h3>
          <div class="rounded-2xl bg-surface-card border border-ink-faint/15 overflow-hidden">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-ink-faint/10">
                  <th class="text-left font-mono text-[10px] text-ink-muted uppercase tracking-widest px-4 py-2.5">#</th>
                  <th class="text-left font-mono text-[10px] text-ink-muted uppercase tracking-widest px-4 py-2.5">Team</th>
                  <th class="text-center font-mono text-[10px] text-ink-muted uppercase tracking-widest px-3 py-2.5">W</th>
                  <th class="text-center font-mono text-[10px] text-ink-muted uppercase tracking-widest px-3 py-2.5">L</th>
                  <th class="text-center font-mono text-[10px] text-ink-muted uppercase tracking-widest px-3 py-2.5 hidden sm:table-cell">${currentLeague === 'nhl' ? 'OTL' : 'PCT'}</th>
                  <th class="text-center font-mono text-[10px] text-ink-muted uppercase tracking-widest px-3 py-2.5 hidden sm:table-cell">STRK</th>
                </tr>
              </thead>
              <tbody>
                ${entries.map((entry, i) => {
                  const team = entry.team || {};
                  const stats = entry.stats || [];
                  const getStat = names => {
                    for (const s of stats) { if (names.includes(s.name)) return s.displayValue ?? s.value ?? '-'; }
                    return '-';
                  };
                  const logo = team.logos?.[0]?.href || '';
                  const pctStat = currentLeague === 'nhl'
                    ? getStat(['otLosses', 'overtimeLosses'])
                    : getStat(['winPercent', 'pointsPercentage']);

                  return `
                    <tr class="border-b border-ink-faint/5 last:border-0 hover:bg-surface-elevated/50 transition-colors">
                      <td class="px-4 py-2.5 font-mono text-xs text-ink-muted">${i + 1}</td>
                      <td class="px-4 py-2.5">
                        <div class="flex items-center gap-2.5">
                          ${logo ? `<div class="w-6 h-6 rounded shrink-0 overflow-hidden bg-surface-elevated flex items-center justify-center p-0.5"><img src="${logo}" class="w-full h-full object-contain" onerror="this.style.display='none'" /></div>` : ''}
                          <span class="font-sans text-sm font-medium text-ink truncate">${team.displayName || team.shortDisplayName || team.name || '?'}</span>
                        </div>
                      </td>
                      <td class="text-center px-3 py-2.5 font-mono text-sm text-ink tabular-nums">${getStat(['wins'])}</td>
                      <td class="text-center px-3 py-2.5 font-mono text-sm text-ink tabular-nums">${getStat(['losses'])}</td>
                      <td class="text-center px-3 py-2.5 font-mono text-sm text-ink-secondary tabular-nums hidden sm:table-cell">${pctStat}</td>
                      <td class="text-center px-3 py-2.5 font-mono text-sm text-ink-secondary tabular-nums hidden sm:table-cell">${getStat(['streak'])}</td>
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

  cleanups.push(delegate(container, 'click', '[data-standing-league]', (e, target) => {
    currentLeague = target.dataset.standingLeague;
    container.querySelectorAll('[data-standing-league]').forEach(b => {
      b.classList.toggle('active', b.dataset.standingLeague === currentLeague);
    });
    loadStandings();
  }));

  return () => cleanups.forEach(fn => fn());
}
