/**
 * territoryService.js — ZIP code → coop territory resolution.
 *
 * Provides a clean public interface for territory lookups that is decoupled
 * from the multi-tenant config internals. Routes and the quote flow import
 * this module rather than calling getTenants() directly.
 *
 * Coop coverage affects what the quote page shows the seller:
 *   • ZIP covered by an active coop → Same-Day pickup available
 *   • ZIP not covered               → Standard mail-in only (no same-day)
 *
 * @module server/services/territoryService
 */
'use strict';

const { getTenants } = require('../config/tenants');

/**
 * Find all active coops whose ZIP code list includes the given ZIP.
 * Returns an empty array if no coop covers the ZIP.
 *
 * @param {string} zip - 5-digit US ZIP code
 * @returns {Array<{slug: string, name: string, market: string, cities: string[]}>}
 */
function coopsForZip(zip) {
  if (!zip) return [];
  const normalized = String(zip).trim().slice(0, 5);
  const tenants    = getTenants();

  return Object.values(tenants).filter(
    (t) =>
      t.slug !== 'default' &&
      t.active !== false &&
      Array.isArray(t.zip_codes) &&
      t.zip_codes.includes(normalized)
  ).map((t) => ({
    slug:    t.slug,
    name:    t.name,
    market:  t.market,
    cities:  t.cities || [],
    color:   t.color  || '#01696f',
  }));
}

/**
 * Check whether Same-Day pickup is available for a given ZIP code.
 * Returns the primary (first) covering coop if available, or null.
 *
 * @param {string} zip
 * @returns {{ available: boolean, coop: object|null, zip: string }}
 */
function sameDayAvailability(zip) {
  const coops = coopsForZip(zip);
  if (!coops.length) {
    return { available: false, coop: null, zip };
  }
  return { available: true, coop: coops[0], zip };
}

/**
 * Return all active coop territories (for the coverage page / map).
 *
 * @returns {object[]}
 */
function getAllTerritories() {
  const tenants = getTenants();
  return Object.values(tenants)
    .filter((t) => t.slug !== 'default' && t.active !== false)
    .map((t) => ({
      slug:      t.slug,
      name:      t.name,
      market:    t.market,
      corridor:  t.corridor || null,
      cities:    t.cities   || [],
      zip_codes: t.zip_codes || [],
      color:     t.color    || '#01696f',
    }));
}

module.exports = { coopsForZip, sameDayAvailability, getAllTerritories };
