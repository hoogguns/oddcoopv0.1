/**
 * routes/admin.js — OddCoop admin portal API.
 *
 * All endpoints require a valid JWT with role === 'admin'.
 * Scaffold for Sprint 3; full metrics + audit log in Sprint 5.
 *
 * GET  /api/admin/coops                          — list all coops + standing
 * GET  /api/admin/coops/:id                      — coop detail + orders summary
 * POST /api/admin/coops/:id/suspend              — suspend a coop
 * POST /api/admin/coops/:id/unsuspend            — restore good standing
 * POST /api/admin/coops/:id/strike               — record a late-payment strike
 * DELETE /api/admin/coops/:id/strike/:strikeIdx  — remove a specific strike
 * GET  /api/admin/orders                         — all orders (cross-coop view)
 * GET  /api/admin/metrics                        — platform-wide metrics summary
 * GET  /api/admin/audit                          — recent order_events audit log
 */
'use strict';

const express = require('express');
const { v4: uuid } = require('uuid');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/** All admin routes require role=admin JWT */
router.use(requireAuth('admin'));

// ── helpers ───────────────────────────────────────────────────────────────────

function now() {
  return new Date().toISOString();
}

function partnerToCoopSummary(p) {
  const strikes = Array.isArray(p.late_payment_strikes) ? p.late_payment_strikes : [];
  return {
    id:             p.id,
    company_name:   p.company_name,
    email:          p.email,
    plan:           p.plan || 'pilot',
    standing:       p.coop_standing || 'good',
    strikes_count:  strikes.length,
    suspended_at:   p.suspended_at   || null,
    suspended_reason: p.suspended_reason || null,
    active:         !!p.active,
    created_at:     p.created_at || null,
  };
}

// ── GET /api/admin/coops ─────────────────────────────────────────────────────
router.get('/coops', (req, res) => {
  const db    = getDb();
  const data  = db._data();
  const coops = (data.partners || []).map(partnerToCoopSummary);
  res.json({ coops, total: coops.length });
});

// ── GET /api/admin/coops/:id ─────────────────────────────────────────────────
router.get('/coops/:id', (req, res) => {
  const db      = getDb();
  const data    = db._data();
  const partner = data.partners.find((p) => p.id === req.params.id);
  if (!partner) return res.status(404).json({ error: 'Coop not found' });

  const orderCount = (data.orders || []).filter((o) => o.partner_id === partner.id).length;
  const paidCount  = (data.orders || []).filter((o) => o.partner_id === partner.id && o.paid).length;

  res.json({
    coop: partnerToCoopSummary(partner),
    orders_total: orderCount,
    orders_paid:  paidCount,
    strikes: Array.isArray(partner.late_payment_strikes) ? partner.late_payment_strikes : [],
  });
});

// ── POST /api/admin/coops/:id/suspend ────────────────────────────────────────
router.post('/coops/:id/suspend', (req, res) => {
  const db      = getDb();
  const data    = db._data();
  const partner = data.partners.find((p) => p.id === req.params.id);
  if (!partner) return res.status(404).json({ error: 'Coop not found' });
  if (partner.coop_standing === 'suspended') {
    return res.status(409).json({ error: 'Coop is already suspended' });
  }

  const reason = (req.body && req.body.reason) || 'Admin suspension';
  partner.coop_standing    = 'suspended';
  partner.suspended_at     = now();
  partner.suspended_reason = reason;
  partner.active           = false;
  db._replace(data);

  // Log to order_events as a system event
  db.prepare(
    `INSERT INTO order_events (id, order_id, actor_type, actor_id, event, detail)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    uuid(), null, 'admin', req.user.id, 'coop_suspended',
    JSON.stringify({ partner_id: partner.id, company_name: partner.company_name, reason })
  );

  res.json({ ok: true, coop: partnerToCoopSummary(partner), message: `${partner.company_name} suspended.` });
});

// ── POST /api/admin/coops/:id/unsuspend ──────────────────────────────────────
router.post('/coops/:id/unsuspend', (req, res) => {
  const db      = getDb();
  const data    = db._data();
  const partner = data.partners.find((p) => p.id === req.params.id);
  if (!partner) return res.status(404).json({ error: 'Coop not found' });

  partner.coop_standing    = 'good';
  partner.suspended_at     = null;
  partner.suspended_reason = null;
  partner.active           = true;
  db._replace(data);

  db.prepare(
    `INSERT INTO order_events (id, order_id, actor_type, actor_id, event, detail)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    uuid(), null, 'admin', req.user.id, 'coop_unsuspended',
    JSON.stringify({ partner_id: partner.id, company_name: partner.company_name })
  );

  res.json({ ok: true, coop: partnerToCoopSummary(partner), message: `${partner.company_name} restored to good standing.` });
});

// ── POST /api/admin/coops/:id/strike ────────────────────────────────────────
router.post('/coops/:id/strike', (req, res) => {
  const db      = getDb();
  const data    = db._data();
  const partner = data.partners.find((p) => p.id === req.params.id);
  if (!partner) return res.status(404).json({ error: 'Coop not found' });

  if (!Array.isArray(partner.late_payment_strikes)) partner.late_payment_strikes = [];

  const strike = {
    id:       uuid(),
    reason:   (req.body && req.body.reason) || 'Late payment',
    order_id: (req.body && req.body.order_id) || null,
    issued_at: now(),
    issued_by: req.user.id,
  };
  partner.late_payment_strikes.push(strike);

  // Auto-escalate standing based on strike count
  const count = partner.late_payment_strikes.length;
  if (count >= 3) {
    partner.coop_standing    = 'suspended';
    partner.suspended_at     = now();
    partner.suspended_reason = 'Automatic suspension: 3 late payment strikes';
    partner.active           = false;
  } else if (count >= 1) {
    if (partner.coop_standing !== 'suspended') partner.coop_standing = 'warning';
  }

  db._replace(data);

  db.prepare(
    `INSERT INTO order_events (id, order_id, actor_type, actor_id, event, detail)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    uuid(), strike.order_id, 'admin', req.user.id, 'late_payment_strike',
    JSON.stringify({ partner_id: partner.id, strike_id: strike.id, count })
  );

  res.json({
    ok: true,
    coop: partnerToCoopSummary(partner),
    strike,
    strikes_count: count,
    message: count >= 3
      ? `${partner.company_name} automatically suspended after 3 strikes.`
      : `Strike recorded. ${partner.company_name} now has ${count} strike(s).`,
  });
});

// ── DELETE /api/admin/coops/:id/strike/:strikeIdx ────────────────────────────
router.delete('/coops/:id/strike/:strikeIdx', (req, res) => {
  const db      = getDb();
  const data    = db._data();
  const partner = data.partners.find((p) => p.id === req.params.id);
  if (!partner) return res.status(404).json({ error: 'Coop not found' });
  if (!Array.isArray(partner.late_payment_strikes)) {
    return res.status(404).json({ error: 'No strikes on record' });
  }

  const idx = parseInt(req.params.strikeIdx, 10);
  if (isNaN(idx) || idx < 0 || idx >= partner.late_payment_strikes.length) {
    return res.status(404).json({ error: 'Strike index out of range' });
  }

  const removed = partner.late_payment_strikes.splice(idx, 1)[0];
  // Recalculate standing if suspended by auto-rule
  if (partner.coop_standing !== 'suspended' || partner.suspended_reason?.includes('Automatic')) {
    const count = partner.late_payment_strikes.length;
    partner.coop_standing = count >= 3 ? 'suspended' : count >= 1 ? 'warning' : 'good';
    if (count < 3) { partner.suspended_at = null; partner.suspended_reason = null; }
  }
  db._replace(data);

  res.json({ ok: true, removed, strikes_remaining: partner.late_payment_strikes.length });
});

// ── GET /api/admin/orders ────────────────────────────────────────────────────
router.get('/orders', (req, res) => {
  const db   = getDb();
  const data = db._data();
  const { status, q, limit = 100, offset = 0 } = req.query;

  let orders = data.orders || [];
  if (status) orders = orders.filter((o) => o.status === status);
  if (q) {
    const lc = q.toLowerCase();
    orders = orders.filter((o) =>
      (o.seller_name     || '').toLowerCase().includes(lc) ||
      (o.device_model    || '').toLowerCase().includes(lc) ||
      (o.external_ref    || '').toLowerCase().includes(lc) ||
      (o.id              || '').toLowerCase().includes(lc)
    );
  }

  const total = orders.length;
  orders = orders
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(Number(offset), Number(offset) + Number(limit));

  res.json({ orders, total, limit: Number(limit), offset: Number(offset) });
});

// ── GET /api/admin/metrics ───────────────────────────────────────────────────
router.get('/metrics', (req, res) => {
  const db   = getDb();
  const data = db._data();
  const orders   = data.orders   || [];
  const partners = data.partners || [];
  const drivers  = data.drivers  || [];

  const byStatus = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const paidVolume = orders
    .filter((o) => o.paid)
    .reduce((s, o) => s + Number(o.quoted_amount || 0), 0);

  const suspended = partners.filter((p) => p.coop_standing === 'suspended').length;
  const warning   = partners.filter((p) => p.coop_standing === 'warning').length;

  res.json({
    orders_total:   orders.length,
    orders_by_status: byStatus,
    paid_volume:    paidVolume,
    partners_total: partners.length,
    partners_suspended: suspended,
    partners_warning:   warning,
    drivers_total:  drivers.length,
    drivers_trained: drivers.filter((d) => d.trained).length,
  });
});

// ── GET /api/admin/audit ─────────────────────────────────────────────────────
router.get('/audit', (req, res) => {
  const db = getDb();
  const limit  = Math.min(parseInt(req.query.limit,  10) || 100, 500);
  const offset = parseInt(req.query.offset, 10) || 0;

  const events = db.prepare(
    `SELECT * FROM order_events ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(limit, offset);

  res.json({ events, limit, offset });
});

module.exports = router;
