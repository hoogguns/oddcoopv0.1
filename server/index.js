/**
 * OddCoop server entry point.
 * v3: WebSocket subscribe supports partner_id (from JWT session) OR coop_slug.
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
//
// Clients connect via ws://<host>/ws and send ONE subscribe message:
//
//   { type: 'subscribe', partner_id: '<id>' }      ← preferred (from JWT)
//   { type: 'subscribe', coop_slug:  '<slug>' }    ← also accepted
//
// The server registers the socket under BOTH the partner_id AND the slug so
// broadcasts can find the client regardless of which key callers use.
//
// Broadcast events sent to clients:
//   Coop R ← { type: 'coopR_new_order',      sound: 'ding_dong', order: {...} }
//   Coop A ← { type: 'coopA_order_accepted', order_id: '...' }
//   Coop A ← { type: 'coopA_inspection_passed', payment_deadline_at: '...' }

const wss = new WebSocketServer({ server, path: '/ws' });

// Map: channel_key → Set<WebSocket>
// channel_key is either a partner_id (UUID) or a coop_slug (string)
const channelSockets = new Map();

function registerSocket(ws, ...keys) {
  for (const key of keys) {
    if (!key) continue;
    if (!channelSockets.has(key)) channelSockets.set(key, new Set());
    channelSockets.get(key).add(ws);
  }
  // store all keys on the socket so we can clean up on close
  ws._channels = (ws._channels || []).concat(keys.filter(Boolean));
}

function unregisterSocket(ws) {
  for (const key of (ws._channels || [])) {
    if (channelSockets.has(key)) channelSockets.get(key).delete(ws);
  }
  ws._channels = [];
}

/**
 * Broadcast a JSON payload to all live sockets on the given channel.
 * @param {string} channelKey - partner_id OR coop_slug
 * @param {object} payload
 * @returns {number} clients reached
 */
function broadcastToSlug(channelKey, payload) {
  const sockets = channelSockets.get(channelKey);
  if (!sockets || !sockets.size) return 0;
  const msg = JSON.stringify(payload);
  let sent = 0;
  for (const ws of sockets) {
    if (ws.readyState === ws.OPEN) { ws.send(msg); sent++; }
  }
  return sent;
}

/**
 * Resolve slug → partner_id and vice versa, then broadcast to both channels.
 * This ensures Coop R receives the message whether they subscribed by id or slug.
 */
function broadcastToPartner(partnerId, coopSlug, payload) {
  let sent = 0;
  if (partnerId) sent += broadcastToSlug(partnerId, payload);
  if (coopSlug && coopSlug !== partnerId) sent += broadcastToSlug(coopSlug, payload);
  return sent;
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);

      if (msg.type === 'subscribe') {
        unregisterSocket(ws);

        const partnerId = msg.partner_id || null;
        let   coopSlug  = msg.coop_slug  || null;

        // If only partner_id supplied, derive slug from db for dual-channel coverage
        if (partnerId && !coopSlug) {
          try {
            const db   = getDb();
            const data = db._data();
            const p    = data.partners.find((x) => x.id === partnerId);
            if (p) {
              // Derive slug from company_name (same algorithm used in /register and /accept)
              coopSlug = p.slug ||
                (p.company_name || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);
            }
          } catch { /* non-fatal */ }
        }

        registerSocket(ws, partnerId, coopSlug);
        ws.send(JSON.stringify({
          type: 'subscribed',
          partner_id: partnerId,
          coop_slug:  coopSlug,
          channels:   [partnerId, coopSlug].filter(Boolean),
        }));
      }

      if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
    } catch { /* ignore malformed */ }
  });
  ws.on('close', () => unregisterSocket(ws));
  ws.on('error', () => unregisterSocket(ws));
});

// Expose broadcast so route / service modules can import without circular dep
app.locals.broadcastToSlug    = broadcastToSlug;
app.locals.broadcastToPartner = broadcastToPartner;
app.locals.wss                = wss;

// ── middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((req, res, next) => {
  req.tenant = resolveTenant(req.headers.host);
  next();
});

// ── boot DB + auto-seed ──────────────────────────────────────────────────────
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

// ── routes ───────────────────────────────────────────────────────────────────
const authRouter   = require('./routes/auth');
const coopRouter   = require('./routes/coop');
const ordersRouter = require('./routes/orders');
const publicRouter = require('./routes/public');

app.use('/api/auth',   authRouter);
app.use('/api/coop',   coopRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/public', publicRouter);

// ── page routes ──────────────────────────────────────────────────────────────
app.get('/login',     (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/dashboard', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html')));
app.get('/drivers',   (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'drivers.html')));
app.get('/join',      (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'join.html')));

app.use((_req, res) => res.redirect('/login'));

// ── start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`OddCoop running on http://localhost:${PORT}`);
  console.log(`  WebSocket  → ws://localhost:${PORT}/ws`);
  console.log(`  /login     → partner & driver login`);
  console.log(`  /dashboard → partner dashboard`);
  console.log(`  /drivers   → driver portal`);
  console.log(`  /join      → coop network onboarding`);
});

module.exports = { app, server, broadcastToSlug, broadcastToPartner };
