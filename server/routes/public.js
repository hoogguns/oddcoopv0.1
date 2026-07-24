const express = require('express');
const { v4: uuid } = require('uuid');
const { getDb } = require('../db');

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  try {
    const db = getDb();
    const stats = db.prepare(
      `SELECT
        (SELECT COUNT(*) FROM orders)  AS orders,
        (SELECT COUNT(*) FROM partners WHERE active != 0) AS partners,
        (SELECT COUNT(*) FROM drivers  WHERE trained = 1) AS drivers`
    ).get();
    res.json({ ok: true, ...stats, tenant: req.tenant ? req.tenant.slug : 'default' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Stats for homepage hero
router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare(
      `SELECT
        (SELECT COUNT(*) FROM orders) AS orders,
        (SELECT COUNT(*) FROM partners WHERE active != 0) AS active_partner_accounts,
        (SELECT COUNT(*) FROM drivers  WHERE trained = 1) AS trained_drivers,
        (SELECT COALESCE(SUM(quoted_amount),0) FROM orders WHERE paid = 1) AS paid_volume`
    ).get();
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Coverage — returns tenant cities for homepage map / footer
router.get('/coverage', (req, res) => {
  const t = req.tenant;
  const cities = (t.cities || []).map((name) => ({ name }));
  res.json({
    market: t.market,
    corridor: t.corridor,
    cities,
  });
});

// Lead capture (contact form)
router.post('/lead', (req, res) => {
  const { type, name, email, company, phone, message } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO leads (id, type, name, email, company, phone, message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(uuid(), type || 'general', name, email, company || null, phone || null, message || null);
    res.json({ ok: true, message: "Got it — we'll be in touch today." });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
