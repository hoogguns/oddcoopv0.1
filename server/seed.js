/**
 * seed.js — populate oddcoop.json with demo data.
 * Usage:
 *   node server/seed.js           — seeds if DB is empty
 *   node server/seed.js --reset   — wipes and reseeds
 * Also exported as runSeed(db, data, { reset }) for use by index.js auto-seed.
 */
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const { getDb, DB_PATH, EMPTY, save } = require('./db');

function runSeed({ reset = false } = {}) {
  if (reset) {
    console.log('🗑  Resetting database...');
    save(EMPTY());
    console.log('✓  oddcoop.json wiped');
  }

  const db   = getDb();
  const data = db._data();

  // Reload after reset so we work with the wiped copy
  if (reset) db._reload && db._reload();
  const d = db._data();

  // Ensure all collections exist
  if (!d.coops)                d.coops = [];
  if (!d.partners)             d.partners = [];
  if (!d.drivers)              d.drivers = [];
  if (!d.orders)               d.orders = [];
  if (!d.order_events)         d.order_events = [];
  if (!d.partner_integrations) d.partner_integrations = [];
  if (!d.dispatch_jobs)        d.dispatch_jobs = [];

  // ── 1. Seed Wasatch Buybacks coop ────────────────────────────────────────────
  const COOP_SLUG = 'wasatchbuybacks';
  if (!d.coops.find((c) => c.slug === COOP_SLUG)) {
    d.coops.push({
      id:            uuid(),
      slug:          COOP_SLUG,
      name:          'Wasatch Buybacks',
      contact_name:  'Demo Admin',
      contact_email: 'admin@wasatchbuybacks.demo',
      contact_phone: '801-555-0100',
      market:        'Wasatch Front, Utah',
      corridor:      'Ogden → Salt Lake City → Provo',
      cities:        ['Ogden','Layton','Bountiful','Salt Lake City','Murray','Sandy','Draper','Lehi','Orem','Provo'],
      zip_codes:     ['84401','84403','84404','84405','84414','84015','84010','84070','84094','84020','84043','84057','84058','84601','84604','84606','84101','84102','84103','84104','84105','84106','84107','84108','84111','84115','84116','84117','84119','84120','84121','84123','84124'],
      color:         '#2d8b8b',
      logo_letter:   'W',
      active:        true,
      created_at:    new Date().toISOString(),
    });
    console.log('✓  Coop: Wasatch Buybacks');
  }

  // ── 1b. Seed Mile High Devices coop (Denver — cross-coop demo partner) ────────
  const COOP2_SLUG = 'milehighdevices';
  if (!d.coops.find((c) => c.slug === COOP2_SLUG)) {
    d.coops.push({
      id:            uuid(),
      slug:          COOP2_SLUG,
      name:          'Mile High Devices',
      contact_name:  'Denver Demo',
      contact_email: 'admin@milehighdevices.demo',
      contact_phone: '720-555-0200',
      market:        'Denver Metro, Colorado',
      corridor:      'Boulder → Denver → Aurora',
      cities:        ['Boulder','Denver','Aurora','Lakewood','Arvada','Thornton'],
      zip_codes:     ['80201','80202','80203','80204','80205','80206','80207','80210','80211','80212','80218','80219','80220','80221','80222','80223','80224','80226','80227','80228','80229','80233','80234','80239','80302','80303','80304'],
      color:         '#5B4FBE',
      logo_letter:   'M',
      active:        true,
      created_at:    new Date().toISOString(),
    });
    console.log('✓  Coop: Mile High Devices');
  }

  // ── 2. Seed partners ──────────────────────────────────────────────────────────
  const PARTNER_EMAIL = 'partner@wasatchbuybacks.demo';
  let partner = d.partners.find((p) => p.email === PARTNER_EMAIL);
  if (!partner) {
    partner = {
      id:            uuid(),
      company_name:  'Wasatch Buybacks',
      contact_name:  'Demo Partner',
      email:         PARTNER_EMAIL,
      password_hash: bcrypt.hashSync('demo1234', 10),
      phone:         '801-555-0101',
      website:       'https://wasatchbuybacks.demo',
      api_key:       'dl_live_wasatch000000000000000001',
      plan:          'pilot',
      active:        1,
      coop_slug:     COOP_SLUG,
      coop_standing: 'good',
      late_payment_strikes: [],
      created_at:    new Date().toISOString(),
    };
    d.partners.push(partner);
    console.log('✓  Partner:', PARTNER_EMAIL, '/ demo1234');
  }

  // Mile High Devices partner account (Coop R in cross-coop demos)
  const PARTNER2_EMAIL = 'partner@milehighdevices.demo';
  let partner2 = d.partners.find((p) => p.email === PARTNER2_EMAIL);
  if (!partner2) {
    partner2 = {
      id:            uuid(),
      company_name:  'Mile High Devices',
      contact_name:  'Denver Ops',
      email:         PARTNER2_EMAIL,
      password_hash: bcrypt.hashSync('demo1234', 10),
      phone:         '720-555-0201',
      website:       'https://milehighdevices.demo',
      api_key:       'dl_live_milehigh000000000000000001',
      plan:          'pilot',
      active:        1,
      slug:          COOP2_SLUG,
      coop_slug:     COOP2_SLUG,
      coop_standing: 'good',
      late_payment_strikes: [],
      created_at:    new Date().toISOString(),
    };
    d.partners.push(partner2);
    console.log('✓  Partner:', PARTNER2_EMAIL, '/ demo1234');
  }

  const PARTNER3_EMAIL = 'ops@phonecash.demo';
  if (!d.partners.find((p) => p.email === PARTNER3_EMAIL)) {
    d.partners.push({
      id:            uuid(),
      company_name:  'PhoneCash',
      contact_name:  'Demo Ops',
      email:         PARTNER3_EMAIL,
      password_hash: bcrypt.hashSync('demo1234', 10),
      phone:         '801-555-0102',
      api_key:       'dl_live_phonecash0000000000000001',
      plan:          'pilot',
      active:        1,
      coop_slug:     COOP_SLUG,
      coop_standing: 'warning',
      late_payment_strikes: [
        { id: uuid(), reason: 'Late payment — 3 days overdue', order_id: null, issued_at: new Date(Date.now() - 7*24*3600*1000).toISOString(), issued_by: 'system' },
      ],
      created_at:    new Date().toISOString(),
    });
    console.log('✓  Partner:', PARTNER3_EMAIL, '/ demo1234 (1 strike — warning standing)');
  }

  // ── 3. Seed drivers ───────────────────────────────────────────────────────────
  const DRIVERS = [
    { name: 'Sam Rivera',  email: 'sam.driver@oddcoop.demo',   phone: '801-555-1001', vehicle: 'Toyota Camry 2022',    zones: ['Salt Lake City','Sandy','Murray'],              rating: 4.9, driver_code: 'DRV-SAM-001',  status: 'available', trained: true },
    { name: 'Mia Torres',  email: 'mia.driver@oddcoop.demo',   phone: '801-555-1002', vehicle: 'Honda Civic 2021',     zones: ['Provo','Orem','Lehi','Draper'],                 rating: 4.8, driver_code: 'DRV-MIA-002',  status: 'available', trained: true },
    { name: 'Chris Hall',  email: 'chris.driver@oddcoop.demo', phone: '801-555-1003', vehicle: 'Ford Focus 2020',      zones: ['Ogden','Layton','Bountiful'],                   rating: 4.7, driver_code: 'DRV-CHRIS-003', status: 'available', trained: true },
    { name: 'Dana Kim',    email: 'dana.driver@oddcoop.demo',  phone: '801-555-1004', vehicle: 'Chevy Malibu 2023',    zones: ['Salt Lake City','West Valley','Taylorsville'], rating: 4.6, driver_code: 'DRV-DANA-004', status: 'offline',   trained: true },
    { name: 'Alex Nguyen', email: 'alex.driver@oddcoop.demo',  phone: '801-555-1005', vehicle: 'Hyundai Elantra 2022', zones: ['Sandy','Draper','South Jordan'],                rating: 4.5, driver_code: 'DRV-ALEX-005', status: 'available', trained: false },
  ];
  for (const drv of DRIVERS) {
    if (d.drivers.find((x) => x.email === drv.email)) continue;
    d.drivers.push({
      id:            uuid(),
      coop_slug:     COOP_SLUG,
      name:          drv.name,
      email:         drv.email,
      password_hash: bcrypt.hashSync('driver1234', 10),
      phone:         drv.phone,
      vehicle:       drv.vehicle,
      zones:         JSON.stringify(drv.zones),
      rating:        drv.rating,
      status:        drv.status,
      driver_code:   drv.driver_code,
      trained:       drv.trained ? 1 : 0,
      created_at:    new Date().toISOString(),
    });
    console.log('✓  Driver:', drv.email, '/ driver1234');
  }

  // ── 4. Seed sample orders ─────────────────────────────────────────────────────
  const assignedDriver = d.drivers.find((drv) => drv.email === 'sam.driver@oddcoop.demo');
  // Resolve partner2 id for cross-coop orders (may have been freshly created above)
  const p2 = d.partners.find((p) => p.email === PARTNER2_EMAIL);

  const ORDERS = [
    { external_ref: 'WB-10001', seller_name: 'Jordan Lee',   seller_phone: '801-555-2001', seller_email: 'jordan@example.com',  pickup_address: '123 Main St',     pickup_city: 'Salt Lake City', pickup_zip: '84101', device_brand: 'Apple',   device_model: 'iPhone 14',        device_storage: '128GB', device_color: 'Midnight',         device_condition: 'good',      quoted_amount: 320, status: 'pending' },
    { external_ref: 'WB-10002', seller_name: 'Taylor Smith', seller_phone: '801-555-2002', seller_email: 'taylor@example.com', pickup_address: '456 Oak Ave',     pickup_city: 'Provo',          pickup_zip: '84601', device_brand: 'Samsung', device_model: 'Galaxy S23',       device_storage: '256GB', device_color: 'Phantom Black',     device_condition: 'fair',      quoted_amount: 210, status: 'pending' },
    { external_ref: 'WB-10003', seller_name: 'Riley Davis',  seller_phone: '801-555-2003', seller_email: 'riley@example.com',  pickup_address: '789 Elm Blvd',    pickup_city: 'Sandy',          pickup_zip: '84070', device_brand: 'Apple',   device_model: 'iPhone 13 Pro',    device_storage: '256GB', device_color: 'Sierra Blue',       device_condition: 'excellent', quoted_amount: 410, status: 'assigned', driver_id: assignedDriver ? assignedDriver.id : null },
    { external_ref: 'WB-10004', seller_name: 'Morgan White', seller_phone: '801-555-2004', seller_email: 'morgan@example.com', pickup_address: '321 Pine Rd',     pickup_city: 'Ogden',          pickup_zip: '84401', device_brand: 'Google',  device_model: 'Pixel 7',          device_storage: '128GB', device_color: 'Snow',              device_condition: 'good',      quoted_amount: 180, status: 'verified' },
    { external_ref: 'WB-10005', seller_name: 'Casey Brown',  seller_phone: '801-555-2005', seller_email: 'casey@example.com',  pickup_address: '654 Cedar Lane',  pickup_city: 'Orem',           pickup_zip: '84058', device_brand: 'Apple',   device_model: 'iPhone 12',        device_storage: '64GB',  device_color: 'White',             device_condition: 'fair',      quoted_amount: 155, status: 'paid', paid: 1 },
    { external_ref: 'WB-10006', seller_name: 'Sam Johnson',  seller_phone: '801-555-2006', seller_email: 'samj@example.com',   pickup_address: '987 Maple Court', pickup_city: 'Layton',         pickup_zip: '84041', device_brand: 'Samsung', device_model: 'Galaxy S22 Ultra', device_storage: '512GB', device_color: 'Burgundy',          device_condition: 'good',      quoted_amount: 290, status: 'pending' },
    { external_ref: 'WB-10007', seller_name: 'Pat Garcia',   seller_phone: '801-555-2007', seller_email: 'patg@example.com',   pickup_address: '111 Willow Way',  pickup_city: 'Murray',         pickup_zip: '84107', device_brand: 'Apple',   device_model: 'iPhone 15 Pro',    device_storage: '256GB', device_color: 'Natural Titanium',  device_condition: 'excellent', quoted_amount: 620, status: 'pending' },
  ];
  for (const o of ORDERS) {
    if (d.orders.find((x) => x.external_ref === o.external_ref)) continue;
    d.orders.push({
      id:             uuid(),
      partner_id:     partner.id,
      coop_slug:      COOP_SLUG,
      driver_id:      o.driver_id || null,
      external_ref:   o.external_ref,
      status:         o.status,
      seller_name:    o.seller_name,
      seller_phone:   o.seller_phone,
      seller_email:   o.seller_email,
      pickup_address: o.pickup_address,
      pickup_city:    o.pickup_city,
      pickup_zip:     o.pickup_zip,
      pickup_lat:     null, pickup_lng: null,
      device_brand:   o.device_brand, device_model: o.device_model,
      device_storage: o.device_storage, device_color: o.device_color,
      device_condition: o.device_condition,
      imei: null, serial_number: null,
      quoted_amount:  o.quoted_amount, currency: 'USD',
      expected_specs: null, verified_specs: null,
      verification_notes: null, verification_match: null,
      window_start: null, window_end: null,
      packed: 0, packed_at: null,
      paid: o.paid || 0, paid_at: o.paid ? new Date().toISOString() : null,
      payment_method: o.paid ? 'same_day' : null, payment_ref: null,
      cancel_reason: null,
      fulfilling_coop_slug: COOP_SLUG, cross_coop: false,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    });
  }

  // ── 5. Cross-coop sample orders (Wasatch Buybacks buys in Denver territory) ───
  // Wasatch is Coop A (buying_coop); Mile High Devices is Coop R (pickup_coop)
  const CROSS_COOP_ORDERS = [
    {
      external_ref: 'XC-20001',
      seller_name: 'Alex Denver',  seller_phone: '720-555-3001', seller_email: 'alexd@example.com',
      pickup_address: '1450 16th St', pickup_city: 'Denver', pickup_zip: '80202',
      device_brand: 'Apple', device_model: 'iPhone 15', device_storage: '256GB', device_color: 'Blue', device_condition: 'excellent',
      quoted_amount: 540,
      status: 'pending',
      cross_coop: true,
      buying_coop_id: null,    // filled below
      pickup_coop_slug: COOP2_SLUG,
      pickup_coop_id:   null,  // filled below
      coop_accept_required: true,
    },
    {
      external_ref: 'XC-20002',
      seller_name: 'Brianna Adams', seller_phone: '720-555-3002', seller_email: 'briannaa@example.com',
      pickup_address: '2200 Larimer St', pickup_city: 'Denver', pickup_zip: '80205',
      device_brand: 'Samsung', device_model: 'Galaxy S24 Ultra', device_storage: '512GB', device_color: 'Titanium Gray', device_condition: 'good',
      quoted_amount: 720,
      status: 'assigned',
      cross_coop: true,
      buying_coop_id: null,
      pickup_coop_slug: COOP2_SLUG,
      pickup_coop_id:   null,
      pickup_coop_accepted_at: new Date(Date.now() - 2*3600*1000).toISOString().replace('T',' ').slice(0,19),
      coop_accept_required: true,
    },
    {
      external_ref: 'XC-20003',
      seller_name: 'Carlos Webb',   seller_phone: '720-555-3003', seller_email: 'carlosw@example.com',
      pickup_address: '3100 Pecos St', pickup_city: 'Denver', pickup_zip: '80211',
      device_brand: 'Google', device_model: 'Pixel 8 Pro', device_storage: '256GB', device_color: 'Bay', device_condition: 'excellent',
      quoted_amount: 460,
      status: 'verified',
      cross_coop: true,
      buying_coop_id: null,
      pickup_coop_slug: COOP2_SLUG,
      pickup_coop_id:   null,
      pickup_coop_accepted_at: new Date(Date.now() - 5*3600*1000).toISOString().replace('T',' ').slice(0,19),
      coop_accept_required: true,
    },
  ];
  for (const o of CROSS_COOP_ORDERS) {
    if (d.orders.find((x) => x.external_ref === o.external_ref)) continue;
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
    d.orders.push({
      id:             uuid(),
      partner_id:     partner.id,
      buying_coop_id: partner.id,
      coop_slug:      COOP_SLUG,
      pickup_coop_slug: o.pickup_coop_slug,
      pickup_coop_id:   p2 ? p2.id : null,
      pickup_coop_accepted_at: o.pickup_coop_accepted_at || null,
      cross_coop:     true,
      coop_accept_required: true,
      driver_id:      null,
      external_ref:   o.external_ref,
      status:         o.status,
      seller_name:    o.seller_name,
      seller_phone:   o.seller_phone,
      seller_email:   o.seller_email,
      pickup_address: o.pickup_address,
      pickup_city:    o.pickup_city,
      pickup_zip:     o.pickup_zip,
      pickup_lat:     null, pickup_lng: null,
      device_brand:   o.device_brand, device_model: o.device_model,
      device_storage: o.device_storage, device_color: o.device_color,
      device_condition: o.device_condition,
      imei: null, serial_number: null,
      quoted_amount:  o.quoted_amount, currency: 'USD',
      expected_specs: null, verified_specs: null,
      verification_notes: null, verification_match: o.status === 'verified' ? true : null,
      window_start: null, window_end: null,
      packed: o.status === 'verified' ? 1 : 0, packed_at: null,
      paid: 0, paid_at: null,
      payment_method: null, payment_ref: null,
      cancel_reason: null,
      created_at: ts, updated_at: ts,
    });
  }

  // persist everything directly (bypasses db.js SQL layer)
  save(d);
  // reload so the in-memory db picks up the seeded data
  db._reload && db._reload();

  console.log('✓  Orders:', d.orders.length, `(${CROSS_COOP_ORDERS.length} cross-coop)`);
  console.log('');
  console.log('OddCoop seed complete.');
  console.log('  Partner login (Coop A):  partner@wasatchbuybacks.demo / demo1234');
  console.log('  Partner login (Coop R):  partner@milehighdevices.demo / demo1234');
  console.log('  Partner login (warning): ops@phonecash.demo / demo1234');
  console.log('  Driver login:            sam.driver@oddcoop.demo / driver1234');
  console.log('  Driver login:            mia.driver@oddcoop.demo / driver1234');
  console.log('  Driver login:            chris.driver@oddcoop.demo / driver1234');
  console.log('');
}

// ── CLI entry point ───────────────────────────────────────────────────────────
if (require.main === module) {
  const reset = process.argv.includes('--reset');
  runSeed({ reset });
}

module.exports = { runSeed };
