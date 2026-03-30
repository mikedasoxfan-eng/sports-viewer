/**
 * Watch page — stream player with matchup header.
 */

import { fetchGameBySlug } from '../lib/api.js';
import { enrichGame } from '../lib/enrich.js';
import { StreamPlayer } from '../components/StreamPlayer.js';
import { WatchPageSkeleton } from '../components/Loader.js';

export function WatchPage(container, params, query) {
  const slug = params.slug;
  const league = query.league || 'all';
  const cleanups = [];

  container.innerHTML = `<div class="pt-6">${WatchPageSkeleton()}</div>`;

  async function load() {
    const raw = await fetchGameBySlug(slug, league);
    const game = raw ? enrichGame(raw) : null;

    const away = game?.awayTeam || {};
    const home = game?.homeTeam || {};
    const awayName = away.name || away.displayName || game?.title?.split(/\s+vs\.?\s+/i)?.[0] || slug;
    const homeName = home.name || home.displayName || game?.title?.split(/\s+vs\.?\s+/i)?.[1] || '';
    const title = game?.displayTitle || `${awayName}${homeName ? ' vs ' + homeName : ''}`;

    document.title = `${title} — Sports Viewer`;

    container.innerHTML = `
      <div class="pt-6 space-y-5 opacity-0 animate-fade-up">
        <a href="#/" class="inline-flex items-center gap-2 font-mono text-[11px] uppercase
                          tracking-widest text-ink-muted hover:text-ink
                          transition-colors duration-300 ease-smooth no-underline group">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
               class="transition-transform duration-300 ease-smooth group-hover:-translate-x-0.5">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Back
        </a>

        <div class="flex items-center justify-center gap-5 py-3">
          <div class="flex items-center gap-3 min-w-0">
            ${away.logo
              ? `<div class="w-10 h-10 rounded-lg bg-surface-elevated shrink-0 flex items-center justify-center overflow-hidden p-1.5"><img src="${away.logo}" alt="" class="w-full h-full object-contain" onerror="this.style.display='none'" /></div>`
              : `<div class="w-10 h-10 rounded-lg bg-surface-elevated shrink-0"></div>`}
            <span class="font-sans font-semibold text-ink text-[15px] truncate">${awayName}</span>
          </div>
          <span class="font-mono text-ink-muted/50 text-xs uppercase tracking-widest shrink-0">vs</span>
          <div class="flex items-center gap-3 min-w-0">
            <span class="font-sans font-semibold text-ink text-[15px] truncate">${homeName}</span>
            ${home.logo
              ? `<div class="w-10 h-10 rounded-lg bg-surface-elevated shrink-0 flex items-center justify-center overflow-hidden p-1.5"><img src="${home.logo}" alt="" class="w-full h-full object-contain" onerror="this.style.display='none'" /></div>`
              : `<div class="w-10 h-10 rounded-lg bg-surface-elevated shrink-0"></div>`}
          </div>
        </div>

        <div id="player-mount"></div>
      </div>
    `;

    const playerCleanup = StreamPlayer(
      container.querySelector('#player-mount'),
      { slug, game, sources: game?.sources || [] }
    );
    cleanups.push(playerCleanup);
  }

  load();

  return () => {
    document.title = 'Sports Viewer';
    cleanups.forEach(fn => fn());
  };
}
