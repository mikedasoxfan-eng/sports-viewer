/**
 * App Shell — renders the outer container, navbar, and router outlet.
 * Returns the outlet element for the router to render into.
 */

import { Navbar } from './Navbar.js';

export function Shell(root) {
  root.innerHTML = `
    <div class="min-h-[100dvh] bg-surface font-sans text-ink">
      <div class="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div id="navbar-mount" class="sticky top-4 z-40 pt-4 pb-2"></div>
        <main id="router-outlet" class="pb-16"></main>
        <footer class="py-12 text-center border-t border-ink-faint/10">
          <p class="font-mono text-[11px] text-ink-muted tracking-wider uppercase">
            Sports Viewer
          </p>
        </footer>
      </div>
    </div>
  `;

  Navbar(root.querySelector('#navbar-mount'));
  return root.querySelector('#router-outlet');
}
