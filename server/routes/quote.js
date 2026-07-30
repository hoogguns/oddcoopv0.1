/**
 * routes/quote.js — Public quote and device catalog API (v1).
 *
 * All endpoints are unauthenticated — this is the seller-facing public flow.
 *
 * GET  /api/v1/devices              — full device catalog
 * GET  /api/v1/devices/:brand       — catalog filtered by brand
 * GET  /api/v1/quote                — calculate Standard + Same-Day offer
 * GET  /api/v1/territory/:zip       — ZIP → coop coverage + same-day availability
 * POST /api/v1/orders               — create a seller-initiated order
 */
'use strict';

const express   = require('express');
const { v4: uuid } = require('uuid');
const quoteService     = require('../services/quoteService');
const territoryService = require('../services/territoryService');
const { getDb } = require('../db');

const router = express.Router();

// ── Standard response helpers ─────────────────────────────────────────────────

/**
 * Wrap a successful payload in the project's standard envelope.
 *
 * @param {import('express').Response} res
 * @param {object} data
 * @param {number} [status=200]
 */
function ok(res, data, status = 200) {
  res.status(status).json({ ok: true, ...data });
}

// ── GET /api/v1/devices ───────────────────────────────────────────────────────

/**
 * Return the full device catalog.
 * Optionally filter by ?brand=Apple
 */
router.get('/devices', (req, res) => {
  const catalog = quoteService.getCatalog(req.query.brand || null);
  ok(res, {
    brands:  quoteService.getBrands(),
    catalog,
  });
});

router.get('/devices/:brand', (req, res) => {
  const catalog = quoteService.getCatalog(req.params.brand);
  if (!catalog.length) {
    return res.status(404).json({ ok: false, error: 'Brand not found in catalog' });
  }
  ok(res, { catalog });
});

// ── GET /api/v1/quote ─────────────────────────────────────────────────────────

/**
 * Calculate Standard and Same-Day offers.
 *
 * Query params: brand, model, storage, carrier, condition
 * Also accepts condition questionnaire answers as JSON in ?answers=<json>
 * which will be used to derive the condition grade automatically.
 */
router.get('/quote', (req, res) => {
  const { brand, model, storage, carrier, condition, answers } = req.query;

  if (!brand || !model) {
    return res.status(400).json({
      ok: false,
      error: 'brand and model are required',
    });
  }

  // If condition questionnaire answers are provided, derive grade from them
  let resolvedCondition = condition || 'good';
  let gradeDetail = null;

  if (answers) {
    try {
      const parsed = typeof answers === 'string' ? JSON.parse(answers) : answers;
      gradeDetail = quoteService.gradeFromAnswers(parsed);
      resolvedCondition = gradeDetail.grade;
    } catch {
      return res.status(400).json({ ok: false, error: 'answers must be valid JSON' });
    }
  }

  const quote = quoteService.calculateQuote({
    brand,
    model,
    storage: storage || '128GB',
    carrier: carrier || 'Unlocked',
    condition: resolvedCondition,
  });

  ok(res, {
    quote,
    conditionDetail: gradeDetail,
    device: { brand, model, storage, carrier },
  });
});

// ── GET /api/v1/territory/:zip ────────────────────────────────────────────────

/**
 * Check ZIP code coverage and same-day availability.
 */
router.get('/territory/:zip', (req, res) => {
  const zip = String(req.params.zip || '').trim();
  if (!/^\d{5}$/.test(zip)) {
    return res.status(400).json({ ok: false, error: 'ZIP must be a 5-digit US code' });
  }

  const result = territoryService.sameDayAvailability(zip);
  ok(res, {
    zip,
    sameDayAvailable: result.available,
    coop:             result.coop,
    message: result.available
      ? `Same-day pickup available in ${result.coop.name}`
      : 'No coop covers this ZIP yet — standard mail-in available',
  });
});

// ── POST /api/v1/orders ───────────────────────────────────────────────────────

/**
 * Create a seller-initiated order from the public quote flow.
 *
 * The order is assigned to the first active partner for the resolved coop
 * (the "buying coop"). In production this would be the partner whose quote
 * the seller accepted; for the public flow it defaults to the tenant coop's
 * primary partner.
 *
 * Required body fields:
 *   sellerName, sellerPhone, pickupAddress, pickupCity, pickupZip,
 *   deviceBrand, deviceModel, deviceStorage, deviceCarrier, deviceCondition,
 *   selectedOffer ('standard'|'sameday'), quotedAmount
 *
 * Optional:
 *   sellerEmail, imei, deviceColor, notes
 */
router.post('/orders', (req, res) => {
  const b = req.body || {};

  const required = [
    'sellerName', 'sellerPhone',
    'pickupAddress', 'pickupCity', 'pickupZip',
    'deviceBrand', 'deviceModel', 'deviceCondition',
    'selectedOffer', 'quotedAmount',
  ];

  for (const field of required) {
    if (!b[field] && b[field] !== 0) {
      return res.status(400).json({ ok: false, error: `Missing required field: ${field}` });
    }
  }

  if (!['standard', 'sameday'].includes(b.selectedOffer)) {
    return res.status(400).json({ ok: false, error: 'selectedOffer must be "standard" or "sameday"' });
  }

  if (Number(b.quotedAmount) <= 0) {
    return res.status(400).json({ ok: false, error: 'quotedAmount must be positive' });
  }

  // Resolve territory coop from pickup ZIP
  const territory = territoryService.sameDayAvailability(b.pickupZip);

  if (b.selectedOffer === 'sameday' && !territory.available) {
    return res.status(400).json({
      ok: false,
      error: 'Same-day pickup is not available in this ZIP code',
      sameDayAvailable: false,
    });
  }

  // Resolve the buying partner — use the tenant coop's primary partner
  const db   = getDb();
  const data = db._data();

  // Find a partner whose coop_slug matches the pickup territory coop,
  // falling back to any active partner if no territory coop match.
  let partner = null;
  if (territory.available && territory.coop) {
    partner = data.partners.find(
      (p) => p.active !== 0 && (p.coop_slug === territory.coop.slug || p.slug === territory.coop.slug)
    );
  }
  if (!partner) {
    partner = data.partners.find((p) => p.active !== 0);
  }
  if (!partner) {
    return res.status(503).json({ ok: false, error: 'No active partner available for this territory' });
  }

  // Build canonical order fields (snake_case, matching existing orders schema)
  const orderId = uuid();
  const now     = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const orderData = {
    id:               orderId,
    partner_id:       partner.id,
    external_ref:     `PUB-${orderId.slice(-8).toUpperCase()}`,
    status:           'pending',
    seller_name:      b.sellerName,
    seller_phone:     b.sellerPhone,
    seller_email:     b.sellerEmail     || null,
    pickup_address:   b.pickupAddress,
    pickup_city:      b.pickupCity,
    pickup_zip:       b.pickupZip,
    pickup_lat:       null,
    pickup_lng:       null,
    device_brand:     b.deviceBrand,
    device_model:     b.deviceModel,
    device_storage:   b.deviceStorage   || null,
    device_color:     b.deviceColor     || null,
    device_condition: b.deviceCondition,
    imei:             b.imei            || null,
    serial_number:    null,
    quoted_amount:    Number(b.quotedAmount),
    currency:         'USD',
    expected_specs:   JSON.stringify({
      brand:     b.deviceBrand,
      model:     b.deviceModel,
      storage:   b.deviceStorage  || null,
      color:     b.deviceColor    || null,
      condition: b.deviceCondition,
      carrier:   b.deviceCarrier  || 'Unlocked',
    }),
    // Dual offer
    seller_offer_standard: Number(b.standardOffer  || b.quotedAmount),
    seller_offer_sameday:  Number(b.samedayOffer   || 0),
    seller_chose_sameday:  b.selectedOffer === 'sameday' ? 1 : 0,
    payment_method_seller: b.selectedOffer === 'sameday' ? 'ach_same_day' : 'standard',
    // Cross-coop
    buying_coop_id:        partner.id,
    pickup_coop_slug:      territory.available ? territory.coop.slug : null,
    pickup_coop_id:        null,
    // Misc
    window_start:          b.windowStart || null,
    window_end:            b.windowEnd   || null,
    tracking_number:       null,
    tracking_carrier:      null,
    tracking_url:          null,
    door_checklist:        null,
    checklist_template_id: null,
    packed:                0,
    packed_at:             null,
    paid:                  0,
    paid_at:               null,
    payment_method:        null,
    payment_ref:           null,
    cancel_reason:         null,
    driver_id:             null,
    fulfilling_coop_slug:  null,
    cross_coop:            territory.available ? 1 : 0,
    dispatch_provider:     null,
    dispatch_external_id:  null,
    dispatch_status:       null,
    verification_match:    null,
    verification_notes:    null,
    verified_specs:        null,
    driver_signature:      null,
    imei_attempts:         0,
    imei_locked:           0,
    payment_deadline_at:   null,
    inspection_passed_at:  null,
    status_notes:          b.notes || null,
    shipping_label_url:    null,
    tracking_number_outbound: null,
    shipping_carrier_preference: null,
    coop_slug:             territory.available ? territory.coop.slug : null,
    created_at:            now,
    updated_at:            now,
  };

  // Push to DB
  data.orders.push(orderData);

  // Log creation event
  if (!data.order_events) data.order_events = [];
  data.order_events.push({
    id:         uuid(),
    order_id:   orderId,
    actor_type: 'seller',
    actor_id:   null,
    event:      'created',
    detail:     JSON.stringify({
      source:          'public_quote_flow',
      selected_offer:  b.selectedOffer,
      quoted_amount:   Number(b.quotedAmount),
      sameday_available: territory.available,
      pickup_coop:     territory.available ? territory.coop.slug : null,
    }),
    created_at: now,
  });

  db._replace(data);

  ok(res, {
    orderId,
    order: {
      id:             orderId,
      status:         'pending',
      externalRef:    orderData.external_ref,
      sellerName:     b.sellerName,
      device:         `${b.deviceBrand} ${b.deviceModel}`,
      quotedAmount:   Number(b.quotedAmount),
      selectedOffer:  b.selectedOffer,
      pickupCity:     b.pickupCity,
      coopName:       territory.available ? territory.coop.name : null,
      sameDayAvailable: territory.available,
    },
    message: b.selectedOffer === 'sameday'
      ? `Same-day pickup order created. A driver will contact you within 2 hours.`
      : `Standard order created. We'll ship a prepaid label within 1 business day.`,
  }, 201);
});

module.exports = router;
