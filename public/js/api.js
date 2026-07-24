/* OddCoop frontend API client v2
 * Token stored in sessionStorage (clears on tab close).
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
  const put  = (p, b) => req('PUT',    p, b);
  const del  = (p)    => req('DELETE', p);

  return {
    // ── Auth ────────────────────────────────────────────────────────
    loginPartner: (email, password) =>
      post('/api/auth/partner/login', { email, password }).then((d) => { setToken(d.token); return d; }),
    loginDriver: (email, password) =>
      post('/api/auth/driver/login', { email, password }).then((d) => { setToken(d.token); return d; }),
    logout:    () => { clearToken(); },
    me:        () => get('/api/auth/partner/me'),
    meDriver:  () => get('/api/auth/driver/me'),
    isLoggedIn: () => !!getToken(),

    // ── Tenant / coop ────────────────────────────────────────────────
    coop:     () => get('/api/coop'),
    coverage: () => get('/api/coverage'),
    stats:    () => get('/api/stats'),
    health:   () => get('/api/health'),
    lead: (body) => post('/api/lead', body),

    // ── Partner orders ───────────────────────────────────────────────
    orders: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return get('/api/partner/orders' + (qs ? '?' + qs : ''));
    },
    order:          (id)         => get('/api/partner/orders/' + id),
    createOrder:    (body)       => post('/api/partner/orders', body),
    assignDriver:   (id, did)    => post('/api/partner/orders/' + id + '/assign', { driver_id: did }),
    updateStatus:   (id, status, extra = {}) => post('/api/partner/orders/' + id + '/status', { status, ...extra }),
    releasePayment: (id, body)   => post('/api/partner/orders/' + id + '/pay', body),
    cancelOrder:    (id, reason) => post('/api/partner/orders/' + id + '/cancel', { reason }),
    dispatchOrder:  (id, body)   => post('/api/partner/orders/' + id + '/dispatch', body),

    // ── Partner misc ────────────────────────────────────────────────
    partnerStats:    () => get('/api/partner/stats'),
    partnerEconomics: () => get('/api/partner/economics'),
    partnerDrivers:   () => get('/api/partner/drivers'),
    partnerStatuses:  () => get('/api/partner/statuses'),
    integrations:     () => get('/api/partner/integrations'),

    // ── Driver ──────────────────────────────────────────────────────
    driverOrders: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return get('/api/driver/orders' + (qs ? '?' + qs : ''));
    },
    driverOrder:   (id)    => get('/api/driver/orders/' + id),
    claimOrder:    (id)    => post('/api/driver/orders/' + id + '/claim', {}),
    driverStatus:  (id, status) => post('/api/driver/orders/' + id + '/status', { status }),
    verifyDevice:  (id, body)   => post('/api/driver/orders/' + id + '/verify', body),

    getToken,
    setToken,
    clearToken,
  };
})();

if (typeof module !== 'undefined') module.exports = API;
