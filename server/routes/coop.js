/**
 * /api/coop — tenant info endpoint
 * Returns the current tenant config so client-side JS can read branding,
 * cities, and corridor without needing server-side rendering.
 */
const express = require('express');
const { TENANTS } = require('../config/tenants');

const router = express.Router();

// GET /api/coop  — returns current tenant (resolved by requireTenant middleware)
router.get('/', (req, res) => {
  const t = req.tenant;
  res.json({
    slug: t.slug,
    name: t.name,
    color: t.color,
    market: t.market,
    corridor: t.corridor,
    logo_letter: t.logo_letter,
    cities: (t.cities || []).map((name) => ({ name })),
  });
});

// GET /api/coop/all  — list all registered tenants (admin/CLI use)
router.get('/all', (req, res) => {
  const list = Object.values(TENANTS)
    .filter((t) => t.slug !== 'default')
    .map((t) => ({ slug: t.slug, name: t.name, market: t.market, cities: t.cities }));
  res.json({ tenants: list });
});

module.exports = router;
