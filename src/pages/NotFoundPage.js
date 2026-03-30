/**
 * 404 page.
 */

export function NotFoundPage(container) {
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-32 text-center">
      <p class="font-mono text-6xl font-bold text-ink-faint mb-4">404</p>
      <p class="font-sans text-ink-secondary mb-8">This page doesn't exist.</p>
      <a href="#/" class="px-5 py-2.5 rounded-full bg-ink text-surface-card text-sm font-medium
                          transition-all duration-300 ease-smooth hover:bg-ink/90 active:scale-[0.97]
                          no-underline">
        Back to Games
      </a>
    </div>
  `;
}
