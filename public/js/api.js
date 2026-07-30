/* OddCoop frontend API client v3
 * Token stored in sessionStorage (clears on tab close).
 * Route base paths match server/app.js mounts:
 *   /api/auth/*          — auth.js
 *   /api/coop/*          — coop.js
 *   /api/orders/*        — orders.js (partner + driver)
 *   /api/public/*        — public.js
 *   /api/v1/*            — quote.js
 */

const API = (() => {
  const BASE = '';

  function getToken()    { return sessionStorage.getItem('oc_token'); }
  function setToken(t)   { sessionStorage.setItem('oc_token', t); }
  function clearToken()  { sessionStorage.removeItem('oc_token'); }

  function authHeaders(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    const t = getToken();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  }

  async function req(method, path, body) {
    const opts = { method, headers: authHeaders() };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(BASE + path, opts);
    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data });
    return data;
  }

  const get  = (p)    => req('GET',    p);
  const post = (p, b) => req('POST',   p, b);
  const patch = (p, b) => req('PATCH', p, b);
  const del  = (p)    => req('DELETE', p);

  return {
    // ── Auth ────────────────────────────────────────────────────────
    loginPartner: (email, password) =>
      post('/api/auth/partner/login', { email, password }).then((d) => { setToken(d.token); return d; }),
    loginDriver: (email, password) =>
      post('/api/auth/driver/login', { email, password }).then((d) => { setToken(d.token); return d; }),
    logout:     () => { clearToken(); },
    me:         () => get('/api/auth/partner/me'),
    meDriver:   () => get('/api/auth/driver/me'),
    isLoggedIn: () => !!getToken(),

    // ── Tenant / coop ────────────────────────────────────────────────
    coop:       () => get('/api/coop'),
    coopAll:    () => get('/api/coop/all'),
    coopNetwork:() => get('/api/coop/network'),
    coopBySlug: (slug) => get('/api/coop/' + slug),
    // Cross-coop order acceptance (Coop R)
    coopIncoming:     ()   => get('/api/coop/orders/incoming'),
    coopAcceptOrder:  (id) => post('/api/coop/orders/' + id + '/accept', {}),
    coopNotifyOrder:  (id) => post('/api/coop/orders/' + id + '/notify', {}),
    // Standing
    coopStanding:     ()   => get('/api/coop/standing'),

    // ── Admin (/api/admin/*) ─────────────────────────────────────────
    adminCoops:        ()        => get('/api/admin/coops'),
    adminCoop:         (id)      => get('/api/admin/coops/' + id),
    adminSuspend:      (id, r)   => post('/api/admin/coops/' + id + '/suspend',    { reason: r }),
    adminUnsuspend:    (id)      => post('/api/admin/coops/' + id + '/unsuspend',  {}),
    adminStrike:       (id, r, oid) => post('/api/admin/coops/' + id + '/strike', { reason: r, order_id: oid }),
    adminRemoveStrike: (id, idx) => del('/api/admin/coops/' + id + '/strike/' + idx),
    adminOrders:       (p = {})  => { const qs = new URLSearchParams(p).toString(); return get('/api/admin/orders' + (qs ? '?' + qs : '')); },
    adminMetrics:      ()        => get('/api/admin/metrics'),
    adminAudit:        (p = {})  => { const qs = new URLSearchParams(p).toString(); return get('/api/admin/audit' + (qs ? '?' + qs : '')); },

    coverage: () => get('/api/public/coverage'),
    stats:    () => get('/api/public/stats'),
    health:   () => get('/api/health'),
    lead:     (body) => post('/api/public/lead', body),

    // ── Quote / v1 ───────────────────────────────────────────────────
    devices:   ()     => get('/api/v1/devices'),
    quote:     (p)    => get('/api/v1/quote?' + new URLSearchParams(p).toString()),
    territory: (zip)  => get('/api/v1/territory/' + zip),
    submitOrder: (b)  => post('/api/v1/orders', b),

    // ── Partner orders (/api/orders/partner/*) ───────────────────────
    orders: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return get('/api/orders/partner/orders' + (qs ? '?' + qs : ''));
    },
    order:          (id)         => get('/api/orders/partner/orders/' + id),
    createOrder:    (body)       => post('/api/orders/partner/orders', body),
    assignDriver:   (id, did)    => post('/api/orders/partner/orders/' + id + '/assign', { driver_id: did }),
    updateStatus:   (id, status, extra = {}) =>
      post('/api/orders/partner/orders/' + id + '/status', { status, ...extra }),
    updateTracking: (id, body)   => post('/api/orders/partner/orders/' + id + '/tracking', body),
    releasePayment: (id, body)   => post('/api/orders/partner/orders/' + id + '/pay', body),
    cancelOrder:    (id, reason) => post('/api/orders/partner/orders/' + id + '/cancel', { reason }),
    dispatchOrder:  (id, body)   => post('/api/orders/partner/orders/' + id + '/dispatch', body),

    // ── Partner misc ─────────────────────────────────────────────────
    partnerStats:     () => get('/api/orders/partner/stats'),
    partnerEconomics: () => get('/api/orders/partner/economics'),
    partnerDrivers:   () => get('/api/orders/partner/drivers'),
    partnerStatuses:  () => get('/api/orders/partner/statuses'),
    partnerPricing:   () => get('/api/orders/partner/pricing'),
    integrations:     () => get('/api/orders/partner/integrations'),

    // ── Partner checklists ───────────────────────────────────────────
    checklists:       ()        => get('/api/orders/partner/checklists'),
    checklist:        (id)      => get('/api/orders/partner/checklists/' + id),
    createChecklist:  (body)    => post('/api/orders/partner/checklists', body),
    updateChecklist:  (id, b)   => patch('/api/orders/partner/checklists/' + id, b),
    deleteChecklist:  (id)      => del('/api/orders/partner/checklists/' + id),

    // ── Driver (/api/orders/driver/*) ────────────────────────────────
    driverOrders: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return get('/api/orders/driver/orders' + (qs ? '?' + qs : ''));
    },
    driverOrder:  (id)          => get('/api/orders/driver/orders/' + id),
    claimOrder:   (id)          => post('/api/orders/driver/orders/' + id + '/claim', {}),
    driverStatus: (id, status)  => post('/api/orders/driver/orders/' + id + '/status', { status }),
    verifyDevice: (id, body)    => post('/api/orders/driver/orders/' + id + '/verify', body),

    getToken,
    setToken,
    clearToken,
  };
})();

if (typeof module !== 'undefined') module.exports = API;
