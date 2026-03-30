/**
 * Hash-based router with lifecycle hooks.
 *
 * Routes are patterns like '/watch/:slug' that match '#/watch/some-game'.
 * Each page handler receives (container, params, query) and returns a cleanup fn.
 */

let routes = [];
let currentCleanup = null;
let currentRoute = null;
let outlet = null;
let beforeHooks = [];
let afterHooks = [];

function parseQuery(queryString) {
  if (!queryString) return {};
  return queryString.split('&').reduce((acc, pair) => {
    const [key, value] = pair.split('=');
    if (key) {
      acc[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
    }
    return acc;
  }, {});
}

function handleRoute() {
  const hash = window.location.hash || '#/';
  const [pathWithQuery] = hash.substring(1).split('?');
  const path = pathWithQuery || '/';
  const queryString = hash.includes('?') ? hash.split('?')[1] : '';
  const query = parseQuery(queryString);

  for (const route of routes) {
    const match = path.match(route.regex);
    if (match) {
      const params = {};
      route.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1]);
      });

      // Run before hooks
      for (const hook of beforeHooks) {
        if (hook(route.pattern, params, query) === false) return;
      }

      // Cleanup previous page
      if (currentCleanup) {
        try { currentCleanup(); } catch (e) { console.error('Cleanup error:', e); }
        currentCleanup = null;
      }

      const prev = currentRoute;
      currentRoute = { pattern: route.pattern, path, params, query };

      // Clear outlet and render
      if (outlet) {
        outlet.innerHTML = '';
        currentCleanup = route.handler(outlet, params, query) || null;
      }

      // Run after hooks
      for (const hook of afterHooks) {
        hook(currentRoute, prev);
      }
      return;
    }
  }

  // 404
  if (currentCleanup) {
    try { currentCleanup(); } catch (e) { /* ignore */ }
    currentCleanup = null;
  }
  currentRoute = { pattern: '404', path, params: {}, query };
  if (outlet) {
    outlet.innerHTML = '';
    const notFound = routes.find(r => r.pattern === '404');
    if (notFound) {
      currentCleanup = notFound.handler(outlet, {}, {}) || null;
    }
  }
}

export const router = {
  /** Set the DOM element to render pages into */
  setOutlet(el) {
    outlet = el;
  },

  /** Register a route pattern and its handler */
  register(pattern, handler) {
    const paramNames = [];
    const regexStr = pattern
      .replace(/\//g, '\\/')
      .replace(/:([^/]+)/g, (_, name) => {
        paramNames.push(name);
        return '([^/]+)';
      });
    routes.push({
      pattern,
      regex: new RegExp(`^${regexStr}$`),
      paramNames,
      handler
    });
  },

  /** Navigate programmatically */
  navigate(path) {
    window.location.hash = path.startsWith('#') ? path : `#${path}`;
  },

  /** Hook that runs before each navigation */
  beforeEach(callback) {
    beforeHooks.push(callback);
  },

  /** Hook that runs after each navigation */
  afterEach(callback) {
    afterHooks.push(callback);
  },

  /** Start listening for hash changes */
  init() {
    window.addEventListener('hashchange', handleRoute);
    if (!window.location.hash) {
      window.location.hash = '#/';
    } else {
      handleRoute();
    }
  },

  /** Get current route info */
  get current() {
    return currentRoute;
  },

  /** Check if a pattern is the active route */
  isActive(pattern) {
    return currentRoute?.pattern === pattern;
  }
};
