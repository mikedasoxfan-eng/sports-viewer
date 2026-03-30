/**
 * Stream player — source/stream selectors + mobile ad click shield.
 */

import { buildEmbedUrl, createSecureIframe } from '../lib/embed.js';
import { MAX_STREAMS } from '../config.js';
import { activateGuard } from '../lib/guard.js';

const SOURCE_NAMES = {
  admin: 'Admin', charlie: 'Charlie', delta: 'Delta',
  echo: 'Echo', golf: 'Golf', alpha: 'Alpha',
  bravo: 'Bravo', foxtrot: 'Foxtrot', hotel: 'Hotel', intel: 'Intel'
};

const DEFAULT_SOURCES = ['admin', 'charlie', 'delta', 'echo', 'golf'];

export function StreamPlayer(container, { slug, game }) {
  const gameSources = game?.sources?.length
    ? [...new Set(game.sources.map(s => s.source).filter(Boolean))]
    : DEFAULT_SOURCES;

  let currentSource = gameSources[0] || 'admin';
  let currentStream = 1;
  let iframeEl = null;

  function render() {
    container.innerHTML = `
      <div class="rounded-4xl bg-surface-card shadow-diffused border border-ink-faint/15 p-2
                  transition-shadow duration-500 ease-smooth">
        <div class="rounded-[1.75rem] bg-ink overflow-hidden aspect-video relative" id="embed-box">
          <div id="embed-loading" class="absolute inset-0 flex items-center justify-center bg-ink z-10">
            <div class="flex flex-col items-center gap-3">
              <div class="w-6 h-6 border-2 border-surface-card/30 border-t-surface-card rounded-full animate-[spin_0.8s_linear_infinite]"></div>
              <span class="font-mono text-xs text-surface-card/60 uppercase tracking-wider">Loading stream</span>
            </div>
          </div>
          <div id="embed-error" class="absolute inset-0 flex items-center justify-center bg-ink z-10 hidden">
            <div class="flex flex-col items-center gap-4 text-center px-6">
              <div class="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-surface-card/60">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                </svg>
              </div>
              <p class="font-mono text-xs text-surface-card/60 uppercase tracking-wider">Stream unavailable</p>
              <p class="font-sans text-xs text-surface-card/40">Try a different source or stream</p>
            </div>
          </div>

          <!-- Click shield: absorbs ad overlay taps on mobile -->
          <div id="click-shield" class="absolute inset-0 z-20 flex items-center justify-center cursor-pointer"
               style="background: rgba(0,0,0,0.4)">
            <div class="flex flex-col items-center gap-2">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="white" opacity="0.9">
                <polygon points="5,3 19,12 5,21"/>
              </svg>
              <span class="font-mono text-xs text-white/70 uppercase tracking-wider">Tap to play</span>
            </div>
          </div>

          <div id="embed-target" class="absolute inset-0"></div>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4
                  rounded-2xl bg-surface-card shadow-card border border-ink-faint/15 p-3">
        <div class="flex items-center gap-4 flex-wrap">
          <div class="flex items-center gap-2">
            <label class="font-mono text-[10px] text-ink-muted uppercase tracking-widest">Source</label>
            <select id="source-select" class="font-mono text-xs bg-surface-elevated border border-ink-faint/20
                      rounded-lg px-2.5 py-1.5 text-ink cursor-pointer
                      transition-all duration-300 ease-smooth hover:border-ink-faint/40
                      focus:outline-none focus:ring-2 focus:ring-accent/30">
              ${gameSources.map(s => `
                <option value="${s}" ${s === currentSource ? 'selected' : ''}>
                  ${SOURCE_NAMES[s] || s}
                </option>
              `).join('')}
            </select>
          </div>
          <div class="flex items-center gap-2">
            <label class="font-mono text-[10px] text-ink-muted uppercase tracking-widest">Stream</label>
            <div class="flex gap-1" id="stream-pills">
              ${Array.from({ length: MAX_STREAMS }, (_, i) => `
                <button class="w-8 h-8 rounded-lg font-mono text-xs font-medium
                              transition-all duration-300 ease-smooth active:scale-[0.95]
                              ${i + 1 === currentStream
                                ? 'bg-ink text-surface-card shadow-bezel'
                                : 'bg-surface-elevated text-ink-secondary hover:text-ink'}"
                        data-stream="${i + 1}">
                  ${i + 1}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
        <button id="fullscreen-btn" class="px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-widest
                  text-ink-muted bg-surface-elevated border border-ink-faint/20
                  transition-all duration-300 ease-smooth hover:text-ink hover:border-ink-faint/40
                  active:scale-[0.97]">
          Fullscreen
        </button>
      </div>
    `;
    bindEvents();
    loadStream();
  }

  function loadStream() {
    const url = buildEmbedUrl(slug, currentStream, currentSource);
    if (!url) { showError(); return; }

    showLoading();

    const target = container.querySelector('#embed-target');
    if (iframeEl) { iframeEl.src = 'about:blank'; iframeEl.remove(); iframeEl = null; }

    iframeEl = createSecureIframe(url, game?.displayTitle || 'Game Stream');
    if (!iframeEl) { showError(); return; }

    iframeEl.addEventListener('load', () => {
      hideLoading();
      // Show the click shield after iframe loads — user taps it to dismiss,
      // which absorbs the invisible ad overlay's first click
      showClickShield();
    });
    target.appendChild(iframeEl);
  }

  function showClickShield() {
    const shield = container.querySelector('#click-shield');
    if (shield) {
      shield.classList.remove('hidden');
      shield.style.background = 'rgba(0,0,0,0.4)';
    }
  }

  function dismissClickShield() {
    const shield = container.querySelector('#click-shield');
    if (!shield) return;

    // First tap: absorb it (this is what the ad overlay would have caught)
    // Make shield transparent but keep it there to catch more ad clicks
    shield.style.background = 'transparent';
    shield.innerHTML = '';

    // Keep absorbing clicks for 2 more seconds, then fully remove
    setTimeout(() => {
      shield.classList.add('hidden');
    }, 2000);
  }

  function showLoading() {
    container.querySelector('#embed-loading')?.classList.remove('hidden');
    container.querySelector('#embed-error')?.classList.add('hidden');
    container.querySelector('#click-shield')?.classList.add('hidden');
  }
  function hideLoading() {
    container.querySelector('#embed-loading')?.classList.add('hidden');
  }
  function showError() {
    container.querySelector('#embed-loading')?.classList.add('hidden');
    container.querySelector('#embed-error')?.classList.remove('hidden');
    container.querySelector('#click-shield')?.classList.add('hidden');
  }

  function updateStreamPills() {
    container.querySelectorAll('[data-stream]').forEach(btn => {
      const id = parseInt(btn.dataset.stream);
      const active = id === currentStream;
      btn.className = `w-8 h-8 rounded-lg font-mono text-xs font-medium
        transition-all duration-300 ease-smooth active:scale-[0.95]
        ${active ? 'bg-ink text-surface-card shadow-bezel' : 'bg-surface-elevated text-ink-secondary hover:text-ink'}`;
    });
  }

  function bindEvents() {
    // Click shield — absorbs first tap
    container.querySelector('#click-shield')?.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      dismissClickShield();
    }, true);

    container.querySelector('#source-select')?.addEventListener('change', e => {
      currentSource = e.target.value;
      currentStream = 1;
      updateStreamPills();
      loadStream();
    });

    container.querySelector('#stream-pills')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-stream]');
      if (!btn) return;
      currentStream = parseInt(btn.dataset.stream);
      updateStreamPills();
      loadStream();
    });

    container.querySelector('#fullscreen-btn')?.addEventListener('click', () => {
      const box = container.querySelector('#embed-box');
      if (box) { document.fullscreenElement ? document.exitFullscreen() : box.requestFullscreen?.(); }
    });
  }

  render();
  const deactivateGuard = activateGuard();

  return () => {
    deactivateGuard();
    if (iframeEl) { iframeEl.src = 'about:blank'; iframeEl.remove(); iframeEl = null; }
  };
}
