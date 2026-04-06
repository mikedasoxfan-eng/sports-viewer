/**
 * Standings page — ESPN standings with conference/division views and sorting.
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
  let viewMode = 'division'; // 'conference' | 'division'
  let sortCol = null;
  let sortAsc = false;
  let confData = null;  // conference-level (default)
  let divData = null;   // division-level (level=3)

  function renderShell() {
    container.innerHTML = `
      <div class="pt-6 opacity-0 animate-fade-up">
        <div class="mb-6">
          <h1 class="font-mono text-2xl sm:text-3xl font-bold tracking-tighter text-ink mb-1">Standings</h1>
          <p class="font-sans text-sm text-ink-secondary">Current season standings</p>
        </div>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-5 border-b border-ink-faint/8">
          <div class="flex items-center gap-1">
            ${SUPPORTED_LEAGUES.map(lg =>
              `<button class="filter-pill ${lg === currentLeague ? 'active' : ''}" data-standing-league="${lg}">${getLeagueName(lg)}</button>`
            ).join('')}
          </div>
          <div id="view-toggle"></div>
        </div>
        <div id="standings-content">
          <div class="flex justify-center py-16">
            <div class="w-6 h-6 border-2 border-ink-faint border-t-ink rounded-full animate-[spin_0.8s_linear_infinite]"></div>
          </div>
        </div>
      </div>
    `;
  }

  function renderViewToggle() {
    const mount = container.querySelector('#view-toggle');
    if (!mount) return;
    // Show division toggle for leagues that have meaningful divisions (not NBA)
    const showToggle = divData && currentLeague !== 'nba';
    if (!showToggle) {
      mount.innerHTML = '';
      return;
    }
    mount.innerHTML = `
      <div class="flex items-center gap-1 p-0.5 rounded-lg bg-surface-elevated">
        <button class="filter-pill ${viewMode === 'conference' ? 'active' : ''}" data-view="conference">Conference</button>
        <button class="filter-pill ${viewMode === 'division' ? 'active' : ''}" data-view="division">Division</button>
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

  function buildSections() {
    const data = viewMode === 'division' ? divData : confData;
    if (!data) return [];
    const topChildren = data.children || [];
    if (!topChildren.length) return [];

    const sections = [];

    for (const conf of topChildren) {
      const confName = conf.shortName || conf.name || '';
      const divisions = conf.children || [];
      const confEntries = conf.standings?.entries || [];

      if (divisions.length > 0) {
        // Has divisions: conference header + division tables
        sections.push({ type: 'conference-header', name: confName });
        for (const div of divisions) {
          const divName = div.shortName || div.name || '';
          const divEntries = div.standings?.entries || [];
          if (divEntries.length > 0) {
            sections.push({ type: 'division', name: divName, entries: divEntries });
          }
        }
      } else if (confEntries.length > 0) {
        // Flat conference entries
        sections.push({ type: 'conference', name: confName, entries: confEntries });
      }
    }

    return sections;
  }

  function renderTable(entries, cols) {
    const sorted = sortEntries(entries);

    return `
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
                  ${c.label}${sortCol === c.key ? (sortAsc ? ' \u2191' : ' \u2193') : ''}
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${sorted.map((entry, i) => {
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
                              ${c.key.includes('ifferential') ? (getStatNum(stats, [c.key]) > 0 ? 'text-green-600 dark:text-green-400' : getStatNum(stats, [c.key]) < 0 ? 'text-red-500 dark:text-red-400' : 'text-ink') : 'text-ink'}">
                      ${getStat(stats, [c.key])}
                    </td>
                  `).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async function loadStandings() {
    const content = container.querySelector('#standings-content');
    if (!content) return;
    content.innerHTML = `<div class="flex justify-center py-16"><div class="w-6 h-6 border-2 border-ink-faint border-t-ink rounded-full animate-[spin_0.8s_linear_infinite]"></div></div>`;
    sortCol = null;

    const base = ESPN_STANDINGS[currentLeague];
    try {
      const [confRes, divRes] = await Promise.all([
        fetch(base, { headers: { Accept: 'application/json' } }),
        fetch(`${base}?level=3`, { headers: { Accept: 'application/json' } }),
      ]);
      if (!confRes.ok) throw new Error(confRes.status);
      confData = await confRes.json();
      divData = divRes.ok ? await divRes.json() : null;
      // NBA: always conference view (divisions are irrelevant)
      if (currentLeague === 'nba') viewMode = 'conference';
      renderViewToggle();
      renderStandings(content);
    } catch {
      content.innerHTML = `<p class="text-ink-muted text-center py-8 font-mono text-sm">Failed to load standings</p>`;
    }
  }

  function renderStandings(el) {
    if (!confData && !divData) return;
    const sections = buildSections();
    if (!sections.length) { el.innerHTML = '<p class="text-ink-muted text-center py-8">No standings data</p>'; return; }
    const cols = COLUMNS[currentLeague] || COLUMNS.nba;

    el.innerHTML = sections.map(section => {
      if (section.type === 'conference-header') {
        return `
          <div class="mt-8 first:mt-0 mb-4">
            <h2 class="font-mono text-sm font-semibold text-ink tracking-tight">${section.name}</h2>
          </div>
        `;
      }

      if (section.type === 'division') {
        return `
          <div class="mb-6 ml-0 sm:ml-2">
            <h3 class="font-mono text-[11px] text-ink-muted uppercase tracking-widest mb-2 flex items-center gap-2">
              <span class="w-1 h-1 rounded-full bg-accent"></span>
              ${section.name}
            </h3>
            ${renderTable(section.entries, cols)}
          </div>
        `;
      }

      // conference (flat view)
      return `
        <div class="mb-8">
          <h3 class="font-mono text-xs text-ink-muted uppercase tracking-widest mb-3">${section.name}</h3>
          ${renderTable(section.entries, cols)}
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

  // View mode toggle
  cleanups.push(delegate(container, 'click', '[data-view]', (e, target) => {
    viewMode = target.dataset.view;
    container.querySelectorAll('[data-view]').forEach(b => {
      b.classList.toggle('active', b.dataset.view === viewMode);
    });
    sortCol = null;
    sortAsc = false;
    const content = container.querySelector('#standings-content');
    if (content) renderStandings(content);
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
