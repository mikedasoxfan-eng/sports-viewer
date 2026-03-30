/**
 * Nuclear navigation/redirect/popup/ad blocker.
 * Activated when watching a stream. Returns a cleanup function.
 */

// Known ad/tracker domains to nuke on sight
const AD_DOMAINS = [
  'pomxd.com', 'torreyhealthtracker', 'doubleclick.net', 'googlesyndication',
  'adservice', 'amazon-adsystem', 'facebook.net', 'fbcdn.net',
  'tiktok', 'analytics', 'tracker', 'clickid', 'utm_source',
  'srvtrck', 'popads', 'popcash', 'propellerads', 'exoclick',
  'juicyads', 'trafficjunky', 'adsterra', 'clickadu', 'hilltopads',
  'evadav.com', 'monetag', 'profitablegatecpm', 'richpush',
  'pushground', 'pushhouse', 'galaksion', 'clickaine',
];

function isAdUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return AD_DOMAINS.some(d => lower.includes(d));
}

export function activateGuard() {
  const savedHref = window.location.href;
  const savedHash = window.location.hash;
  const savedOrigin = window.location.origin;
  const cleanups = [];

  // === 1. Kill window.open completely ===
  const origOpen = window.open;
  window.open = () => null;
  cleanups.push(() => { window.open = origOpen; });

  // === 2. Override window.location methods ===
  try {
    const origAssign = window.location.assign.bind(window.location);
    const origReplace = window.location.replace.bind(window.location);
    const blockExternal = (fn, url) => {
      try {
        const parsed = new URL(url, savedOrigin);
        if (parsed.origin === savedOrigin) return fn(url);
      } catch {}
      // Blocked
    };
    Object.defineProperty(window.location, 'assign', {
      value: url => blockExternal(origAssign, url), configurable: true
    });
    Object.defineProperty(window.location, 'replace', {
      value: url => blockExternal(origReplace, url), configurable: true
    });
    cleanups.push(() => {
      try {
        Object.defineProperty(window.location, 'assign', { value: origAssign, configurable: true });
        Object.defineProperty(window.location, 'replace', { value: origReplace, configurable: true });
      } catch {}
    });
  } catch {}

  // === 3. Block external page unload, allow in-app navigation ===
  // pagehide (mobile) — snap back if navigating externally
  const onPageHide = e => {
    if (e.persisted === false) {
      setTimeout(() => {
        if (window.location.origin !== savedOrigin) {
          window.location.replace(savedHref);
        }
      }, 0);
    }
  };
  window.addEventListener('pagehide', onPageHide);
  cleanups.push(() => window.removeEventListener('pagehide', onPageHide));

  // === 4. Allow back button for in-app navigation, block external ===
  const onPopState = () => {
    // If the browser navigated away from our origin, snap back
    if (window.location.origin !== savedOrigin) {
      history.pushState(null, '', savedHash);
    }
    // Otherwise allow it — back button goes to #/ (games page) naturally
  };
  window.addEventListener('popstate', onPopState);
  cleanups.push(() => window.removeEventListener('popstate', onPopState));

  // === 5. Intercept ALL click/touch/auxclick in capture phase ===
  const blockNav = e => {
    const a = e.target?.closest?.('a[href]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#')) return;
    try {
      const url = new URL(href, savedOrigin);
      if (url.origin === savedOrigin) return;
    } catch {}
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  for (const evt of ['click', 'auxclick', 'touchend', 'mousedown', 'pointerdown']) {
    document.addEventListener(evt, blockNav, true);
    cleanups.push(() => document.removeEventListener(evt, blockNav, true));
  }

  // === 6. Block form submissions ===
  const blockForm = e => { e.preventDefault(); e.stopImmediatePropagation(); };
  document.addEventListener('submit', blockForm, true);
  cleanups.push(() => document.removeEventListener('submit', blockForm, true));

  // === 7. MutationObserver — nuke injected ad scripts, meta refresh, rogue iframes ===
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        const tag = node.tagName;

        // Kill meta refresh
        if (tag === 'META' && node.getAttribute('http-equiv')?.toLowerCase() === 'refresh') {
          node.remove();
          continue;
        }

        // Kill rogue scripts outside our app
        if (tag === 'SCRIPT' && !node.closest('#app') && !node.closest('head')) {
          const src = node.src || '';
          if (isAdUrl(src) || !src.startsWith(savedOrigin)) {
            node.remove();
            continue;
          }
        }

        // Kill rogue iframes not inside our embed container
        if (tag === 'IFRAME' && !node.closest('#embed-box')) {
          const src = node.src || '';
          if (src && !src.startsWith(savedOrigin) && !src.includes('embedsports.top')) {
            node.remove();
            continue;
          }
        }

        // Kill ad-domain elements
        if (node.src && isAdUrl(node.src)) {
          node.remove();
          continue;
        }
        if (node.href && isAdUrl(node.href)) {
          node.remove();
          continue;
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  cleanups.push(() => observer.disconnect());

  // === 8. Aggressive location poll (50ms) ===
  const locationPoll = setInterval(() => {
    if (window.location.origin !== savedOrigin) {
      window.stop();
      try { window.location.replace(savedHref); } catch {}
    }
  }, 50);
  cleanups.push(() => clearInterval(locationPoll));

  // === 9. Visibility change snap-back ===
  const onVisChange = () => {
    if (document.visibilityState === 'hidden') {
      setTimeout(() => {
        if (window.location.origin !== savedOrigin) {
          try { window.location.replace(savedHref); } catch {}
        }
      }, 50);
    }
  };
  document.addEventListener('visibilitychange', onVisChange);
  cleanups.push(() => document.removeEventListener('visibilitychange', onVisChange));

  // === 10. Nuke window.focus/blur hijacking (ad trick) ===
  const origFocus = window.focus;
  const origBlur = window.blur;
  window.focus = () => {};
  window.blur = () => {};
  cleanups.push(() => { window.focus = origFocus; window.blur = origBlur; });

  // === 11. Block target="_blank" links globally ===
  const blockTarget = e => {
    const a = e.target?.closest?.('a[target]');
    if (a && a.target === '_blank') {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  document.addEventListener('click', blockTarget, true);
  cleanups.push(() => document.removeEventListener('click', blockTarget, true));

  // === 12. Nuke document.createElement for script/iframe injection ===
  const origCreate = document.createElement.bind(document);
  document.createElement = function(tag, options) {
    const el = origCreate(tag, options);
    const t = tag.toLowerCase();
    if (t === 'script' || t === 'iframe') {
      // Intercept src setter to block ad domains
      const origSrcDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'src') ||
                          Object.getOwnPropertyDescriptor(el.__proto__, 'src');
      if (origSrcDesc) {
        let _src = '';
        Object.defineProperty(el, 'src', {
          get: () => _src,
          set: val => {
            if (isAdUrl(val)) return; // Silently block
            _src = val;
            if (origSrcDesc.set) origSrcDesc.set.call(el, val);
            else el.setAttribute('src', val);
          },
          configurable: true
        });
      }
    }
    return el;
  };
  cleanups.push(() => { document.createElement = origCreate; });

  return () => {
    for (const fn of cleanups) {
      try { fn(); } catch {}
    }
  };
}
