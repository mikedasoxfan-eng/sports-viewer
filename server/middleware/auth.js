/**
 * Stateless password authentication.
 * Works on both Express and Vercel serverless.
 * Set AUTH_PASSWORD env var to enable.
 */

import crypto from 'crypto';

const PASSWORD = process.env.AUTH_PASSWORD || '';
const SECRET = process.env.SESSION_SECRET || 'sv-default-secret-change-me';
const MAX_AGE_SEC = 7 * 24 * 60 * 60; // 7 days

function sign(timestamp) {
  return crypto.createHmac('sha256', SECRET).update(String(timestamp)).digest('hex');
}

function createToken() {
  const ts = Date.now();
  return `${ts}.${sign(ts)}`;
}

function verifyToken(token) {
  if (!token) return false;
  const [ts, sig] = token.split('.');
  if (!ts || !sig) return false;
  const age = (Date.now() - Number(ts)) / 1000;
  if (age > MAX_AGE_SEC || age < 0) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(ts)));
}

export function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach(pair => {
    const [key, ...rest] = pair.trim().split('=');
    if (key) cookies[key.trim()] = rest.join('=').trim();
  });
  return cookies;
}

export function isAuthenticated(req) {
  if (!PASSWORD) return true;
  const cookies = parseCookies(req.headers.cookie);
  return verifyToken(cookies['sv_session']);
}

export function handleAuthCheck(req, res) {
  if (!PASSWORD) return res.json({ required: false, authenticated: true });
  res.json({ required: true, authenticated: isAuthenticated(req) });
}

export function handleAuthLogin(req, res) {
  if (!PASSWORD) return res.json({ success: true });

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const { password } = JSON.parse(body);
      if (password === PASSWORD) {
        const token = createToken();
        res.setHeader('Set-Cookie', `sv_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE_SEC}`);
        res.json({ success: true });
      } else {
        res.status(403).json({ success: false, error: 'Wrong password' });
      }
    } catch {
      res.status(400).json({ success: false, error: 'Invalid request' });
    }
  });
}

export function handleAuthLogout(req, res) {
  res.setHeader('Set-Cookie', 'sv_session=; Path=/; HttpOnly; Max-Age=0');
  res.json({ success: true });
}

// Express middleware
export function authMiddleware(req, res, next) {
  if (!PASSWORD) return next();
  if (req.path.startsWith('/auth/')) return next();
  if (isAuthenticated(req)) return next();
  res.status(401).json({ error: 'unauthorized' });
}

// Express route setup
export function authRoutes(app) {
  app.get('/api/auth/check', handleAuthCheck);
  app.post('/api/auth/login', handleAuthLogin);
  app.post('/api/auth/logout', handleAuthLogout);
}
