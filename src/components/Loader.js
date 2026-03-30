/**
 * Skeleton/shimmer loading states.
 */

export function GameCardSkeleton(index = 0) {
  return `
    <div class="game-card rounded-3xl bg-surface-card border border-ink-faint/10 overflow-hidden
                opacity-0 animate-fade-up" style="animation-delay: ${index * 50}ms">
      <div class="m-1.5 rounded-[1.25rem] p-5 space-y-3">
        <div class="flex items-center justify-between">
          <div class="skeleton h-3 w-14 rounded-full"></div>
          <div class="skeleton h-3 w-7 rounded-full"></div>
        </div>
        <div class="space-y-2">
          <div class="flex items-center gap-3">
            <div class="skeleton w-8 h-8 rounded-full shrink-0"></div>
            <div class="skeleton h-4 w-28 rounded"></div>
          </div>
          <div class="flex items-center gap-3">
            <div class="skeleton w-8 h-8 rounded-full shrink-0"></div>
            <div class="skeleton h-4 w-24 rounded"></div>
          </div>
        </div>
        <div class="pt-3 border-t border-ink-faint/8">
          <div class="skeleton h-10 w-full rounded-2xl"></div>
        </div>
      </div>
    </div>
  `;
}

export function GamesGridSkeleton(count = 6) {
  return `
    <div class="games-bento">
      ${Array.from({ length: count }, (_, i) => GameCardSkeleton(i)).join('')}
    </div>
  `;
}

export function WatchPageSkeleton() {
  return `
    <div class="space-y-6 opacity-0 animate-fade-up">
      <div class="skeleton h-4 w-20 rounded-full"></div>
      <div class="flex items-center justify-center gap-6 py-4">
        <div class="flex items-center gap-3">
          <div class="skeleton w-10 h-10 rounded-full"></div>
          <div class="skeleton h-5 w-24 rounded"></div>
        </div>
        <div class="skeleton h-4 w-4 rounded"></div>
        <div class="flex items-center gap-3">
          <div class="skeleton h-5 w-24 rounded"></div>
          <div class="skeleton w-10 h-10 rounded-full"></div>
        </div>
      </div>
      <div class="rounded-4xl bg-surface-card border border-ink-faint/10 p-2">
        <div class="rounded-[1.75rem] skeleton aspect-video"></div>
      </div>
    </div>
  `;
}
