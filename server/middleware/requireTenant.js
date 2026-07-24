/**
 * Tenant middleware — attaches req.tenant to every request.
 * Reads from:
 *   1. X-Coop-Slug header (useful for API clients / testing)
 *   2. Host header subdomain  (wasatchbuybacks.oddcoop.com)
 *   3. Falls back to 'default' tenant (OddCoop)
 */
const { resolveTenant } = require('../config/tenants');

function requireTenant(req, res, next) {
  const slugOverride = req.headers['x-coop-slug'];
  const host = slugOverride
    ? slugOverride + '.oddcoop.com'
    : req.headers.host || '';
  req.tenant = resolveTenant(host);
  next();
}

module.exports = requireTenant;
