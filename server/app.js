/**
 * app.js — Express application factory.
 *
 * Configures and returns the Express app with middleware applied in the
 * correct order. The HTTP server and WebSocket server are created in server.js.
 *
 * Middleware stack (in order):
 *   1. Helmet           — security headers (CSP, HSTS, X-Frame-Options, …)
 *   2. Compression      — gzip/brotli response compression
 *   3. CORS             — cross-origin request headers
 *   4. Request Logger   — timestamp / method / route / status / duration / req-id
 *   5. JSON Parser      — parse application/json bodies
 *   6. URL-encoded      — parse application/x-www-form-urlencoded bodies
 *   7. Landing route /  — tenant-hydrated index.html (BEFORE static middleware)
 *   8. Static Files     — serve /public/* as root
 *   9. Tenant resolver  — attach req.tenant from Host header / X-Coop-Slug
 *  10. Rate Limiters    — applied per-router before mounting
 *  11. API Routes       — /api/health, /api/auth, /api/coop, /api/orders, /api/public, /api/v1
 *  12. Page Routes      — /login, /dashboard, /drivers, /join, /partners
 *  13. 404 handler      — notFound for unmatched /api/* routes
 *  14. Global Error Handler — errorHandler middleware
 *  15. Catch-all        — redirect unknown HTML paths to homepage (LAST)
 *
 * @module server/app
 */
'use strict';

const express    = require('express');
const path       = require('path');
const fs         = require('fs');
const helmet     = require('helmet');
const compression = require('compression');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');

const config       = require('./config/config');
const logger       = require('./middleware/logger');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { resolveTenant } = require('./config/tenants');

/**
 * Render a public HTML file with {{COOP_*}} tokens replaced for the
 * current tenant. Reuses resolveTenant so all tenant changes flow through
 * one place. Called for the landing page (/) and can be reused for any
 * other page that needs server-side token hydration.
 *
 * @param {string} pageName  - filename without .html extension (e.g. 'index')
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
function renderTenantHtml(pageName, req, res) {
  const tenant   = resolveTenant(req.headers.host);
  const filePath = path.join(__dirname, '..', 'public', `${pageName}.html`);

  let html;
  try {
    html = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`[renderTenantHtml] Cannot read ${filePath}:`, err.message);
    return res.status(500).send('Page not found.');
  }

  // Token map — extend here if new {{COOP_*}} tokens are added to any template
  const tokens = {
    '{{COOP_NAME}}':        tenant.name        || 'OddCoop',
    '{{COOP_MARKET}}':      tenant.market      || '',
    '{{COOP_CORRIDOR}}':    tenant.corridor    || '',
    '{{COOP_COLOR}}':       tenant.color       || '#2d8b8b',
    '{{COOP_LOGO_LETTER}}': tenant.logo_letter || (tenant.name ? tenant.name[0].toUpperCase() : 'O'),
  };

  for (const [token, value] of Object.entries(tokens)) {
    html = html.replaceAll(token, value);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

/**
 * Build and return the configured Express application.
 * Call this once from server.js; pass the same app instance to createWsServer.
 *
 * @returns {import('express').Application}
 */
function createApp() {
  const app = express();

  // ── 1. Security headers ────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc:  ["'self'"],
          scriptSrc:   ["'self'", "'unsafe-inline'"],
          styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
          imgSrc:      ["'self'", 'data:'],
          connectSrc:  ["'self'", 'wss:', 'ws:'],
        },
      },
    })
  );

  // ── 2. Compression ─────────────────────────────────────────────────────────
  app.use(compression());

  // ── 3. CORS ────────────────────────────────────────────────────────────────
  const corsOptions = config.corsOrigin
    ? {
        origin: config.corsOrigin.split(',').map((s) => s.trim()),
        credentials: true,
      }
    : { origin: true, credentials: true };
  app.use(cors(corsOptions));

  // ── 4. Request Logger ──────────────────────────────────────────────────────
  app.use(logger);

  // ── 5. JSON body parser ────────────────────────────────────────────────────
  app.use(express.json());

  // ── 6. URL-encoded body parser ─────────────────────────────────────────────
  app.use(express.urlencoded({ extended: false }));

  // ── 7. Landing page — MUST be before express.static so index.html is never
  //       served as a raw static file with unsubstituted {{COOP_*}} tokens.
  // ──────────────────────────────────────────────────────────────────────────
  app.get('/', (req, res) => renderTenantHtml('index', req, res));

  // ── 8. Static files ────────────────────────────────────────────────────────
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // ── 9. Tenant resolver ─────────────────────────────────────────────────────
  app.use((req, _res, next) => {
    req.tenant = resolveTenant(req.headers.host);
    next();
  });

  // ── 10. Rate limiters ────────────────────────────────────────────────────────
  const { windowMs, authMax, leadMax, publicMax } = config.rateLimit;

  const authLimiter = rateLimit({
    windowMs, max: authMax,
    standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many attempts — try again later' },
  });

  const leadLimiter = rateLimit({
    windowMs, max: leadMax,
    standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many submissions — try again later' },
  });

  const publicLimiter = rateLimit({
    windowMs, max: publicMax,
    standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many requests — try again later' },
  });

  // ── 11. API Routes ─────────────────────────────────────────────────────────
  app.use('/api/health',  require('./routes/health'));
  app.use('/api/auth',    authLimiter, require('./routes/auth'));
  app.use('/api/coop',    require('./routes/coop'));
  app.use('/api/orders',  require('./routes/orders'));
  app.use('/api/admin',   require('./routes/admin'));
  app.use('/api/public',  publicLimiter, require('./routes/public'));
  app.use('/api/v1',      publicLimiter, require('./routes/quote'));

  app.post('/api/public/lead', leadLimiter, (_req, _res, next) => next());

  // ── 12. Page Routes ────────────────────────────────────────────────────────
  const pub = (f) => path.join(__dirname, '..', 'public', f);
  app.get('/quote',     (_req, res) => res.sendFile(pub('quote.html')));
  app.get('/success',   (_req, res) => res.sendFile(pub('success.html')));
  app.get('/login',     (_req, res) => res.sendFile(pub('login.html')));
  app.get('/dashboard', (_req, res) => res.sendFile(pub('dashboard.html')));
  app.get('/drivers',   (_req, res) => res.sendFile(pub('drivers.html')));
  app.get('/join',      (_req, res) => res.sendFile(pub('join.html')));
  app.get('/partners',  (_req, res) => res.sendFile(pub('partners.html')));  // was missing

  // ── 13. API 404 handler ──────────────────────────────────────────────────────
  // Handles unmatched /api/* routes only — must come before errorHandler.
  app.use('/api', notFound);

  // ── 14. Global error handler ───────────────────────────────────────────────
  app.use(errorHandler);

  // ── 15. Catch-all: redirect truly unknown HTML paths to homepage ────────────
  // IMPORTANT: must be LAST so it never intercepts valid page or API routes.
  // Previously this was registered before page routes, causing /partners and
  // other valid pages to silently redirect to / instead of serving the page.
  app.use((_req, res) => res.redirect('/'));

  return app;
}

module.exports = { createApp, renderTenantHtml };
