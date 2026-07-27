/**
 * notify.js — OddCoop real-time notification service
 *
 * Handles two channels for Coop R "ding-dong" new-order alerts:
 *   1. WebSocket broadcast (instant, in-app) via server/index.js broadcastToSlug
 *   2. HTTP webhook POST to coop.notify_url (fallback for offline coops)
 *
 * Also handles Coop A "inspection_passed" and "accepted" callbacks.
 */

const https = require('https');
const http  = require('http');
const { getDb } = require('../db');

// ── helpers ───────────────────────────────────────────────────────────────────

function safePost(urlStr, body) {
  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL(urlStr); } catch { return resolve({ ok: false, error: 'invalid_url' }); }
    const payload  = JSON.stringify(body);
    const mod      = parsed.protocol === 'https:' ? https : http;
    const req      = mod.request(
      { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname + parsed.search,
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload),
          'X-OddCoop-Event': body.type || 'notify' } },
      (res) => {
        let data = '';
        res.on('data', (c) => data += c);
        res.on('end', () => resolve({ ok: res.statusCode < 300, status: res.statusCode }));
      }
    );
    req.setTimeout(4000, () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.write(payload);
    req.end();
  });
}

/** Resolve the express app so we can call broadcastToSlug without a circular dep */
function getBroadcast() {
  try {
    // index.js exports broadcastToSlug after server boots
    const { broadcastToSlug } = require('../index');
    return broadcastToSlug;
  } catch {
    return null;
  }
}

// ── notifyCoopR ───────────────────────────────────────────────────────────────
/**
 * Notify Coop R that a new pickup order is waiting for their acceptance.
 *
 * @param {object} order - full order row (from getOrderById)
 * @returns {{ ws_sent: number, webhook: object }}
 */
async function notifyCoopR(order) {
  const result = { ws_sent: 0, webhook: null };
  if (!order.pickup_coop_slug) return result;

  const payload = {
    type:         'coopR_new_order',
    sound:        'ding_dong',
    order_id:     order.id,
    order: {
      id:                order.id,
      status:            order.status,
      seller_name:       order.seller_name,
      pickup_address:    order.pickup_address,
      pickup_city:       order.pickup_city,
      pickup_zip:        order.pickup_zip,
      device_brand:      order.device_brand,
      device_model:      order.device_model,
      device_storage:    order.device_storage,
      device_condition:  order.device_condition,
      seller_offer_sameday: order.seller_offer_sameday,
      window_start:      order.window_start,
      window_end:        order.window_end,
      buying_coop_name:  order.buying_coop_name || order.partner_name,
    },
    message: `New pickup order in your territory — accept before 20:00 local time`,
    sent_at: new Date().toISOString(),
  };

  // 1. WebSocket broadcast
  const broadcast = getBroadcast();
  if (broadcast) {
    result.ws_sent = broadcast(order.pickup_coop_slug, payload);
  }

  // 2. HTTP webhook fallback
  const db   = getDb();
  const data = db._data();
  // look for notify_url in partners table (by pickup_coop_id) or coops table
  let notifyUrl = null;
  if (order.pickup_coop_id) {
    const partner = data.partners.find((p) => p.id === order.pickup_coop_id);
    if (partner && partner.notify_url) notifyUrl = partner.notify_url;
  }
  if (!notifyUrl && order.pickup_coop_slug) {
    const coop = (data.coops || []).find((c) => c.slug === order.pickup_coop_slug);
    if (coop && coop.notify_url) notifyUrl = coop.notify_url;
  }
  if (notifyUrl) {
    result.webhook = await safePost(notifyUrl, payload);
  }

  return result;
}

// ── notifyCoopA ───────────────────────────────────────────────────────────────
/**
 * Notify Coop A of an important event (accepted, inspection_passed, etc.).
 *
 * @param {object} order - full order row
 * @param {'accepted'|'inspection_passed'|'mismatch'} eventType
 */
async function notifyCoopA(order, eventType) {
  const result = { ws_sent: 0, webhook: null };

  const payloadMap = {
    accepted: {
      type:    'coopA_order_accepted',
      message: `Coop R has accepted the pickup for order ${order.id}`,
    },
    inspection_passed: {
      type:    'coopA_inspection_passed',
      message: `Device inspection PASSED — you have 1 hour to pay the seller`,
      payment_deadline_at: order.payment_deadline_at,
    },
    mismatch: {
      type:    'coopA_inspection_mismatch',
      message: `Device inspection FAILED — review required before payment`,
    },
  };

  const extra   = payloadMap[eventType] || { type: eventType, message: eventType };
  const payload = { ...extra, order_id: order.id, sent_at: new Date().toISOString() };

  // WebSocket — Coop A is identified by their partner_id / buying_coop_id
  // We broadcast to a channel named after the partner id (they subscribe with that)
  const broadcast = getBroadcast();
  if (broadcast && order.buying_coop_id) {
    result.ws_sent = broadcast(order.buying_coop_id, payload);
  }

  // Webhook
  const db   = getDb();
  const data = db._data();
  if (order.partner_id) {
    const partner = data.partners.find((p) => p.id === order.partner_id);
    if (partner && partner.notify_url) {
      result.webhook = await safePost(partner.notify_url, payload);
    }
  }

  return result;
}

module.exports = { notifyCoopR, notifyCoopA, safePost };
