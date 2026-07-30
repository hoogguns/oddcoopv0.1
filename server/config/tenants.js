/**
 * Tenant registry — backed by DB (data/oddcoop.json coops array).
 * Falls back to STATIC_TENANTS so the app works before any coops are registered.
 *
 * resolveTenant(host) is unchanged for callers.
 */
const { getDb } = require('../db');

const STATIC_TENANTS = {
  wasatchbuybacks: {
    slug: 'wasatchbuybacks',
    name: 'Wasatch Buybacks',
    color: '#2d8b8b',
    market: 'Wasatch Front, Utah',
    corridor: 'Ogden → Salt Lake City → Provo',
    cities: ['Ogden','Layton','Bountiful','Salt Lake City','Murray','Sandy','Draper','Lehi','Orem','Provo'],
    zip_codes: ['84401','84403','84404','84405','84414','84015','84010','84070','84094','84020','84043','84057','84058','84601','84604','84606','84101','84102','84103','84104','84105','84106','84107','84108','84111','84115','84116','84117','84119','84120','84121','84123','84124'],
    logo_letter: 'W',
    active: true,
  },
  default: {
    slug: 'default',
    name: 'OddCoop',
    color: '#2d8b8b',
    market: 'Your local market',
    corridor: 'Your city corridor',
    cities: [],
    zip_codes: [],
    logo_letter: 'O',
    active: true,
  },
};

/**
 * Hosts that map to wasatchbuybacks in local development.
 * This lets localhost:3847 behave identically to wasatchbuybacks.oddcoop.app.
 */
const DEV_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

/**
 * Build the live tenant map: static tenants merged with any DB-registered coops.
 * DB records win over static defaults (so a coop can update branding via the API).
 */
function getTenants() {
  let dbCoops = [];
  try {
    const db = getDb();
    dbCoops = db._data().coops || [];
  } catch (_) { /* db not ready yet during first boot */ }

  const map = { ...STATIC_TENANTS };
  for (const coop of dbCoops) {
    if (!coop.slug) continue;
    map[coop.slug] = {
      logo_letter: coop.name ? coop.name[0].toUpperCase() : 'C',
      ...map[coop.slug],   // keep static overrides if they exist
      ...coop,
    };
  }
  return map;
}

function resolveTenant(host) {
  const tenants = getTenants();
  if (!host) return tenants.default || STATIC_TENANTS.default;

  // strip port, lowercase
  const bare = host.split(':')[0].toLowerCase();

  // local dev → always use wasatchbuybacks so demo data loads correctly
  if (DEV_HOSTS.has(bare)) {
    return tenants.wasatchbuybacks || STATIC_TENANTS.wasatchbuybacks;
  }

  // production: match on subdomain (e.g. wasatchbuybacks.oddcoop.app)
  const sub = bare.split('.')[0];
  return tenants[sub] || tenants.default || STATIC_TENANTS.default;
}

// Keep TENANTS as a live getter for legacy code that does TENANTS.wasatchbuybacks
const TENANTS = new Proxy({}, {
  get(_, key) { return getTenants()[key]; },
  ownKeys()   { return Object.keys(getTenants()); },
  has(_, key) { return key in getTenants(); },
  getOwnPropertyDescriptor(_, key) {
    const t = getTenants();
    if (key in t) return { value: t[key], writable: true, enumerable: true, configurable: true };
  },
});

module.exports = { TENANTS, getTenants, resolveTenant, STATIC_TENANTS, DEV_HOSTS };
