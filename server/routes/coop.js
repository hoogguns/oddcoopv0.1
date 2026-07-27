/**
 * /api/coop routes
 *
 * GET  /api/coop                        — current tenant branding
 * GET  /api/coop/all                    — list all registered coops
 * GET  /api/coop/network                — full network summary with driver counts
 * GET  /api/coop/territory/:zip         — which coops cover a ZIP code
 * POST /api/coop/register               — self-service coop onboarding
 * GET  /api/coop/:slug                  — single coop detail
 *
 * ── Cross-coop transaction endpoints ──
 * POST /api/coop/orders/:id/notify      — push new pickup order to Coop R (WS + webhook)
 * POST /api/coop/orders/:id/accept      — Coop R formally accepts a pickup order
 * GET  /api/coop/orders/incoming        — list orders assigned to my coop as Coop R
 */
const express = require('express');
const { v4: uuid } = require('uuid');
const { getTenants, STATIC_TENANTS } = require('../config/tenants');
const { getDb } = require('../db');
const { requirePartner } = require('../middleware/auth');
const { getNetworkSummary, coopsForZip } = require('../services/network');
const { getOrderById } = require('../services/orders');
const { notifyCoopR, notifyCoopA } = require('../services/notify');

const router = express.Router();

// ── existing: current tenant ─────────────────────────────────────────────────
router.get('/', (req, res) => {
  const t = req.tenant;
  res.json({
    slug:         t.slug,
    name:         t.name,
    color:        t.color,
    market:       t.market,
    corridor:     t.corridor,
    logo_letter:  t.logo_letter,
    cities:      (t.cities || []).map((name) => ({ name })),
    zip_codes:    t.zip_codes || [],
  });
});

// ── existing: list all ───────────────────────────────────────────────────────
router.get('/all', (req, res) => {
  const list = Object.values(getTenants())
    .filter((t) => t.slug !== 'default')
    .map((t) => ({ slug: t.slug, name: t.name, market: t.market, cities: t.cities, zip_codes: t.zip_codes || [] }));
  res.json({ tenants: list });
});

// ── new: full network summary ────────────────────────────────────────────────
router.get('/network', (req, res) => {
  try {
    const summary = getNetworkSummary();
    res.json({ coops: summary, count: summary.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── new: territory lookup by ZIP ─────────────────────────────────────────────
router.get('/territory/:zip', (req, res) => {
  const coops = coopsForZip(req.params.zip);
  if (!coops.length) {
    return res.status(404).json({ zip: req.params.zip, coops: [], covered: false });
  }
  res.json({
    zip:     req.params.zip,
    covered: true,
    primary: coops[0].slug,
    coops:   coops.map((c) => ({ slug: c.slug, name: c.name, market: c.market })),
  });
});

// ── new: incoming orders for this coop as Coop R ─────────────────────────────
// Returns all orders where pickup_coop_slug matches the authenticated partner's slug/id
router.get('/orders/incoming', requirePartner, (req, res) => {
  const db   = getDb();
  const data = db._data();
  // Find the requesting partner's slug (check both coops and partners tables)
  const partnerId = req.user.id;
  const partner   = data.partners.find((p) => p.id === partnerId);
  if (!partner) return res.status(404).json({ error: 'Partner not found' });

  // Match on either pickup_coop_id OR pickup_coop_slug matching the partner's company slug
  const slug = partner.slug ||
    partner.company_name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);

  const orders = data.orders
    .filter((o) =>
      o.pickup_coop_id === partnerId ||
      o.pickup_coop_slug === slug
    )
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 100);

  res.json({
    incoming_orders: orders,
    total: orders.length,
    note: 'These orders are in your pickup territory. Accept them before 20:00 local time.',
  });
});

// ── new: notify Coop R of a new pickup order ─────────────────────────────────
// Called internally after order creation (cross-coop) or manually by Coop A.
// Auth: requirePartner (Coop A must own the order)
router.post('/orders/:id/notify', requirePartner, async (req, res) => {
  const order = getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.partner_id !== req.user.id) {
    return res.status(403).json({ error: 'Order does not belong to your coop' });
  }
  if (!order.pickup_coop_slug) {
    return res.status(400).json({ error: 'Order has no pickup coop assigned — not a cross-coop order' });
  }

  try {
    const result = await notifyCoopR(order);
    // Log notification event
    const db = getDb();
    db.prepare(
      `INSERT INTO order_events (id, order_id, actor_type, actor_id, event, detail)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      uuid(), order.id, 'system', null,
      'coopR_notified',
      JSON.stringify({
        pickup_coop_slug: order.pickup_coop_slug,
        ws_sent:  result.ws_sent,
        webhook:  result.webhook,
      })
    );
    res.json({
      ok: true,
      order_id:         order.id,
      pickup_coop_slug: order.pickup_coop_slug,
      ws_clients_reached: result.ws_sent,
      webhook:          result.webhook,
      message:          result.ws_sent > 0
        ? `Ding-dong sent to ${result.ws_sent} live Coop R client(s)`
        : 'No live WS clients — webhook attempted if notify_url configured',
    });
  } catch (err) {
    console.error('notifyCoopR error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── new: Coop R accepts a pickup order ───────────────────────────────────────
// Coop R (authenticated as a partner) calls this to formally accept the order.
// Validates:
//   1. Order exists
//   2. Calling partner is the designated Coop R (pickup_coop_id or slug match)
//   3. Order has not already been accepted
//   4. Both Coop A and Coop R are in good standing
router.post('/orders/:id/accept', requirePartner, async (req, res) => {
  const db   = getDb();
  const data = db._data();
  const order = getOrderById(req.params.id);

  if (!order) return res.status(404).json({ error: 'Order not found' });

  const partnerId = req.user.id;
  const partner   = data.partners.find((p) => p.id === partnerId);
  if (!partner) return res.status(404).json({ error: 'Partner not found' });

  // Derive slug from partner's company name (same algorithm used in /register)
  const partnerSlug = partner.slug ||
    partner.company_name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);

  // Validate this partner IS Coop R for this order
  const isCoopR =
    order.pickup_coop_id   === partnerId ||
    order.pickup_coop_slug === partnerSlug;

  if (!isCoopR) {
    return res.status(403).json({
      error: 'Your coop is not the designated territory coop for this order',
      order_pickup_coop_slug: order.pickup_coop_slug,
      your_slug: partnerSlug,
    });
  }

  // Must be a cross-coop pending order
  if (!['pending', 'assigned'].includes(order.status)) {
    return res.status(400).json({
      error: `Cannot accept order in status: ${order.status}`,
    });
  }

  // Must not already be accepted
  if (order.pickup_coop_accepted_at) {
    return res.status(409).json({
      error: 'Order already accepted',
      accepted_at: order.pickup_coop_accepted_at,
    });
  }

  // Standing check — Coop R must be in good standing
  if (partner.coop_standing === 'suspended') {
    return res.status(403).json({
      error: 'Your coop is currently suspended and cannot accept orders',
    });
  }

  // Also check Coop A standing before proceeding
  const coopA = data.partners.find((p) => p.id === order.buying_coop_id || p.id === order.partner_id);
  if (coopA && coopA.coop_standing === 'suspended') {
    return res.status(400).json({
      error: 'The buying coop is suspended — this order cannot be accepted',
    });
  }

  // ── Mutate order ──────────────────────────────────────────────────────────
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const row = data.orders.find((o) => o.id === order.id);
  if (!row) return res.status(500).json({ error: 'Order row not found in store' });

  row.pickup_coop_accepted_at = now;
  row.pickup_coop_id          = partnerId;  // resolve to concrete partner id
  row.pickup_coop_slug        = partnerSlug;
  row.updated_at              = now;
  // Advance status to 'assigned' if still pending
  if (row.status === 'pending') row.status = 'assigned';

  db._replace(data);

  // Log event
  db.prepare(
    `INSERT INTO order_events (id, order_id, actor_type, actor_id, event, detail)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    uuid(), order.id, 'coop_r', partnerId,
    'coop_r_accepted',
    JSON.stringify({
      pickup_coop_id:   partnerId,
      pickup_coop_slug: partnerSlug,
      accepted_at:      now,
      notes:            (req.body && req.body.notes) || null,
    })
  );

  // ── Notify Coop A ─────────────────────────────────────────────────────────
  const freshOrder = getOrderById(order.id);
  let coopANotify = null;
  try {
    coopANotify = await notifyCoopA(freshOrder, 'accepted');
  } catch (e) {
    console.error('notifyCoopA error (non-fatal):', e.message);
  }

  res.json({
    ok: true,
    order:        freshOrder,
    accepted_at:  now,
    coop_a_notified: coopANotify,
    message: [
      `Order accepted. You are responsible for pickup before 20:00 local time.`,
      `Check your dashboard for the checklist and directions.`,
      `Coop A (${coopA ? coopA.company_name : order.partner_name}) has been notified.`,
    ].join(' '),
  });
});

// ── new: single coop detail ──────────────────────────────────────────────────
router.get('/:slug', (req, res) => {
  const tenants = getTenants();
  const t = tenants[req.params.slug];
  if (!t || t.slug === 'default') return res.status(404).json({ error: 'Coop not found' });
  res.json(t);
});

// ── new: self-service onboarding ─────────────────────────────────────────────
router.post('/register', (req, res) => {
  const {
    name, contact_name, contact_email, contact_phone,
    market, corridor, cities, zip_codes, color, website, notify_url,
  } = req.body || {};

  if (!name || !contact_email || !zip_codes || !zip_codes.length) {
    return res.status(400).json({
      error: 'name, contact_email, and zip_codes (array) are required',
    });
  }

  // derive slug from name
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);
  const tenants = getTenants();
  if (tenants[slug] && slug !== 'default') {
    return res.status(409).json({ error: `A coop with slug "${slug}" already exists` });
  }

  const db = getDb();
  const data = db._data();
  if (!data.coops) data.coops = [];

  // Prevent duplicate email registrations
  const existing = data.coops.find(
    (c) => c.contact_email === contact_email.toLowerCase().trim()
  );
  if (existing) {
    return res.status(409).json({ error: 'A coop with that contact email already exists', slug: existing.slug });
  }

  const coop = {
    id:            uuid(),
    slug,
    name,
    contact_name:  contact_name  || null,
    contact_email: contact_email.toLowerCase().trim(),
    contact_phone: contact_phone || null,
    market:        market        || name,
    corridor:      corridor      || null,
    cities:        Array.isArray(cities) ? cities : [],
    zip_codes:     Array.isArray(zip_codes) ? zip_codes.map(String) : [],
    color:         color         || '#2d8b8b',
    logo_letter:   name[0].toUpperCase(),
    website:       website       || null,
    notify_url:    notify_url    || null,   // webhook for offline notifications
    active:        true,
    created_at:    new Date().toISOString(),
  };

  data.coops.push(coop);
  db._replace(data);

  res.status(201).json({
    coop,
    message: `Welcome to the OddCoop network, ${name}! Your territory covers ${coop.zip_codes.length} ZIP code(s).`,
    network_size: (data.coops.length),
    benefit: 'You now have same-day pickup capacity in all current coop territories, and they gain yours.',
  });
});

module.exports = router;
