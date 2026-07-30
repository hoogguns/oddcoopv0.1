const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'oddcoop.json');

// ── Schema defaults ──────────────────────────────────────────────────────────

const ORDER_DEFAULTS = () => ({
  // ── existing fields ──
  id: null,
  partner_id: null,
  driver_id: null,
  external_ref: null,
  status: 'pending',
  seller_name: null,
  seller_phone: null,
  seller_email: null,
  pickup_address: null,
  pickup_city: null,
  pickup_zip: null,
  pickup_lat: null,
  pickup_lng: null,
  device_brand: null,
  device_model: null,
  device_storage: null,
  device_color: null,
  device_condition: null,
  imei: null,
  serial_number: null,
  quoted_amount: 0,
  currency: 'USD',
  expected_specs: null,
  verified_specs: null,
  verification_notes: null,
  verification_match: null,
  window_start: null,
  window_end: null,
  tracking_number: null,
  tracking_carrier: null,
  tracking_url: null,
  door_checklist: null,
  checklist_template_id: null,
  packed: 0,
  packed_at: null,
  paid: 0,
  paid_at: null,
  payment_method: null,
  payment_ref: null,
  cancel_reason: null,
  status_notes: null,
  dispatch_provider: null,
  dispatch_external_id: null,
  dispatch_status: null,
  created_at: null,
  updated_at: null,
  // ── NEW: cross-coop transaction fields ──
  // Coop A = buying_coop_id (alias of partner_id, explicit for clarity)
  // Coop R = pickup_coop_slug / pickup_coop_id (territory owner)
  buying_coop_id: null,           // partner_id of the purchasing coop (Coop A)
  pickup_coop_slug: null,         // slug of the territory coop (Coop R)
  pickup_coop_id: null,           // partner_id of Coop R (resolved from slug)
  coop_accept_required: 0,        // 1 when cross-coop txn requires Coop R acceptance
  pickup_coop_accepted_at: null,  // ISO timestamp when Coop R formally accepted
  // ── NEW: dual-offer pricing ──
  seller_offer_standard: null,    // full mail-in quote (e.g. $455)
  seller_offer_sameday: null,     // discounted sameday payout (e.g. $344)
  seller_chose_sameday: 0,        // 1 if seller opted for sameday
  payment_method_seller: null,    // 'venmo'|'zelle'|'cashapp'|'ach'|'check'
  // ── NEW: payment deadline & standing ──
  payment_deadline_at: null,      // 1hr after inspection_passed_at
  payment_late_strikes: 0,        // incremented if Coop A misses deadline
  // ── NEW: IMEI gate ──
  imei_attempts: 0,               // how many times driver has tried to enter IMEI
  imei_locked: 0,                 // 1 after 8 failed attempts → order auto-cancelled
  // ── NEW: driver inspection sign-off ──
  inspection_passed_at: null,     // when driver submits 'Device Match'
  driver_signature: null,         // JSON: { name, signed_at, checkboxes[] }
  // ── NEW: shipping label (Coop A uploads / on-demand from carrier API) ──
  shipping_label_url: null,       // pre-signed URL or base64 of label PDF
  shipping_carrier_preference: null, // 'usps'|'ups'|'fedex' (Coop A default)
  tracking_number_outbound: null, // outbound tracking (distinct from inbound)
});

const PARTNER_DEFAULTS = () => ({
  id: null,
  company_name: null,
  contact_name: null,
  email: null,
  password_hash: null,
  phone: null,
  website: null,
  api_key: null,
  plan: 'pilot',
  active: 1,
  created_at: null,
  // ── NEW: coop standing & enforcement ──
  coop_standing: 'good',          // 'good'|'probation'|'suspended'
  late_payment_strikes: 0,        // incremented per missed 1hr payment window
  probation_at: null,             // ISO timestamp when placed on probation
  suspended_at: null,             // ISO timestamp when suspended
  // ── NEW: notification & territory ──
  notify_url: null,               // webhook URL for cross-coop order pings
  territory_zip_codes: '[]',      // JSON array of ZIP codes this coop services
});

const EMPTY = () => ({
  tenants: [],
  coops: [],                      // registered OddCoop members (dynamic, from /api/coop/register)
  partners: [],
  drivers: [],
  orders: [],
  order_events: [],
  leads: [],
  checklist_templates: [],
  partner_integrations: [],
  dispatch_jobs: [],
});

// ── File helpers ─────────────────────────────────────────────────────────────

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function load() {
  ensureDir(DB_PATH);
  if (!fs.existsSync(DB_PATH)) {
    const data = EMPTY();
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return data;
  }
  const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  // Back-fill top-level collections added in later migrations
  if (!raw.tenants) raw.tenants = [];
  if (!raw.coops) raw.coops = [];
  return raw;
}

/**
 * Atomically persist data to disk.
 *
 * Writes to a sibling `.tmp` file first, then renames it over the target.
 * This ensures the on-disk file is never left in a half-written state if the
 * process is killed mid-write (e.g., during a Render redeploy).
 *
 * @param {object} data - Full DB state to persist
 */
function save(data) {
  ensureDir(DB_PATH);
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, DB_PATH);
}

function nowIso() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function matchLike(value, pattern) {
  const raw = String(pattern).replace(/^%/, '').replace(/%$/, '');
  return String(value ?? '').toLowerCase().includes(raw.toLowerCase());
}

// ── Migration: back-fill new fields on existing rows ─────────────────────────
// Called once at startup. Safe to run repeatedly — only fills missing keys.

function migrate(data) {
  let dirty = false;

  const orderDefs = ORDER_DEFAULTS();
  for (const o of data.orders) {
    for (const [k, v] of Object.entries(orderDefs)) {
      if (!(k in o)) { o[k] = v; dirty = true; }
    }
  }

  const partnerDefs = PARTNER_DEFAULTS();
  for (const p of data.partners) {
    for (const [k, v] of Object.entries(partnerDefs)) {
      if (!(k in p)) { p[k] = v; dirty = true; }
    }
  }

  if (dirty) save(data);
  return data;
}

// ── DB factory ───────────────────────────────────────────────────────────────

function createDb() {
  let data = migrate(load());

  function persist() { save(data); }

  const api = {
    prepare(sql) {
      const s = sql.replace(/\s+/g, ' ').trim();
      return {
        run(...params) { return execRun(s, params); },
        get(...params) { return execGet(s, params); },
        all(...params) { return execAll(s, params); },
      };
    },
    transaction(fn) {
      return (...args) => {
        const result = fn(...args);
        persist();
        return result;
      };
    },
    exec() {},
    pragma() {},
  };

  // ── execRun ──────────────────────────────────────────────────────────────

  function execRun(sql, params) {
    // Named-param object (single object arg)
    if (params.length === 1 && params[0] && typeof params[0] === 'object' && !Array.isArray(params[0])) {
      return execRunNamed(sql, params[0]);
    }

    // DELETE statements — used by seed --reset
    if (/^DELETE FROM (\w+)/i.test(sql)) {
      const table = sql.match(/^DELETE FROM (\w+)/i)[1].toLowerCase();
      if (data[table]) { data[table] = []; persist(); }
      return { changes: 0 };
    }

    if (/^INSERT (OR IGNORE )?INTO partners/i.test(sql)) {
      const [id, company_name, contact_name, email, password_hash, phone, website, api_key, plan] = params;
      if (data.partners.find((p) => p.id === id)) return { changes: 0 };
      data.partners.push({
        ...PARTNER_DEFAULTS(),
        id, company_name, contact_name, email, password_hash, phone, website, api_key,
        plan: plan || 'pilot',
        active: 1,
        created_at: nowIso(),
      });
      persist();
      return { changes: 1 };
    }
    if (/^INSERT (OR IGNORE )?INTO drivers/i.test(sql)) {
      persist();
      return { changes: 1 };
    }
    if (/^INSERT (OR IGNORE )?INTO orders \(/i.test(sql)) {
      const [
        id, partner_id, external_ref, seller_name, seller_phone, seller_email,
        pickup_address, pickup_city, pickup_zip, pickup_lat, pickup_lng,
        device_brand, device_model, device_storage, device_color, device_condition,
        imei, serial_number, quoted_amount, currency, expected_specs,
        window_start, window_end,
      ] = params;
      if (data.orders.find((o) => o.id === id)) return { changes: 0 };
      data.orders.push({
        ...ORDER_DEFAULTS(),
        id, partner_id, external_ref, seller_name, seller_phone, seller_email,
        pickup_address, pickup_city, pickup_zip, pickup_lat, pickup_lng,
        device_brand, device_model, device_storage, device_color, device_condition,
        imei, serial_number,
        quoted_amount: Number(quoted_amount || 0),
        currency: currency || 'USD',
        expected_specs,
        window_start, window_end,
        created_at: nowIso(),
        updated_at: nowIso(),
      });
      persist();
      return { changes: 1 };
    }
    if (/^INSERT (OR IGNORE )?INTO order_events/i.test(sql)) {
      const [id, order_id, actor_type, actor_id, event, detail] = params;
      if (data.order_events.find((e) => e.id === id)) return { changes: 0 };
      data.order_events.push({ id, order_id, actor_type, actor_id, event, detail, created_at: nowIso() });
      persist();
      return { changes: 1 };
    }
    if (/^INSERT (OR IGNORE )?INTO leads/i.test(sql)) {
      const [id, type, name, email, company, phone, message] = params;
      data.leads.push({ id, type, name, email, company, phone, message, created_at: nowIso() });
      persist();
      return { changes: 1 };
    }
    if (/^UPDATE orders SET driver_id = \?, status = 'assigned'/i.test(sql)) {
      const [driver_id, id] = params;
      const o = data.orders.find((x) => x.id === id);
      if (o) { o.driver_id = driver_id; o.status = 'assigned'; o.updated_at = nowIso(); persist(); }
      return { changes: o ? 1 : 0 };
    }
    if (/^UPDATE orders SET updated_at/i.test(sql)) {
      const [id] = params;
      const o = data.orders.find((x) => x.id === id);
      if (o) { o.updated_at = nowIso(); persist(); }
      return { changes: o ? 1 : 0 };
    }
    if (/^UPDATE orders SET status = \?, verified_specs/i.test(sql)) {
      const [status, verified_specs, verification_notes, verification_match, packed, packedFlag, id] = params;
      const o = data.orders.find((x) => x.id === id);
      if (o) {
        o.status = status;
        o.verified_specs = verified_specs;
        o.verification_notes = verification_notes;
        o.verification_match = verification_match;
        o.packed = packed;
        if (packedFlag === 1) o.packed_at = nowIso();
        o.updated_at = nowIso();
        persist();
      }
      return { changes: o ? 1 : 0 };
    }
    if (/^UPDATE orders SET\s+status = 'paid'/i.test(sql) || /status = 'paid', paid = 1/i.test(sql)) {
      const [method, ref, id] = params;
      const o = data.orders.find((x) => x.id === id);
      if (o) { o.status = 'paid'; o.paid = 1; o.paid_at = nowIso(); o.payment_method = method; o.payment_ref = ref; o.updated_at = nowIso(); persist(); }
      return { changes: o ? 1 : 0 };
    }
    if (/^UPDATE orders SET status = \?/i.test(sql)) {
      const status = params[0];
      let idx = 1;
      const oId = params[params.length - 1];
      const o = data.orders.find((x) => x.id === oId);
      if (!o) return { changes: 0 };
      o.status = status;
      if (/packed = \?/.test(sql)) { o.packed = params[idx] ? 1 : 0; o.packed_at = nowIso(); idx++; }
      if (/cancel_reason = \?/.test(sql)) { o.cancel_reason = params[idx]; }
      o.updated_at = nowIso();
      persist();
      return { changes: 1 };
    }
    // ── Partner standing update ──
    if (/^UPDATE partners SET.*coop_standing/i.test(sql)) {
      const oId = params[params.length - 1];
      const p = data.partners.find((x) => x.id === oId);
      if (!p) return { changes: 0 };
      if (/late_payment_strikes/.test(sql)) p.late_payment_strikes = (p.late_payment_strikes || 0) + 1;
      if (/probation_at/.test(sql)) { p.coop_standing = 'probation'; p.probation_at = nowIso(); }
      if (/suspended_at/.test(sql)) { p.coop_standing = 'suspended'; p.suspended_at = nowIso(); }
      p.updated_at = nowIso();
      persist();
      return { changes: 1 };
    }
    throw new Error('Unsupported SQL run: ' + sql.slice(0, 120));
  }

  // ── execRunNamed ─────────────────────────────────────────────────────────

  function execRunNamed(sql, obj) {
    if (/INSERT (OR IGNORE )?INTO partners/i.test(sql)) {
      if (data.partners.find((p) => p.id === obj.id)) return { changes: 0 };
      data.partners.push({ ...PARTNER_DEFAULTS(), active: 1, created_at: nowIso(), ...obj });
      persist();
      return { changes: 1 };
    }
    if (/INSERT (OR IGNORE )?INTO drivers/i.test(sql)) {
      if (data.drivers.find((d) => d.id === obj.id)) return { changes: 0 };
      data.drivers.push({ created_at: nowIso(), ...obj });
      persist();
      return { changes: 1 };
    }
    if (/INSERT (OR IGNORE )?INTO orders/i.test(sql)) {
      if (data.orders.find((o) => o.id === obj.id)) return { changes: 0 };
      data.orders.push({
        ...ORDER_DEFAULTS(),
        created_at: nowIso(),
        updated_at: nowIso(),
        ...obj,
        // Ensure numeric types
        quoted_amount: Number(obj.quoted_amount || 0),
        seller_offer_standard: obj.seller_offer_standard != null ? Number(obj.seller_offer_standard) : null,
        seller_offer_sameday: obj.seller_offer_sameday != null ? Number(obj.seller_offer_sameday) : null,
        coop_accept_required: obj.coop_accept_required ? 1 : 0,
        seller_chose_sameday: obj.seller_chose_sameday ? 1 : 0,
        packed: 0,
        paid: 0,
        imei_attempts: 0,
        imei_locked: 0,
        payment_late_strikes: 0,
      });
      persist();
      return { changes: 1 };
    }
    if (/INSERT (OR IGNORE )?INTO order_events/i.test(sql)) {
      if (data.order_events.find((e) => e.id === obj.id)) return { changes: 0 };
      data.order_events.push({ created_at: nowIso(), ...obj });
      persist();
      return { changes: 1 };
    }
    throw new Error('Unsupported named SQL: ' + sql.slice(0, 80));
  }

  // ── joinOrder ────────────────────────────────────────────────────────────

  function joinOrder(o) {
    const p = data.partners.find((x) => x.id === o.partner_id);
    const d = o.driver_id ? data.drivers.find((x) => x.id === o.driver_id) : null;
    // Coop R enrichment
    const pickupCoop = o.pickup_coop_id
      ? data.partners.find((x) => x.id === o.pickup_coop_id)
      : null;
    const pickupCoopFromCoops = o.pickup_coop_slug
      ? (data.coops || []).find((c) => c.slug === o.pickup_coop_slug)
      : null;
    return {
      ...o,
      partner_name: p ? p.company_name : null,
      driver_name: d ? d.name : null,
      driver_phone: d ? d.phone : null,
      driver_code: d ? d.driver_code : null,
      pickup_coop_name: pickupCoop
        ? pickupCoop.company_name
        : pickupCoopFromCoops
        ? pickupCoopFromCoops.name
        : null,
      buying_coop_name: p ? p.company_name : null,
    };
  }

  // ── execGet ──────────────────────────────────────────────────────────────

  function execGet(sql, params) {
    // COUNT queries
    if (/SELECT COUNT\(\*\) AS c FROM partners/i.test(sql)) return { c: data.partners.length };
    if (/SELECT COUNT\(\*\) AS c FROM orders/i.test(sql))   return { c: data.orders.length };
    if (/SELECT COUNT\(\*\) AS c FROM drivers/i.test(sql))  return { c: data.drivers.length };

    // Partners
    if (/SELECT \* FROM partners WHERE email = \?/i.test(sql)) {
      const want = String(params[0] || '').toLowerCase();
      return data.partners.find((p) => String(p.email || '').toLowerCase() === want) || undefined;
    }
    if (/SELECT id FROM partners WHERE email = \?/i.test(sql)) {
      const p = data.partners.find((x) => String(x.email || '').toLowerCase() === String(params[0] || '').toLowerCase());
      return p ? { id: p.id } : undefined;
    }
    if (/SELECT id, company_name, contact_name, email, phone, website, plan, api_key, created_at\s+FROM partners WHERE id = \?/i.test(sql)) {
      const p = data.partners.find((x) => x.id === params[0]);
      if (!p) return undefined;
      const { id, company_name, contact_name, email, phone, website, plan, api_key, created_at } = p;
      return { id, company_name, contact_name, email, phone, website, plan, api_key, created_at };
    }
    if (/SELECT id, company_name, email, plan, api_key, created_at FROM partners WHERE id = \?/i.test(sql)) {
      const p = data.partners.find((x) => x.id === params[0]);
      if (!p) return undefined;
      return { id: p.id, company_name: p.company_name, email: p.email, plan: p.plan, api_key: p.api_key, created_at: p.created_at };
    }
    if (/SELECT id, company_name, email, plan, active FROM partners WHERE api_key = \?/i.test(sql)) {
      const p = data.partners.find((x) => x.api_key === params[0]);
      if (!p) return undefined;
      return { id: p.id, company_name: p.company_name, email: p.email, plan: p.plan, active: p.active };
    }
    // Standing lookup
    if (/SELECT.*coop_standing.*FROM partners WHERE id = \?/i.test(sql)) {
      const p = data.partners.find((x) => x.id === params[0]);
      if (!p) return undefined;
      return {
        id: p.id,
        company_name: p.company_name,
        coop_standing: p.coop_standing || 'good',
        late_payment_strikes: p.late_payment_strikes || 0,
        probation_at: p.probation_at || null,
        suspended_at: p.suspended_at || null,
      };
    }

    // Drivers
    if (/SELECT \* FROM drivers WHERE email = \?/i.test(sql)) {
      const want = String(params[0] || '').toLowerCase();
      return data.drivers.find((d) => String(d.email || '').toLowerCase() === want) || undefined;
    }
    if (/SELECT id FROM drivers WHERE email = \?/i.test(sql)) {
      const want = String(params[0] || '').toLowerCase();
      const d = data.drivers.find((x) => String(x.email || '').toLowerCase() === want);
      return d ? { id: d.id } : undefined;
    }
    if (/SELECT id, name, email, phone, vehicle, zones, rating, status, driver_code, trained, created_at\s+FROM drivers WHERE id = \?/i.test(sql)) {
      const d = data.drivers.find((x) => x.id === params[0]);
      if (!d) return undefined;
      const { id, name, email, phone, vehicle, zones, rating, status, driver_code, trained, created_at } = d;
      return { id, name, email, phone, vehicle, zones, rating, status, driver_code, trained, created_at };
    }

    // Orders
    if (/FROM orders o[\s\S]*WHERE o\.id = \?/i.test(sql) || /WHERE o\.id = \?/i.test(sql)) {
      const o = data.orders.find((x) => x.id === params[0]);
      return o ? joinOrder(o) : undefined;
    }
    if (/SELECT COUNT\(\*\) AS c FROM orders o/i.test(sql)) return { c: filterOrdersCount(sql, params) };
    if (/SELECT COUNT\(\*\) AS count FROM orders\s+WHERE partner_id = \? AND status NOT IN/i.test(sql)) {
      const partnerId = params[0];
      return { count: data.orders.filter((o) => o.partner_id === partnerId && !['paid','cancelled','mismatch'].includes(o.status)).length };
    }
    if (/SELECT COUNT\(\*\) AS count, COALESCE\(SUM\(quoted_amount\),0\) AS volume\s+FROM orders\s+WHERE partner_id = \? AND paid = 1/i.test(sql)) {
      const partnerId = params[0];
      const today = nowIso().slice(0, 10);
      const rows = data.orders.filter((o) => o.partner_id === partnerId && o.paid === 1 && String(o.paid_at || '').startsWith(today));
      return { count: rows.length, volume: rows.reduce((s, o) => s + Number(o.quoted_amount || 0), 0) };
    }
    if (/SELECT AVG\(/i.test(sql)) {
      const partnerId = params[0];
      const rows = data.orders.filter((o) => o.partner_id === partnerId && ['verified','paid'].includes(o.status));
      if (!rows.length) return { hours: null };
      const hours = rows.reduce((s, o) => s + (new Date(o.paid_at || o.updated_at) - new Date(o.created_at)) / 3600000, 0) / rows.length;
      return { hours };
    }
    if (/SELECT\s+\(SELECT COUNT\(\*\) FROM orders\) AS orders/i.test(sql)) {
      const today = nowIso().slice(0, 10);
      return {
        orders: data.orders.length,
        partners: data.partners.filter((p) => p.active !== 0).length,
        drivers: data.drivers.filter((d) => d.trained).length,
        paid_volume: data.orders.filter((o) => o.paid).reduce((s, o) => s + Number(o.quoted_amount || 0), 0),
        paid_today_count: data.orders.filter((o) => o.paid && String(o.paid_at || '').startsWith(today)).length,
      };
    }
    return undefined;
  }

  // ── filterOrdersCount ────────────────────────────────────────────────────

  function filterOrdersCount(sql, params) {
    let rows = data.orders.slice();
    const hasPartner = /o\.partner_id = \?/.test(sql);
    const hasDriver  = /o\.driver_id = \?/.test(sql);
    const hasStatus  = /o\.status = \?/.test(sql);
    const hasQ       = /o\.seller_name LIKE \?/.test(sql);
    let i = 0;
    if (hasPartner) rows = rows.filter((o) => o.partner_id === params[i++]);
    if (hasDriver)  rows = rows.filter((o) => o.driver_id  === params[i++]);
    if (hasStatus)  rows = rows.filter((o) => o.status     === params[i++]);
    if (hasQ) {
      const like = params[i];
      rows = rows.filter((o) => matchLike(o.seller_name, like) || matchLike(o.device_model, like) || matchLike(o.external_ref, like) || matchLike(o.pickup_city, like) || matchLike(o.imei, like));
    }
    return rows.length;
  }

  // ── execAll ──────────────────────────────────────────────────────────────

  function execAll(sql, params) {
    if (/SELECT status, COUNT\(\*\) AS count, COALESCE\(SUM\(quoted_amount\),0\) AS volume\s+FROM orders WHERE partner_id = \? GROUP BY status/i.test(sql)) {
      const partnerId = params[0];
      const map = {};
      for (const o of data.orders.filter((x) => x.partner_id === partnerId)) {
        if (!map[o.status]) map[o.status] = { status: o.status, count: 0, volume: 0 };
        map[o.status].count += 1;
        map[o.status].volume += Number(o.quoted_amount || 0);
      }
      return Object.values(map);
    }
    if (/FROM drivers WHERE trained = 1/i.test(sql)) {
      return data.drivers
        .filter((d) => d.trained)
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .map((d) => ({ id: d.id, name: d.name, phone: d.phone, vehicle: d.vehicle, zones: d.zones, rating: d.rating, status: d.status, driver_code: d.driver_code, trained: d.trained }));
    }
    if (/FROM order_events WHERE order_id = \?/i.test(sql)) {
      return data.order_events
        .filter((e) => e.order_id === params[0])
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    }
    if (/FROM orders o/i.test(sql) && /ORDER BY o\.created_at DESC/i.test(sql)) {
      let rows = data.orders.map(joinOrder);
      const hasPartner = /o\.partner_id = \?/.test(sql);
      const hasDriver  = /o\.driver_id = \?/.test(sql);
      const hasStatus  = /o\.status = \?/.test(sql);
      const hasQ       = /o\.seller_name LIKE \?/.test(sql);
      let i = 0;
      if (hasPartner) rows = rows.filter((o) => o.partner_id === params[i++]);
      if (hasDriver)  rows = rows.filter((o) => o.driver_id  === params[i++]);
      if (hasStatus)  rows = rows.filter((o) => o.status     === params[i++]);
      if (hasQ) { const like = params[i]; i += 5; rows = rows.filter((o) => matchLike(o.seller_name, like) || matchLike(o.device_model, like) || matchLike(o.external_ref, like) || matchLike(o.pickup_city, like) || matchLike(o.imei, like)); }
      const limit  = params[params.length - 2];
      const offset = params[params.length - 1];
      rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return rows.slice(offset, offset + limit);
    }
    return [];
  }

  api._reload   = () => { data = migrate(load()); };
  api._data     = () => data;
  api._replace  = (next) => { data = next; persist(); };

  return api;
}

let _db;
function getDb()  { if (!_db) _db = createDb(); return _db; }
function openDb() { _db = createDb(); return _db; }

module.exports = { getDb, openDb, DB_PATH, EMPTY, ORDER_DEFAULTS, PARTNER_DEFAULTS, save, load, ensureDir };
