/**
 * wsServer.js — WebSocket server factory.
 *
 * Attaches a WebSocket server to an existing HTTP server and returns
 * two broadcast helpers that route modules and services can use to push
 * real-time events to connected clients.
 *
 * Protocol:
 *   Clients connect to ws://<host>/ws and send ONE subscribe message:
 *
 *     { "type": "subscribe", "partnerId": "coop_abc123" }
 *       or
 *     { "type": "subscribe", "partner_id": "<uuid>", "coop_slug": "<slug>" }
 *
 *   The server registers the socket under BOTH the partner_id AND the coop
 *   slug so broadcasts succeed regardless of which key callers use.
 *
 * Broadcast events sent to subscribed clients (examples):
 *   Coop R ← { type: 'coopR_new_order',       sound: 'ding_dong', order: {...} }
 *   Coop A ← { type: 'coopA_order_accepted',   order_id }
 *   Coop A ← { type: 'coopA_inspection_passed', payment_deadline_at }
 *
 * @module server/websocket/wsServer
 */
'use strict';

const { WebSocketServer } = require('ws');

/**
 * Initialise the WebSocket server and attach it to the given HTTP server.
 *
 * @param {import('http').Server} httpServer - The Node HTTP server to attach to
 * @param {Function} getDb - Lazy getter for the DB singleton (avoids circular dep)
 * @returns {{
 *   wss: import('ws').WebSocketServer,
 *   broadcastToSlug:    (channelKey: string, payload: object) => number,
 *   broadcastToPartner: (partnerId: string, coopSlug: string, payload: object) => number
 * }}
 */
function createWsServer(httpServer, getDb) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // ── Channel map ─────────────────────────────────────────────────────────────
  // Map: channel_key → Set<WebSocket>
  // channel_key is either a partner_id (UUID) or a coop_slug (string)
  const channelSockets = new Map();

  function registerSocket(ws, ...keys) {
    for (const key of keys) {
      if (!key) continue;
      if (!channelSockets.has(key)) channelSockets.set(key, new Set());
      channelSockets.get(key).add(ws);
    }
    // Store all keys on the socket so we can clean up on close
    ws._channels = (ws._channels || []).concat(keys.filter(Boolean));
  }

  function unregisterSocket(ws) {
    for (const key of (ws._channels || [])) {
      if (channelSockets.has(key)) channelSockets.get(key).delete(ws);
    }
    ws._channels = [];
  }

  // ── Broadcast helpers ───────────────────────────────────────────────────────

  /**
   * Broadcast a JSON payload to all live sockets subscribed to channelKey.
   *
   * @param {string} channelKey - partner_id OR coop_slug
   * @param {object} payload
   * @returns {number} Number of clients reached
   */
  function broadcastToSlug(channelKey, payload) {
    const sockets = channelSockets.get(channelKey);
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

  /**
   * Broadcast to both the partner_id channel and the coop_slug channel.
   * Ensures Coop R receives the message whether they subscribed by id or slug.
   *
   * @param {string} partnerId
   * @param {string} coopSlug
   * @param {object} payload
   * @returns {number} Number of clients reached
   */
  function broadcastToPartner(partnerId, coopSlug, payload) {
    let sent = 0;
    if (partnerId) sent += broadcastToSlug(partnerId, payload);
    if (coopSlug && coopSlug !== partnerId) sent += broadcastToSlug(coopSlug, payload);
    return sent;
  }

  // ── Connection handler ──────────────────────────────────────────────────────

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);

        if (msg.type === 'subscribe') {
          unregisterSocket(ws);

          // Accept both camelCase (new sprint spec) and snake_case (legacy)
          const partnerId = msg.partnerId || msg.partner_id || null;
          let   coopSlug  = msg.coopSlug  || msg.coop_slug  || null;

          // If only partner_id supplied, derive slug from DB for dual-channel coverage
          if (partnerId && !coopSlug) {
            try {
              const db   = getDb();
              const data = db._data();
              const p    = data.partners.find((x) => x.id === partnerId);
              if (p) {
                coopSlug = p.slug ||
                  (p.company_name || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);
              }
            } catch { /* non-fatal — DB may not be ready */ }
          }

          registerSocket(ws, partnerId, coopSlug);
          ws.send(JSON.stringify({
            type:      'subscribed',
            partnerId,
            coopSlug,
            channels:  [partnerId, coopSlug].filter(Boolean),
          }));
        }

        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch { /* ignore malformed frames */ }
    });

    ws.on('close', () => unregisterSocket(ws));
    ws.on('error', () => unregisterSocket(ws));
  });

  return { wss, broadcastToSlug, broadcastToPartner };
}

module.exports = { createWsServer };
