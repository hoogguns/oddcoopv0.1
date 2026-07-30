/**
 * routes/auth.js — Partner and driver authentication.
 *
 * POST /api/auth/partner/register  — create a new partner account
 * POST /api/auth/partner/login     — exchange credentials for a JWT
 * GET  /api/auth/partner/me        — retrieve authenticated partner profile
 * POST /api/auth/driver/login      — driver credential exchange
 * GET  /api/auth/driver/me         — retrieve authenticated driver profile
 */
'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const { getDb } = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/partner/register', (req, res) => {
  const { company_name, contact_name, email, password, phone, website } = req.body || {};
  if (!company_name || !contact_name || !email || !password) {
    return res.status(400).json({ error: 'company_name, contact_name, email, and password are required' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const db = getDb();
  const existing = db.prepare('SELECT id FROM partners WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const id = uuid();
  const api_key = 'dl_live_' + uuid().replace(/-/g, '').slice(0, 24);
  db.prepare(
    `INSERT INTO partners (id, company_name, contact_name, email, password_hash, phone, website, api_key, plan, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pilot', 1)`
  ).run(
    id,
    company_name,
    contact_name,
    email.toLowerCase(),
    bcrypt.hashSync(password, 10),
    phone || null,
    website || null,
    api_key
  );

  const token = signToken({ role: 'partner', id, email: email.toLowerCase(), company: company_name });
  res.status(201).json({
    token,
    partner: { id, company_name, contact_name, email: email.toLowerCase(), phone, website, plan: 'pilot', api_key },
  });
});

router.post('/partner/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const db = getDb();
  const partner = db.prepare('SELECT * FROM partners WHERE email = ?').get(email.toLowerCase());
  if (!partner || !bcrypt.compareSync(password, partner.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  // active defaults NULL in seed — treat NULL/0 the same as active (no approval flow yet)
  if (partner.active === 0) {
    return res.status(403).json({ error: 'Account suspended — contact support' });
  }

  const token = signToken({
    role: 'partner',
    id: partner.id,
    email: partner.email,
    company: partner.company_name,
  });
  res.json({
    token,
    partner: {
      id: partner.id,
      company_name: partner.company_name,
      contact_name: partner.contact_name,
      email: partner.email,
      phone: partner.phone,
      website: partner.website,
      plan: partner.plan,
      api_key: partner.api_key,
    },
  });
});

router.post('/driver/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const db = getDb();
  const emailNorm = String(email).trim().toLowerCase();
  const driver = db.prepare('SELECT * FROM drivers WHERE email = ?').get(emailNorm);
  if (!driver || !bcrypt.compareSync(password, driver.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = signToken({
    role: 'driver',
    id: driver.id,
    email: String(driver.email).toLowerCase(),
    name: driver.name,
  });
  res.json({
    token,
    driver: {
      id: driver.id,
      name: driver.name,
      email: String(driver.email).toLowerCase(),
      phone: driver.phone,
      vehicle: driver.vehicle,
      zones: JSON.parse(driver.zones || '[]'),
      rating: driver.rating,
      status: driver.status,
      driver_code: driver.driver_code,
      trained: !!driver.trained,
    },
  });
});

router.get('/partner/me', requireAuth('partner'), (req, res) => {
  const db = getDb();
  const partner = db
    .prepare(
      `SELECT id, company_name, contact_name, email, phone, website, plan, api_key, created_at
       FROM partners WHERE id = ?`
    )
    .get(req.user.id);
  if (!partner) return res.status(404).json({ error: 'Not found' });
  res.json({ partner });
});

router.get('/driver/me', requireAuth('driver'), (req, res) => {
  const db = getDb();
  const driver = db
    .prepare(
      `SELECT id, name, email, phone, vehicle, zones, rating, status, driver_code, trained, created_at
       FROM drivers WHERE id = ?`
    )
    .get(req.user.id);
  if (!driver) return res.status(404).json({ error: 'Not found' });
  res.json({
    driver: { ...driver, zones: JSON.parse(driver.zones || '[]'), trained: !!driver.trained },
  });
});

module.exports = router;
