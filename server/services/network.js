/**
 * OddCoop network service.
 * Handles cross-coop territory resolution and driver sharing.
 *
 * Core rule:
 *   1. Look up which coop(s) cover the pickup ZIP.
 *   2. Try to find an available driver in the PRIMARY coop first.
 *   3. If none, broadcast to NEIGHBORING coops whose territory overlaps.
 *   4. Log a cross_coop_dispatch event so both coops see the handoff.
 */
const { v4: uuid } = require('uuid');
const { getDb } = require('../db');
const { getTenants } = require('../config/tenants');

/**
 * Returns all active coops whose zip_codes array includes the given ZIP.
 * First result is considered the PRIMARY coop for that territory.
 */
function coopsForZip(zip) {
  if (!zip) return [];
  const tenants = getTenants();
  return Object.values(tenants).filter(
    (t) => t.slug !== 'default' && t.active !== false &&
           Array.isArray(t.zip_codes) && t.zip_codes.includes(String(zip).trim())
  );
}

/**
 * Find an available trained driver for a given coop slug.
 * Returns the driver record or null.
 */
function findAvailableDriver(coopSlug) {
  const db = getDb();
  const data = db._data();
  const drivers = (data.drivers || []).filter(
    (d) => d.coop_slug === coopSlug && d.trained && d.status === 'available'
  );
  if (!drivers.length) return null;
  // prefer highest rated
  drivers.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  return drivers[0];
}

/**
 * Core cross-coop dispatch resolver.
 * Given an order, find the best driver across the network.
 *
 * Returns:
 *   { driver, coop_slug, cross_coop: bool, fulfilling_coop_slug }
 * or null if no driver found anywhere in the network.
 */
function resolveNetworkDriver(order) {
  const zip = order.pickup_zip;
  const ownerSlug = order.coop_slug; // the coop who owns the order

  // 1. Find all coops covering this ZIP
  const covering = coopsForZip(zip);

  // 2. Try primary / owner coop first
  const primarySlugs = covering.map((c) => c.slug);
  if (ownerSlug && !primarySlugs.includes(ownerSlug)) primarySlugs.unshift(ownerSlug);

  for (const slug of primarySlugs) {
    const driver = findAvailableDriver(slug);
    if (driver) {
      return {
        driver,
        coop_slug: slug,
        cross_coop: slug !== ownerSlug,
        fulfilling_coop_slug: slug,
      };
    }
  }

  // 3. Broadcast to ALL active coops in the network (full fallback)
  const tenants = getTenants();
  const allSlugs = Object.keys(tenants).filter(
    (s) => s !== 'default' && !primarySlugs.includes(s)
  );
  for (const slug of allSlugs) {
    const driver = findAvailableDriver(slug);
    if (driver) {
      return {
        driver,
        coop_slug: slug,
        cross_coop: true,
        fulfilling_coop_slug: slug,
      };
    }
  }

  return null;
}

/**
 * Assign a network driver to an order.
 * Writes driver_id, status=assigned, and logs a cross_coop_dispatch event
 * if the fulfilling coop differs from the owning coop.
 */
function assignNetworkDriver(order) {
  const result = resolveNetworkDriver(order);
  if (!result) return { assigned: false, reason: 'No available drivers in network' };

  const { driver, cross_coop, fulfilling_coop_slug } = result;
  const db = getDb();
  const data = db._data();

  // Update order
  const o = data.orders.find((x) => x.id === order.id);
  if (o) {
    o.driver_id = driver.id;
    o.status = 'assigned';
    o.fulfilling_coop_slug = fulfilling_coop_slug;
    o.cross_coop = cross_coop;
    o.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
  }

  // Log event
  if (!data.order_events) data.order_events = [];
  data.order_events.push({
    id: uuid(),
    order_id: order.id,
    actor_type: cross_coop ? 'network' : 'coop',
    actor_id: fulfilling_coop_slug,
    event: cross_coop ? 'cross_coop_dispatch' : 'local_dispatch',
    detail: JSON.stringify({
      driver_id: driver.id,
      driver_name: driver.name,
      fulfilling_coop: fulfilling_coop_slug,
      owner_coop: order.coop_slug,
    }),
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
  });

  db._replace(data);

  return {
    assigned: true,
    driver,
    cross_coop,
    fulfilling_coop_slug,
    message: cross_coop
      ? `Cross-coop dispatch: driver from ${fulfilling_coop_slug} assigned`
      : `Local dispatch: driver from ${fulfilling_coop_slug} assigned`,
  };
}

/**
 * Return a summary of the full coop network — used by the /join page
 * and the partner dashboard to show network coverage.
 */
function getNetworkSummary() {
  const tenants = getTenants();
  const db = getDb();
  const data = db._data();
  const drivers = data.drivers || [];
  const orders  = data.orders  || [];

  return Object.values(tenants)
    .filter((t) => t.slug !== 'default' && t.active !== false)
    .map((t) => ({
      slug:          t.slug,
      name:          t.name,
      market:        t.market,
      corridor:      t.corridor,
      cities:        t.cities        || [],
      zip_codes:     t.zip_codes     || [],
      color:         t.color,
      driver_count:  drivers.filter((d) => d.coop_slug === t.slug && d.trained).length,
      order_count:   orders.filter((o) => o.coop_slug === t.slug).length,
      logo_letter:   t.logo_letter,
    }));
}

module.exports = { coopsForZip, findAvailableDriver, resolveNetworkDriver, assignNetworkDriver, getNetworkSummary };
