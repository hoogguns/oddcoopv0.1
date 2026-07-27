/**
 * OddCoop / PurCheaper server entry point.
 * v2: WebSocket layer added for real-time Coop R "ding-dong" notifications.
 */
const http     = require('http');
const express  = require('express');
const path     = require('path');
const { WebSocketServer } = require('ws');
const { resolveTenant } = require('./config/tenants');
const { getDb }         = require('./db');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 3847;

// ── WebSocket server ─────────────────────────────────────────────────────────
// Clients connect to ws://<host>/ws and send:
//   { type: 'subscribe', coop_slug: '<slug>', partner_id: '<id>' }
// Server broadcasts:
//   { type: 'coopR_new_order', order: {...}, sound: 'ding_dong' }

const wss = new WebSocketServer({ server, path: '/ws' });

// Map: coop_slug → Set<WebSocket>
const coopSockets = new Map();

function registerSocket(ws, coopSlug) {
  if (!coopSockets.has(coopSlug)) coopSockets.set(coopSlug, new Set());
  coopSockets.get(coopSlug).add(ws);
  ws._coopSlug = coopSlug;
}

function unregisterSocket(ws) {
  if (ws._coopSlug && coopSockets.has(ws._coopSlug)) {
    coopSockets.get(ws._coopSlug).delete(ws);
  }
}

/** Broadcast a JSON payload to all live sockets subscribed to coopSlug */
function broadcastToSlug(coopSlug, payload) {
  const sockets = coopSockets.get(coopSlug);
  if (!sockets || !sockets.size) return 0;
  const msg = JSON.stringify(payload);
  let sent = 0;
  for (const ws of sockets) {
    if (ws.readyState === ws.OPEN) {
      ws.send(msg);
      sent++;
    }
  }
  return sent;
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'subscribe' && msg.coop_slug) {
        unregisterSocket(ws);           // remove old subscription if any
        registerSocket(ws, msg.coop_slug);
        ws.send(JSON.stringify({ type: 'subscribed', coop_slug: msg.coop_slug }));
      }
      if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
    } catch { /* ignore malformed */ }
  });
  ws.on('close', () => unregisterSocket(ws));
  ws.on('error', () => unregisterSocket(ws));
});

// Expose broadcast so route modules can import it
app.locals.broadcastToSlug = broadcastToSlug;
app.locals.wss             = wss;

// ── middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// attach tenant to every request
app.use((req, res, next) => {
  req.tenant = resolveTenant(req.headers.host);
  next();
});

// ── boot DB + auto-seed ───────────────────────────────────────────────────────
try {
  const db = getDb();
  const d  = db._data();
  const isEmpty =
    (!d.partners || d.partners.length === 0) &&
    (!d.drivers  || d.drivers.length  === 0) &&
    (!d.orders   || d.orders.length   === 0);
  if (isEmpty) {
    console.log('📦  Empty database detected — running auto-seed...');
    const { runSeed } = require('./seed');
    runSeed();
    console.log('✅  Auto-seed complete.');
  }
} catch (e) {
  console.error('DB init / seed error:', e.message);
}

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

// fallback → login
app.use((_req, res) => res.redirect('/login'));

// ── start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`OddCoop running on http://localhost:${PORT}`);
  console.log(`  WebSocket  → ws://localhost:${PORT}/ws`);
  console.log(`  /login     → partner & driver login`);
  console.log(`  /dashboard → partner dashboard`);
  console.log(`  /drivers   → driver portal`);
  console.log(`  /join      → coop network onboarding`);
});

module.exports = { app, server, broadcastToSlug };
