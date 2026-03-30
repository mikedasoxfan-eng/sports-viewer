/**
 * Watch page — live score bar + stream player.
 */

import { fetchGameBySlug, fetchScoreboard, buildScoreIndex, extractScore, normalizeTeamName } from '../lib/api.js';
import { enrichGame } from '../lib/enrich.js';
import { StreamPlayer } from '../components/StreamPlayer.js';
import { WatchPageSkeleton } from '../components/Loader.js';
import { state } from '../lib/state.js';

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
    const gameLeague = game?.league || league;

    document.title = `${title} — Sports Viewer`;

    function logoHtml(team, size = 'w-10 h-10') {
      if (!team?.logo) return `<div class="${size} rounded-lg bg-surface-elevated shrink-0"></div>`;
      return `<div class="${size} rounded-lg bg-surface-elevated shrink-0 flex items-center justify-center overflow-hidden p-1.5"><img src="${team.logo}" alt="" class="w-full h-full object-contain" onerror="this.style.display='none'" /></div>`;
    }

    container.innerHTML = `
      <div class="pt-6 space-y-4 opacity-0 animate-fade-up">
        <a href="#/" class="inline-flex items-center gap-2 font-mono text-[11px] uppercase
                          tracking-widest text-ink-muted hover:text-ink
                          transition-colors duration-300 ease-smooth no-underline group">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
               class="transition-transform duration-300 ease-smooth group-hover:-translate-x-0.5">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Back
        </a>

        <!-- Live score bar -->
        <div id="score-bar" class="rounded-2xl bg-surface-card shadow-card border border-ink-faint/15 px-5 py-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3 min-w-0 flex-1">
              ${logoHtml(away, 'w-8 h-8')}
              <span class="font-sans font-semibold text-ink text-sm truncate">${awayName}</span>
              <span id="away-score" class="font-mono text-xl font-bold text-ink tabular-nums ml-auto">${away.score ?? '-'}</span>
            </div>
            <div class="px-4 text-center shrink-0">
              <span id="game-status" class="font-mono text-[10px] text-ink-muted uppercase tracking-widest">${game?.statusDetail || (game?.isLive ? 'Live' : game?.formattedTime || '')}</span>
            </div>
            <div class="flex items-center gap-3 min-w-0 flex-1 flex-row-reverse">
              ${logoHtml(home, 'w-8 h-8')}
              <span class="font-sans font-semibold text-ink text-sm truncate">${homeName}</span>
              <span id="home-score" class="font-mono text-xl font-bold text-ink tabular-nums mr-auto">${home.score ?? '-'}</span>
            </div>
          </div>
        </div>

        <div id="player-mount"></div>
      </div>
    `;

    // Stream player
    const playerCleanup = StreamPlayer(
      container.querySelector('#player-mount'),
      { slug, game }
    );
    cleanups.push(playerCleanup);

    // Auto-update scores every 30s
    async function updateScores() {
      if (!state.settings.showScores) return;
      try {
        const sb = await fetchScoreboard(gameLeague);
        if (!sb) return;
        const index = buildScoreIndex(sb);

        let event = null;
        if (away.abbreviation && home.abbreviation) {
          const key = [away.abbreviation.toUpperCase(), home.abbreviation.toUpperCase()].sort().join('|');
          event = index.byAbbr.get(key);
        }
        if (!event) {
          const an = normalizeTeamName(awayName);
          const hn = normalizeTeamName(homeName);
          if (an && hn) event = index.byName.get([an, hn].sort().join('|'));
        }
        if (event) {
          const comps = event?.competitions?.[0]?.competitors || [];
          const ac = comps.find(c => c?.homeAway === 'away') || comps[0];
          const hc = comps.find(c => c?.homeAway === 'home') || comps[1];
          const as = extractScore(ac);
          const hs = extractScore(hc);
          const status = event?.competitions?.[0]?.status?.type || {};
          const detail = status.shortDetail || status.detail || '';

          const awayEl = container.querySelector('#away-score');
          const homeEl = container.querySelector('#home-score');
          const statusEl = container.querySelector('#game-status');
          if (awayEl && as != null) awayEl.textContent = as;
          if (homeEl && hs != null) homeEl.textContent = hs;
          if (statusEl && detail) statusEl.textContent = detail;
        }
      } catch {}
    }

    updateScores();
    const scoreInterval = setInterval(updateScores, 30_000);
    cleanups.push(() => clearInterval(scoreInterval));
  }

  load();

  return () => {
    document.title = 'Sports Viewer';
    cleanups.forEach(fn => fn());
  };
}
