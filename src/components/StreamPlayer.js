/**
 * Stream player — iframe embed with source cycling.
 * Uses embedsports.top only (no SportSRC embeds).
 */

import { buildEmbedUrl, createSecureIframe } from '../lib/embed.js';
import { EMBED_LOAD_TIMEOUT } from '../config.js';
import { activateGuard } from '../lib/guard.js';

const SOURCES = ['admin', 'charlie', 'delta', 'echo', 'golf'];
const STREAMS_PER_SOURCE = 3;

export function StreamPlayer(container, { slug, game }) {
  // Build queue: all source/stream combos for embedsports.top
  const embedQueue = [];
  if (slug) {
    for (const src of SOURCES) {
      for (let i = 1; i <= STREAMS_PER_SOURCE; i++) {
        const url = buildEmbedUrl(slug, i, src);
        if (url) embedQueue.push({ url, label: `${src} #${i}` });
      }
    }
  }

  let currentIndex = 0;
  let loadTimer = null;
  let iframeEl = null;

  function render() {
    container.innerHTML = `
      <div class="rounded-4xl bg-surface-card shadow-diffused border border-ink-faint/15 p-2
                  transition-shadow duration-500 ease-smooth">
        <div class="rounded-[1.75rem] bg-ink overflow-hidden aspect-video relative" id="embed-box">
          <div id="embed-loading" class="absolute inset-0 flex items-center justify-center bg-ink z-10">
            <div class="flex flex-col items-center gap-3">
              <div class="w-6 h-6 border-2 border-surface-card/30 border-t-surface-card rounded-full animate-[spin_0.8s_linear_infinite]"></div>
              <span id="loading-label" class="font-mono text-xs text-surface-card/60 uppercase tracking-wider">Loading stream</span>
            </div>
          </div>
          <div id="embed-error" class="absolute inset-0 flex items-center justify-center bg-ink z-10 hidden">
            <div class="flex flex-col items-center gap-4 text-center px-6">
              <div class="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-surface-card/60">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                </svg>
              </div>
              <p class="font-mono text-xs text-surface-card/60 uppercase tracking-wider">No working streams found</p>
              <button id="retry-btn" class="px-4 py-2 rounded-full bg-white/10 text-surface-card text-sm font-medium
                        transition-all duration-300 ease-smooth hover:bg-white/20 active:scale-[0.97]">
                Retry
              </button>
            </div>
          </div>
          <div id="embed-target" class="absolute inset-0"></div>
        </div>
      </div>

      <div class="flex items-center justify-between mt-4
                  rounded-2xl bg-surface-card shadow-card border border-ink-faint/15 p-3">
        <div class="flex items-center gap-3">
          <button id="prev-btn" class="w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center
                    text-ink-muted hover:text-ink transition-all duration-300 ease-smooth active:scale-[0.95]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <span id="source-label" class="font-mono text-xs text-ink-secondary min-w-[80px] text-center">
            ${embedQueue.length ? '1 / ' + embedQueue.length : 'No sources'}
          </span>
          <button id="next-btn" class="w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center
                    text-ink-muted hover:text-ink transition-all duration-300 ease-smooth active:scale-[0.95]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
          </button>
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
    if (!embedQueue.length || currentIndex >= embedQueue.length) { showError(); return; }
    const entry = embedQueue[currentIndex];
    showLoading();
    clearLoadTimer();

    const label = container.querySelector('#source-label');
    if (label) label.textContent = `${currentIndex + 1} / ${embedQueue.length}`;
    const ll = container.querySelector('#loading-label');
    if (ll) ll.textContent = `Trying ${entry.label}...`;

    const target = container.querySelector('#embed-target');
    if (iframeEl) { iframeEl.src = 'about:blank'; iframeEl.remove(); iframeEl = null; }

    iframeEl = createSecureIframe(entry.url, game?.displayTitle || 'Game Stream');
    if (!iframeEl) { currentIndex++; loadStream(); return; }

    iframeEl.addEventListener('load', () => { clearLoadTimer(); hideLoading(); });
    loadTimer = setTimeout(() => { currentIndex++; loadStream(); }, EMBED_LOAD_TIMEOUT);
    target.appendChild(iframeEl);
  }

  function showLoading() {
    container.querySelector('#embed-loading')?.classList.remove('hidden');
    container.querySelector('#embed-error')?.classList.add('hidden');
  }
  function hideLoading() {
    container.querySelector('#embed-loading')?.classList.add('hidden');
  }
  function showError() {
    container.querySelector('#embed-loading')?.classList.add('hidden');
    container.querySelector('#embed-error')?.classList.remove('hidden');
  }
  function clearLoadTimer() { if (loadTimer) { clearTimeout(loadTimer); loadTimer = null; } }

  function bindEvents() {
    container.querySelector('#next-btn')?.addEventListener('click', () => {
      if (currentIndex < embedQueue.length - 1) { currentIndex++; loadStream(); }
    });
    container.querySelector('#prev-btn')?.addEventListener('click', () => {
      if (currentIndex > 0) { currentIndex--; loadStream(); }
    });
    container.querySelector('#retry-btn')?.addEventListener('click', () => { currentIndex = 0; loadStream(); });
    container.querySelector('#fullscreen-btn')?.addEventListener('click', () => {
      const box = container.querySelector('#embed-box');
      if (box) { document.fullscreenElement ? document.exitFullscreen() : box.requestFullscreen?.(); }
    });
  }

  render();
  const deactivateGuard = activateGuard();

  return () => {
    clearLoadTimer();
    deactivateGuard();
    if (iframeEl) { iframeEl.src = 'about:blank'; iframeEl.remove(); iframeEl = null; }
  };
}
