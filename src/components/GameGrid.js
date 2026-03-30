/**
 * Asymmetric bento grid of game cards.
 */

import { renderGameCard } from './GameCard.js';

export function GameGrid(container, games) {
  if (!games || games.length === 0) {
    container.innerHTML = `
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
    return;
  }

  container.innerHTML = `
    <div class="games-bento">
      ${games.map((game, i) => renderGameCard(game, i)).join('')}
    </div>
  `;
}
