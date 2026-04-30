require('dotenv').config();
const express   = require('express');
const path      = require('path');
const session   = require('express-session');
const rateLimit = require('express-rate-limit');

// Initialize DB (runs schema + seeds on first run)
const db = require('./db/database');
const BetterSQLiteStore = require('./db/sessionStore');
const requireAuth       = require('./middleware/requireAuth');

const app  = express();
const PORT = process.env.PORT || 3000;

// Trust a single reverse-proxy hop when deployed behind Caddy/nginx
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Sessions ──────────────────────────────────────────────────────────────────
app.use(session({
  name:   'sn.sid',
  secret: process.env.SESSION_SECRET || (() => {
    console.warn('[SiteNote] SESSION_SECRET not set — using insecure default. Set it in .env!');
    return 'insecure-default-change-me';
  })(),
  resave:            false,
  saveUninitialized: false,
  store:  new BetterSQLiteStore(db),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure:   process.env.SESSION_SECURE === 'true',
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// ── Auth routes (public — no session required) ────────────────────────────────
// Rate-limit login: 10 attempts per 15 min per IP
const loginLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  message:         { error: 'Too many login attempts — try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders:   false,
});
app.use('/api/auth', loginLimiter, require('./routes/auth'));

// Health check (no auth — used by uptime monitors)
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── All other API routes require a valid session ───────────────────────────────
app.use('/api', requireAuth);

app.use('/api', require('./routes/tasks'));
app.use('/api', require('./routes/attachments'));
app.use('/api/projects',   require('./routes/projects'));
app.use('/api/notes',      require('./routes/notes'));
app.use('/api/search',     require('./routes/search'));
app.use('/api/settings',   require('./routes/settings'));
app.use('/api/ai',           require('./routes/ai'));
app.use('/api/transcribe',   require('./routes/transcribe'));
app.use('/api/invoiceninja', require('./routes/invoiceninja'));
app.use('/api/catalog',     require('./routes/catalog'));
app.use('/api/pipeline',   require('./routes/pipeline'));
app.use('/api/materials',  require('./routes/materials'));

// ── Static frontend ────────────────────────────────────────────────────────────
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Hashed assets (JS/CSS/images) — cache forever; they get new filenames on each build
app.use(express.static(PUBLIC_DIR, {
  setHeaders(res, filePath) {
    const noCache = ['/index.html', '/sw.js', '/manifest.webmanifest'];
    if (noCache.some(f => filePath.endsWith(f))) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));

// SPA fallback — always no-store so nginx/Firefox never caches the shell
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ── Global error handler ───────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SiteNote listening on http://0.0.0.0:${PORT}`);
});
