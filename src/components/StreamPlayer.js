/**
 * Stream player — iframe embed with queue-based source cycling.
 */

import { buildEmbedUrl, createSecureIframe } from '../lib/embed.js';
import { EMBED_LOAD_TIMEOUT } from '../config.js';
import { activateGuard } from '../lib/guard.js';

export function StreamPlayer(container, { slug, game, sources }) {
  // Build ordered list of embed URLs to try
  // Prefer SportSRC embedUrls (embed.streamapi.cc) — cleaner, less ad crap
  const embedQueue = [];

  if (sources?.length) {
    sources.forEach(s => {
      if (s.embedUrl) embedQueue.push({ url: s.embedUrl, label: `${s.source || 'Source'} #${s.streamNo || 1}` });
    });
  }

  // Fallback: build embedsports.top URLs from slug
  if (slug) {
    for (const src of ['admin', 'charlie', 'delta', 'echo', 'golf']) {
      for (let i = 1; i <= 3; i++) {
        const url = buildEmbedUrl(slug, i, src);
        if (url) embedQueue.push({ url, label: `${src} #${i}` });
      }
    }
  }

  let currentIndex = 0;
  let loadTimer = null;
  let iframeEl = null;

  function render() {
    const total = embedQueue.length;
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
                Retry from start
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
                    text-ink-muted hover:text-ink transition-all duration-300 ease-smooth active:scale-[0.95]"
                  title="Previous source">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <span id="source-label" class="font-mono text-xs text-ink-secondary min-w-[80px] text-center">
            ${total > 0 ? `1 / ${total}` : 'No sources'}
          </span>
          <button id="next-btn" class="w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center
                    text-ink-muted hover:text-ink transition-all duration-300 ease-smooth active:scale-[0.95]"
                  title="Next source">
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

  function updateLabel() {
    const label = container.querySelector('#source-label');
    if (label && embedQueue.length) {
      const entry = embedQueue[currentIndex];
      label.textContent = `${currentIndex + 1} / ${embedQueue.length}`;
    }
  }

  function loadStream() {
    if (currentIndex >= embedQueue.length) {
      showError();
      return;
    }

    const entry = embedQueue[currentIndex];
    showLoading();
    clearLoadTimer();
    updateLabel();

    const loadingLabel = container.querySelector('#loading-label');
    if (loadingLabel) loadingLabel.textContent = `Trying ${entry.label}...`;

    const target = container.querySelector('#embed-target');
    if (iframeEl) {
      iframeEl.src = 'about:blank';
      iframeEl.remove();
      iframeEl = null;
    }

    const title = game?.displayTitle || 'Game Stream';
    iframeEl = createSecureIframe(entry.url, title);
    if (!iframeEl) {
      currentIndex++;
      loadStream();
      return;
    }

    iframeEl.addEventListener('load', () => {
      clearLoadTimer();
      hideLoading();
      updateLabel();
    });

    loadTimer = setTimeout(() => cycleNext(), EMBED_LOAD_TIMEOUT);
    target.appendChild(iframeEl);
  }

  function showLoading() {
    const l = container.querySelector('#embed-loading');
    const e = container.querySelector('#embed-error');
    if (l) l.classList.remove('hidden');
    if (e) e.classList.add('hidden');
  }

  function hideLoading() {
    const l = container.querySelector('#embed-loading');
    if (l) l.classList.add('hidden');
  }

  function showError() {
    const l = container.querySelector('#embed-loading');
    const e = container.querySelector('#embed-error');
    if (l) l.classList.add('hidden');
    if (e) e.classList.remove('hidden');
  }

  function clearLoadTimer() {
    if (loadTimer) { clearTimeout(loadTimer); loadTimer = null; }
  }

  function cycleNext() {
    currentIndex++;
    if (currentIndex >= embedQueue.length) {
      showError();
      return;
    }
    loadStream();
  }

  function cyclePrev() {
    if (currentIndex > 0) {
      currentIndex--;
      loadStream();
    }
  }

  function bindEvents() {
    container.querySelector('#next-btn')?.addEventListener('click', cycleNext);
    container.querySelector('#prev-btn')?.addEventListener('click', cyclePrev);
    container.querySelector('#retry-btn')?.addEventListener('click', () => {
      currentIndex = 0;
      loadStream();
    });
    container.querySelector('#fullscreen-btn')?.addEventListener('click', () => {
      const box = container.querySelector('#embed-box');
      if (box) {
        if (document.fullscreenElement) document.exitFullscreen();
        else box.requestFullscreen?.();
      }
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
