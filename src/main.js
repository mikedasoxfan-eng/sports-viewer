/**
 * Sports Viewer — App Entry Point
 */

import './styles/main.css';
import { checkAuth, AuthGate } from './components/AuthGate.js';
import { router } from './lib/router.js';
import { initStorage } from './lib/storage.js';
import { Shell } from './components/Shell.js';
import { GamesPage } from './pages/GamesPage.js';
import { WatchPage } from './pages/WatchPage.js';
import { StandingsPage } from './pages/StandingsPage.js';
import { ScoresPage } from './pages/ScoresPage.js';
import { StatsPage } from './pages/StatsPage.js';
import { SchedulePage } from './pages/SchedulePage.js';
import { PlayerPage } from './pages/PlayerPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { initKeyboardShortcuts } from './components/KeyboardShortcuts.js';
import { initSettingsModal } from './components/SettingsModal.js';

function bootApp() {
  const appRoot = document.getElementById('app');
  initStorage();

  const outlet = Shell(appRoot);
  router.setOutlet(outlet);

  router.register('/', GamesPage);
  router.register('/watch/:slug', WatchPage);
  router.register('/scores', ScoresPage);
  router.register('/standings', StandingsPage);
  router.register('/stats', StatsPage);
  router.register('/schedule', SchedulePage);
  router.register('/player/:id', PlayerPage);
  router.register('404', NotFoundPage);

  router.afterEach((current) => {
    document.querySelectorAll('[data-route]').forEach(el => {
      el.classList.toggle('active', current.pattern === el.dataset.route);
    });
  });

  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) document.body.classList.add('is-ios');
  if (window.matchMedia('(display-mode: standalone)').matches) document.body.classList.add('standalone');

  initKeyboardShortcuts();
  initSettingsModal();
  router.init();
}

async function init() {
  const auth = await checkAuth();

  if (auth.required && !auth.authenticated) {
    AuthGate(document.getElementById('app'), () => bootApp());
  } else {
    bootApp();
  }
}

// Unregister old service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(reg => reg.unregister());
  });
  if ('caches' in window) {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
