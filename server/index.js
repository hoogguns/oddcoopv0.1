/**
 * OddCoop / PurCheaper server entry point.
 */
const express  = require('express');
const path     = require('path');
const { resolveTenant } = require('./config/tenants');
const { getDb }         = require('./db');

const app  = express();
const PORT = process.env.PORT || 3847;

// ── middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// attach tenant to every request
app.use((req, res, next) => {
  req.tenant = resolveTenant(req.headers.host);
  next();
});

// boot DB early so seed data is available before first request
try { getDb(); } catch (e) { console.error('DB init error:', e.message); }

// ── routes ────────────────────────────────────────────────────────────────────
const authRouter    = require('./routes/auth');
const coopRouter    = require('./routes/coop');
const ordersRouter  = require('./routes/orders');
const publicRouter  = require('./routes/public');

app.use('/api/auth',    authRouter);
app.use('/api/coop',    coopRouter);
app.use('/api/orders',  ordersRouter);
app.use('/api/public',  publicRouter);

// ── page routes ───────────────────────────────────────────────────────────────
app.get('/login',     (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/dashboard', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html')));
app.get('/drivers',   (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'drivers.html')));
app.get('/join',      (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'join.html')));

// fallback → login (app.use avoids Express 5 wildcard path-to-regexp crash)
app.use((_req, res) => res.redirect('/login'));

app.listen(PORT, () => {
  console.log(`OddCoop running on http://localhost:${PORT}`);
  console.log(`  /login      → partner & driver login`);
  console.log(`  /dashboard  → partner dashboard`);
  console.log(`  /drivers    → driver portal`);
  console.log(`  /join       → coop network onboarding`);
});
