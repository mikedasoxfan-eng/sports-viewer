/**
 * Asymmetric bento grid of game cards with favorites section.
 */

import { renderGameCard } from './GameCard.js';

function emptyState() {
  return `
    <div class="flex flex-col items-center justify-center py-24 text-center">
      <div class="w-14 h-14 rounded-2xl bg-surface-elevated flex items-center justify-center mb-5">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-ink-muted">
          <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M9 21V9"/>
        </svg>
      </div>
      <p class="font-mono text-xs text-ink-muted uppercase tracking-widest mb-2">No games found</p>
      <p class="font-sans text-ink-secondary text-sm max-w-[36ch] leading-relaxed">
        Try changing your filters or check back later.
      </p>
    </div>
  `;
}

function renderGrid(games, startIndex = 0) {
  return `<div class="games-bento">
    ${games.map((game, i) => renderGameCard(game, startIndex + i)).join('')}
  </div>`;
}

export function GameGrid(container, games, favorites = new Set()) {
  if (!games || games.length === 0) {
    container.innerHTML = emptyState();
    return;
  }

  const favGames = favorites.size > 0 ? games.filter(g => favorites.has(g.slug)) : [];
  const otherGames = favorites.size > 0 ? games.filter(g => !favorites.has(g.slug)) : games;

  // Only show sections if there are both favorites and non-favorites
  if (favGames.length > 0 && otherGames.length > 0) {
    container.innerHTML = `
      <div class="space-y-6">
        <div>
          <div class="section-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" class="text-accent">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Favorites
          </div>
          ${renderGrid(favGames, 0)}
        </div>
        <div>
          <div class="section-label">All Games</div>
          ${renderGrid(otherGames, favGames.length)}
        </div>
      </div>
    `;
  } else {
    container.innerHTML = renderGrid(games, 0);
  }
}
