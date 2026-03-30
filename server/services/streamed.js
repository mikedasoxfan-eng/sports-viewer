/**
 * Streamed.pk API client.
 * Fetches match data from the streaming API with retries.
 */

const API_BASES = (process.env.STREAM_API_BASES || 'https://streamed.pk/api')
  .split(',').map(b => b.trim()).filter(Boolean);
const STREAMED_IMAGE_BASE = process.env.STREAMED_IMAGE_BASE || 'https://streamed.pk';
const USER_AGENT = process.env.USER_AGENT || 'SportsViewer/2.0';
const TIMEOUT_MS = parseInt(process.env.FETCH_TIMEOUT_MS || '8000', 10);
const RETRIES = parseInt(process.env.FETCH_RETRIES || '2', 10);

const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function fetchJson(url, opts = {}) {
  let lastErr;
  const retries = opts.retries ?? RETRIES;
  const headers = { Accept: 'application/json', 'User-Agent': USER_AGENT, ...(opts.headers || {}) };

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers, signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) { const e = new Error(`${res.status}`); e.status = res.status; throw e; }
      return res.json();
    } catch (e) {
      clearTimeout(tid);
      lastErr = e;
      if (attempt < retries) await sleep(250 * (attempt + 1));
    }
  }
  throw lastErr;
}

export async function fetchMatches(endpoint) {
  let lastErr;
  for (const base of API_BASES) {
    try {
      const url = `${base.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
      const origin = base.replace(/\/+api\/?$/, '').replace(/\/$/, '');
      const headers = origin ? { Referer: `${origin}/`, Origin: origin } : undefined;
      const data = await fetchJson(url, { retries: RETRIES, headers });
      return [Array.isArray(data) ? data : [], base];
    } catch (e) { lastErr = e; }
  }
  if (lastErr) throw lastErr;
  return [[], null];
}

export function buildStreamedLogo(badge) {
  if (!badge || typeof badge !== 'string') return null;
  const c = badge.trim();
  if (!c) return null;
  if (c.startsWith('http://') || c.startsWith('https://')) return c;
  const base = STREAMED_IMAGE_BASE.replace(/\/$/, '');
  if (c.startsWith('/')) return `${base}${c}`;
  if (c.startsWith('api/images/') || c.startsWith('images/')) return `${base}/${c}`;
  const ext = c.match(/\.[a-z0-9]+$/i)?.[0];
  if (ext) return `${base}/api/images/badge/${c}`;
  return `${base}/api/images/badge/${c}.webp`;
}

export function buildStreamedPoster(poster) {
  if (!poster || typeof poster !== 'string') return null;
  const c = poster.trim();
  if (!c) return null;
  if (c.startsWith('http://') || c.startsWith('https://')) return c;
  const base = STREAMED_IMAGE_BASE.replace(/\/$/, '');
  if (c.startsWith('/')) {
    const p = c.match(/\.[a-z0-9]+$/i) ? c : `${c}.webp`;
    return `${base}${p}`;
  }
  if (c.startsWith('api/images/') || c.startsWith('images/')) {
    const p = `/${c.replace(/^\/+/, '')}`;
    const fp = p.match(/\.[a-z0-9]+$/i) ? p : `${p}.webp`;
    return `${base}${fp}`;
  }
  const ext = c.match(/\.[a-z0-9]+$/i)?.[0];
  if (ext) return `${base}/api/images/proxy/${c}`;
  return `${base}/api/images/proxy/${c}.webp`;
}

export function buildStreamedTeam(team) {
  if (!team) return null;
  const name = team.name || '';
  const logo = buildStreamedLogo(team.badge || team.logo);
  const raw = team.score ?? team.points ?? team?.score?.value ?? team?.score?.displayValue;
  const score = raw !== undefined && raw !== null && raw !== '' ? raw : null;
  if (!name && !logo && score === null) return null;
  return { name, logo, score };
}
