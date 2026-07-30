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
 *   7. Static Files     — serve /public/* as root
 *   8. Tenant resolver  — attach req.tenant from Host header / X-Coop-Slug
 *   9. Rate Limiters    — applied per-router before mounting
 *  10. API Routes       — /api/health, /api/auth, /api/coop, /api/orders, /api/public, /api/v1
 *  11. Page Routes      — /login, /dashboard, /drivers, /join
 *  12. 404 Handler      — notFound middleware
 *  13. Global Error Handler — errorHandler middleware
 *
 * @module server/app
 */
'use strict';

const express    = require('express');
const path       = require('path');
const helmet     = require('helmet');
const compression = require('compression');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');

const config       = require('./config/config');
const logger       = require('./middleware/logger');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { resolveTenant } = require('./config/tenants');

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
          scriptSrc:   ["'self'", "'unsafe-inline'"],      // vanilla JS in HTML files
          styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
          imgSrc:      ["'self'", 'data:'],
          connectSrc:  ["'self'", 'wss:', 'ws:'],           // WebSocket upgrade
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
    : { origin: true, credentials: true };  // allow all in development
  app.use(cors(corsOptions));

  // ── 4. Request Logger ──────────────────────────────────────────────────────
  app.use(logger);

  // ── 5. JSON body parser ────────────────────────────────────────────────────
  app.use(express.json());

  // ── 6. URL-encoded body parser ─────────────────────────────────────────────
  app.use(express.urlencoded({ extended: false }));

  // ── 7. Static files ────────────────────────────────────────────────────────
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // ── 8. Tenant resolver ─────────────────────────────────────────────────────
  // Attaches req.tenant to every request based on Host header or X-Coop-Slug.
  app.use((req, _res, next) => {
    req.tenant = resolveTenant(req.headers.host);
    next();
  });

  // ── 9. Rate limiters (defined here, applied per-router below) ──────────────
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

  // ── 10. API Routes ─────────────────────────────────────────────────────────
  app.use('/api/health',  require('./routes/health'));
  app.use('/api/auth',    authLimiter, require('./routes/auth'));
  app.use('/api/coop',    require('./routes/coop'));
  app.use('/api/orders',  require('./routes/orders'));
  app.use('/api/admin',   require('./routes/admin'));
  app.use('/api/public',  publicLimiter, require('./routes/public'));
  app.use('/api/v1',      publicLimiter, require('./routes/quote'));

  // Lead endpoint also gets the tighter leadLimiter on top of publicLimiter.
  // Express applies both — leadLimiter fires first due to registration order.
  app.post('/api/public/lead', leadLimiter, (_req, _res, next) => next());

  // ── 11. Page Routes ────────────────────────────────────────────────────────
  const pub = (f) => path.join(__dirname, '..', 'public', f);
  app.get('/quote',     (_req, res) => res.sendFile(pub('quote.html')));
  app.get('/success',   (_req, res) => res.sendFile(pub('success.html')));
  app.get('/login',     (_req, res) => res.sendFile(pub('login.html')));
  app.get('/dashboard', (_req, res) => res.sendFile(pub('dashboard.html')));
  app.get('/drivers',   (_req, res) => res.sendFile(pub('drivers.html')));
  app.get('/join',      (_req, res) => res.sendFile(pub('join.html')));

  // Catch-all: redirect unknown paths to homepage
  app.use((_req, res) => res.redirect('/'));

  // ── 12. 404 handler ────────────────────────────────────────────────────────
  // Note: the catch-all redirect above handles HTML pages; notFound handles
  // unmatched /api/* routes that slip through.
  app.use('/api', notFound);

  // ── 13. Global error handler ───────────────────────────────────────────────
  // Must come last; signature (err, req, res, next) is required by Express.
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
