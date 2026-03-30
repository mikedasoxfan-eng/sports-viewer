/**
 * Single game card — double-bezel design with staggered entry.
 */

import { state } from '../lib/state.js';

function teamLogo(team) {
  if (!team?.logo) {
    return `<div class="w-8 h-8 rounded-lg bg-surface-elevated shrink-0"></div>`;
  }
  return `<div class="w-8 h-8 rounded-lg bg-surface-elevated shrink-0 flex items-center justify-center overflow-hidden p-1">
    <img src="${team.logo}" alt="" class="w-full h-full object-contain" loading="lazy" onerror="this.style.display='none'" />
  </div>`;
}

function formatScore(team) {
  if (!state.settings.showScores) return '';
  const s = team?.score;
  if (s == null || s === '') return '';
  return `<span class="font-mono text-base font-semibold text-ink tabular-nums ml-auto shrink-0">${s}</span>`;
}

function statusBadge(game) {
  if (game.isLive) {
    return `<span class="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-live">
      <span class="w-1.5 h-1.5 rounded-full bg-live animate-pulse-live"></span>
      Live
    </span>`;
  }
  if (game.isEnded) {
    return `<span class="font-mono text-[11px] font-medium uppercase tracking-wider text-ink-muted">Final</span>`;
  }
  return `<span class="font-mono text-[11px] font-medium text-ink-muted">${game.formattedTime || 'TBD'}</span>`;
}

export function renderGameCard(game, index = 0) {
  const away = game.awayTeam || {};
  const home = game.homeTeam || {};
  const league = game.league || 'nfl';
  const leagueQuery = `?league=${league}`;
  const awayName = away.name || away.displayName || game.title?.split(/\s+vs\.?\s+/i)?.[0] || 'TBD';
  const homeName = home.name || home.displayName || game.title?.split(/\s+vs\.?\s+/i)?.[1] || 'TBD';

  return `
    <article class="game-card group relative rounded-3xl bg-surface-card
                    shadow-card hover:shadow-card-hover
                    border border-ink-faint/15
                    transition-all duration-500 ease-smooth
                    hover:-translate-y-0.5
                    active:scale-[0.98]
                    overflow-hidden
                    opacity-0 animate-fade-up"
             style="animation-delay: ${index * 50}ms"
             data-slug="${game.slug || ''}"
             data-league="${league}"
             data-live="${game.isLive || false}">

      <div class="m-1.5 rounded-[1.25rem] bg-surface/40 p-5
                  shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">

        <div class="flex items-center justify-between mb-3">
          ${statusBadge(game)}
          <span class="font-mono text-[10px] text-ink-muted/60 uppercase tracking-widest">${league.toUpperCase()}</span>
        </div>

        <div class="space-y-2">
          <div class="flex items-center gap-3 min-w-0">
            ${teamLogo(away)}
            <span class="font-sans font-medium text-ink text-[15px] truncate">${awayName}</span>
            ${formatScore(away)}
          </div>
          <div class="flex items-center gap-3 min-w-0">
            ${teamLogo(home)}
            <span class="font-sans font-medium text-ink text-[15px] truncate">${homeName}</span>
            ${formatScore(home)}
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-ink-faint/8">
          <a href="#/watch/${game.slug || ''}${leagueQuery}"
             data-action="watch"
             class="block text-center py-2.5 rounded-2xl bg-ink text-surface-card
                    text-[13px] font-medium font-sans
                    transition-all duration-300 ease-smooth
                    hover:bg-ink/90 active:scale-[0.97]
                    no-underline">
            Watch
          </a>
        </div>
      </div>
    </article>
  `;
}
