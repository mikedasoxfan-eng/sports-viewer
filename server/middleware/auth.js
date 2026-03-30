/**
 * Simple password authentication middleware.
 * Set AUTH_PASSWORD env var to enable. If unset, auth is disabled.
 */

import crypto from 'crypto';

const PASSWORD = process.env.AUTH_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// In-memory session store (sufficient for single-instance)
const sessions = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach(pair => {
    const [key, ...rest] = pair.trim().split('=');
    if (key) cookies[key.trim()] = rest.join('=').trim();
  });
  return cookies;
}

export function authMiddleware(req, res, next) {
  // Auth disabled if no password set
  if (!PASSWORD) return next();

  // Skip auth for the login endpoint itself
  if (req.path === '/auth/login' || req.path === '/auth/check') return next();

  const cookies = parseCookies(req.headers.cookie);
  const token = cookies['sv_session'];

  if (token && sessions.has(token)) {
    const session = sessions.get(token);
    if (Date.now() - session.created < SESSION_MAX_AGE) {
      return next();
    }
    sessions.delete(token);
  }

  res.status(401).json({ error: 'unauthorized' });
}

export function authRoutes(app) {
  // Check if auth is required
  app.get('/api/auth/check', (req, res) => {
    if (!PASSWORD) return res.json({ required: false, authenticated: true });

    const cookies = parseCookies(req.headers.cookie);
    const token = cookies['sv_session'];
    const valid = token && sessions.has(token) && (Date.now() - sessions.get(token).created < SESSION_MAX_AGE);
    res.json({ required: true, authenticated: valid });
  });

  // Login
  app.post('/api/auth/login', (req, res) => {
    if (!PASSWORD) return res.json({ success: true });

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { password } = JSON.parse(body);
        if (password === PASSWORD) {
          const token = generateToken();
          sessions.set(token, { created: Date.now() });
          res.setHeader('Set-Cookie', `sv_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE / 1000}`);
          res.json({ success: true });
        } else {
          res.status(403).json({ success: false, error: 'Wrong password' });
        }
      } catch {
        res.status(400).json({ success: false, error: 'Invalid request' });
      }
    });
  });

  // Logout
  app.post('/api/auth/logout', (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies['sv_session'];
    if (token) sessions.delete(token);
    res.setHeader('Set-Cookie', 'sv_session=; Path=/; HttpOnly; Max-Age=0');
    res.json({ success: true });
  });
}
