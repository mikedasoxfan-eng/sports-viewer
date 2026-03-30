/**
 * Nuclear-grade navigation/redirect/popup blocker.
 * Activated when watching a stream. Prevents embeds from:
 * - Opening new tabs/windows
 * - Navigating the parent page
 * - Triggering downloads
 * - Using history manipulation to redirect
 * - Mobile ad redirect tricks
 *
 * Returns a cleanup function.
 */

export function activateGuard() {
  const savedHref = window.location.href;
  const savedHash = window.location.hash;
  const cleanups = [];

  // 1. Kill window.open — no popups, no new tabs, no nothing
  const origOpen = window.open;
  window.open = () => null;
  cleanups.push(() => { window.open = origOpen; });

  // 2. Block beforeunload
  const onBeforeUnload = e => { e.preventDefault(); e.returnValue = ''; return ''; };
  window.addEventListener('beforeunload', onBeforeUnload);
  cleanups.push(() => window.removeEventListener('beforeunload', onBeforeUnload));

  // 3. Block pagehide (mobile fires this instead of beforeunload)
  const onPageHide = e => {
    // If the page is being hidden due to navigation (not tab switch), snap back
    if (e.persisted === false) {
      window.location.replace(savedHref);
    }
  };
  window.addEventListener('pagehide', onPageHide);
  cleanups.push(() => window.removeEventListener('pagehide', onPageHide));

  // 4. Flood history with entries so back button can't escape
  for (let i = 0; i < 20; i++) {
    history.pushState({ guard: true }, '', savedHash);
  }
  const onPopState = e => {
    // Any history navigation — push back to our page
    history.pushState({ guard: true }, '', savedHash);
  };
  window.addEventListener('popstate', onPopState);
  cleanups.push(() => window.removeEventListener('popstate', onPopState));

  // 5. Intercept ALL click/touch events at document level (capture phase)
  const blockExternalNav = e => {
    const a = e.target?.closest?.('a[href]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#')) return; // internal hash nav is fine
    if (href.startsWith('javascript:')) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    try {
      const url = new URL(href, window.location.origin);
      if (url.origin === window.location.origin) return; // same origin ok
    } catch {}
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();
  };
  document.addEventListener('click', blockExternalNav, true);
  document.addEventListener('auxclick', blockExternalNav, true); // middle click
  document.addEventListener('touchend', blockExternalNav, true); // mobile tap
  cleanups.push(() => {
    document.removeEventListener('click', blockExternalNav, true);
    document.removeEventListener('auxclick', blockExternalNav, true);
    document.removeEventListener('touchend', blockExternalNav, true);
  });

  // 6. Block form submissions (ad forms that redirect)
  const blockForms = e => { e.preventDefault(); e.stopImmediatePropagation(); };
  document.addEventListener('submit', blockForms, true);
  cleanups.push(() => document.removeEventListener('submit', blockForms, true));

  // 7. MutationObserver — kill any injected <a>, <form>, <meta refresh> tags outside our app
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        // Kill meta refresh tags
        if (node.tagName === 'META' && node.getAttribute('http-equiv')?.toLowerCase() === 'refresh') {
          node.remove();
        }
        // Kill script tags injected outside our app
        if (node.tagName === 'SCRIPT' && !node.closest('#app')) {
          node.remove();
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  cleanups.push(() => observer.disconnect());

  // 8. Aggressive location poll — 50ms interval, check if anything changed
  const guardInterval = setInterval(() => {
    if (window.location.hash !== savedHash) {
      // Hash changed unexpectedly (not from our router) — allow our own hash changes
      // but block if the origin changed
      if (window.location.origin !== new URL(savedHref).origin) {
        window.stop();
        window.location.replace(savedHref);
      }
    }
  }, 50);
  cleanups.push(() => clearInterval(guardInterval));

  // 9. Intercept window.location setter via visibilitychange
  //    If page becomes hidden (redirect started), try to come back
  const onVisChange = () => {
    if (document.visibilityState === 'hidden') {
      // Schedule a snap-back — if we come back to focus and URL changed, fix it
      setTimeout(() => {
        if (window.location.origin !== new URL(savedHref).origin) {
          window.location.replace(savedHref);
        }
      }, 100);
    }
  };
  document.addEventListener('visibilitychange', onVisChange);
  cleanups.push(() => document.removeEventListener('visibilitychange', onVisChange));

  // 10. Override window.location.assign and window.location.replace
  const origAssign = window.location.assign.bind(window.location);
  const origReplace = window.location.replace.bind(window.location);
  try {
    Object.defineProperty(window.location, 'assign', {
      value: url => {
        try {
          const parsed = new URL(url, window.location.origin);
          if (parsed.origin === window.location.origin) return origAssign(url);
        } catch {}
        // Block external
      },
      configurable: true
    });
    Object.defineProperty(window.location, 'replace', {
      value: url => {
        try {
          const parsed = new URL(url, window.location.origin);
          if (parsed.origin === window.location.origin) return origReplace(url);
        } catch {}
      },
      configurable: true
    });
    cleanups.push(() => {
      try {
        Object.defineProperty(window.location, 'assign', { value: origAssign, configurable: true });
        Object.defineProperty(window.location, 'replace', { value: origReplace, configurable: true });
      } catch {}
    });
  } catch {
    // location properties may not be configurable in all browsers
  }

  return () => {
    for (const fn of cleanups) {
      try { fn(); } catch {}
    }
  };
}
