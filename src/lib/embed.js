/**
 * Embed URL builder and secure iframe factory.
 * Uses embedsports.top only.
 */

const ALLOWED_DOMAINS = ['embedsports.top'];
const VALID_SOURCES = ['admin', 'charlie', 'delta', 'echo', 'golf', 'alpha', 'bravo', 'foxtrot', 'hotel', 'intel'];

export function sanitizeSlug(slug) {
  if (!slug || typeof slug !== 'string') return '';
  return slug.toLowerCase().trim().replace(/[^a-z0-9\-_]/g, '').replace(/--+/g, '-').replace(/^-|-$/g, '');
}

export function validateStreamId(streamId) {
  const id = parseInt(streamId, 10);
  if (isNaN(id) || id < 1 || id > 99) return null;
  return id;
}

export function validateSourceType(source) {
  return VALID_SOURCES.includes(source) ? source : 'admin';
}

export function isValidEmbedUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const domain = parsed.hostname.replace(/^www\./, '');
    return ALLOWED_DOMAINS.some(allowed => domain === allowed || domain.endsWith('.' + allowed));
  } catch {
    return false;
  }
}

export function buildEmbedUrl(slug, streamId = 1, sourceType = 'admin') {
  const safe = sanitizeSlug(slug);
  const validId = validateStreamId(streamId);
  const source = validateSourceType(sourceType);
  if (!safe || !validId) return null;
  const url = `https://embedsports.top/embed/${source}/${safe}/${validId}`;
  return isValidEmbedUrl(url) ? url : null;
}

export function createSecureIframe(url, title = 'Game Stream') {
  if (!isValidEmbedUrl(url)) return null;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
  iframe.setAttribute('title', title);
  iframe.setAttribute('aria-label', title);
  iframe.setAttribute('allow', 'fullscreen; autoplay; encrypted-media; picture-in-picture');
  iframe.className = 'w-full h-full absolute inset-0';
  iframe.src = url;
  return iframe;
}

export function parseGameSlug(slug, league = null) {
  if (!slug) return null;
  const clean = slug.replace(/^ppv-/, '');
  const vsIndex = clean.indexOf('-vs-');
  if (vsIndex === -1) return null;
  return { awaySlug: clean.substring(0, vsIndex), homeSlug: clean.substring(vsIndex + 4), league };
}

export function getStreamUrls(slug, maxStreams = 5) {
  const urls = [];
  for (let i = 1; i <= maxStreams; i++) {
    const url = buildEmbedUrl(slug, i);
    if (url) urls.push({ streamId: i, url });
  }
  return urls;
}
