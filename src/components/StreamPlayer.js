/**
 * Stream player — iframe embed with source/stream selectors.
 */

import { buildEmbedUrl, createSecureIframe, sanitizeSlug } from '../lib/embed.js';
import { VALID_SOURCES, SOURCE_LABELS, MAX_STREAMS, EMBED_LOAD_TIMEOUT } from '../config.js';
import { state } from '../lib/state.js';
import { activateGuard } from '../lib/guard.js';

export function StreamPlayer(container, { slug, game, sources }) {
  let currentSource = sources?.[0]?.source || game?.currentSource || 'admin';
  let currentStream = 1;
  let loadTimer = null;
  let iframeEl = null;

  const availableSources = sources?.length
    ? sources.map(s => s.source).filter(Boolean)
    : VALID_SOURCES;

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
              <button id="retry-btn" class="px-4 py-2 rounded-full bg-white/10 text-surface-card text-sm font-medium
                        transition-all duration-300 ease-smooth hover:bg-white/20 active:scale-[0.97]">
                Try next source
              </button>
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
                      rounded-lg px-2.5 py-1.5 text-ink appearance-none cursor-pointer
                      transition-all duration-300 ease-smooth hover:border-ink-faint/40
                      focus:outline-none focus:ring-2 focus:ring-accent/30">
              ${availableSources.map(s => `
                <option value="${s}" ${s === currentSource ? 'selected' : ''}>
                  ${SOURCE_LABELS[s] || s}
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
                                : 'bg-surface-elevated text-ink-secondary hover:text-ink hover:bg-surface-elevated/80'}"
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
    if (!url) {
      showError();
      return;
    }

    showLoading();
    clearLoadTimer();

    const target = container.querySelector('#embed-target');
    if (iframeEl) {
      iframeEl.remove();
      iframeEl = null;
    }

    const title = game?.displayTitle || 'Game Stream';
    iframeEl = createSecureIframe(url, title);
    if (!iframeEl) {
      showError();
      return;
    }

    iframeEl.addEventListener('load', () => {
      clearLoadTimer();
      hideLoading();
    });

    loadTimer = setTimeout(() => {
      if (state.settings.autoCycleStreams) {
        cycleNext();
      } else {
        showError();
      }
    }, EMBED_LOAD_TIMEOUT);

    target.appendChild(iframeEl);
  }

  function showLoading() {
    const loading = container.querySelector('#embed-loading');
    const error = container.querySelector('#embed-error');
    if (loading) loading.classList.remove('hidden');
    if (error) error.classList.add('hidden');
  }

  function hideLoading() {
    const loading = container.querySelector('#embed-loading');
    if (loading) loading.classList.add('hidden');
  }

  function showError() {
    const loading = container.querySelector('#embed-loading');
    const error = container.querySelector('#embed-error');
    if (loading) loading.classList.add('hidden');
    if (error) error.classList.remove('hidden');
  }

  function clearLoadTimer() {
    if (loadTimer) { clearTimeout(loadTimer); loadTimer = null; }
  }

  function cycleNext() {
    const srcIdx = availableSources.indexOf(currentSource);
    if (currentStream < MAX_STREAMS) {
      currentStream++;
    } else if (srcIdx < availableSources.length - 1) {
      currentSource = availableSources[srcIdx + 1];
      currentStream = 1;
    } else {
      showError();
      return;
    }
    updateStreamPills();
    updateSourceSelect();
    loadStream();
  }

  function updateStreamPills() {
    container.querySelectorAll('[data-stream]').forEach(btn => {
      const id = parseInt(btn.dataset.stream);
      btn.className = `w-8 h-8 rounded-lg font-mono text-xs font-medium
        transition-all duration-300 ease-smooth active:scale-[0.95]
        ${id === currentStream
          ? 'bg-ink text-surface-card shadow-bezel'
          : 'bg-surface-elevated text-ink-secondary hover:text-ink hover:bg-surface-elevated/80'}`;
    });
  }

  function updateSourceSelect() {
    const sel = container.querySelector('#source-select');
    if (sel) sel.value = currentSource;
  }

  function bindEvents() {
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
      if (box) {
        if (document.fullscreenElement) document.exitFullscreen();
        else box.requestFullscreen?.();
      }
    });

    container.querySelector('#retry-btn')?.addEventListener('click', cycleNext);
  }

  render();

  // Activate nuclear navigation guard
  const deactivateGuard = activateGuard();

  return () => {
    clearLoadTimer();
    deactivateGuard();
    if (iframeEl) { iframeEl.src = 'about:blank'; iframeEl.remove(); iframeEl = null; }
  };
}
