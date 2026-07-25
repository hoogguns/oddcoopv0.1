/**
 * /api/coop routes
 *
 * GET  /api/coop              — current tenant branding (existing)
 * GET  /api/coop/all          — list all registered coops (existing)
 * GET  /api/coop/network      — full network summary with driver counts
 * GET  /api/coop/territory/:zip — which coops cover a ZIP code
 * POST /api/coop/register     — self-service coop onboarding
 * GET  /api/coop/:slug        — single coop detail
 */
const express = require('express');
const { v4: uuid } = require('uuid');
const { getTenants, STATIC_TENANTS } = require('../config/tenants');
const { getDb } = require('../db');
const { getNetworkSummary, coopsForZip } = require('../services/network');

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
    market, corridor, cities, zip_codes, color, website,
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
