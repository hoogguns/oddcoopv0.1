/**
 * Tenant registry.
 * Add a new coop here and it gets its own branded experience at [slug].oddcoop.com
 * Fields:
 *   slug        — subdomain / URL key
 *   name        — display name shown in UI
 *   color       — primary brand hex
 *   market      — short market description
 *   corridor    — city corridor label
 *   cities      — pilot cities
 *   logo_letter — single letter for the brand mark icon
 */

const TENANTS = {
  wasatchbuybacks: {
    slug: 'wasatchbuybacks',
    name: 'Wasatch Buybacks',
    color: '#2d8b8b',
    market: 'Wasatch Front, Utah',
    corridor: 'Ogden → Salt Lake City → Provo',
    cities: ['Ogden','Layton','Bountiful','Salt Lake City','Murray','Sandy','Draper','Lehi','Orem','Provo'],
    logo_letter: 'W',
  },
  default: {
    slug: 'default',
    name: 'OddCoop',
    color: '#2d8b8b',
    market: 'Your local market',
    corridor: 'Your city corridor',
    cities: [],
    logo_letter: 'O',
  },
};

/**
 * Resolve tenant from a hostname string like:
 *   wasatchbuybacks.oddcoop.com  → wasatchbuybacks
 *   localhost:3847               → default (dev fallback)
 *   oddcoop.com                  → default
 */
function resolveTenant(host) {
  if (!host) return TENANTS.default;
  const sub = host.split('.')[0].toLowerCase().replace(/:\d+$/, '');
  return TENANTS[sub] || TENANTS.default;
}

module.exports = { TENANTS, resolveTenant };
