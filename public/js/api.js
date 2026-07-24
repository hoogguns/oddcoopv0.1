/* OddCoop frontend API client
 * All fetch calls go through here so auth headers and base URL are consistent.
 * Token is stored in sessionStorage so it clears on tab close.
 */

const API = (() => {
  const BASE = '';

  function getToken() { return sessionStorage.getItem('oc_token'); }
  function setToken(t) { sessionStorage.setItem('oc_token', t); }
  function clearToken() { sessionStorage.removeItem('oc_token'); }

  function headers(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    const t = getToken();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  }

  async function request(method, path, body) {
    const opts = { method, headers: headers() };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(BASE + path, opts);
    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data });
    return data;
  }

  const get  = (p)    => request('GET',    p);
  const post = (p, b) => request('POST',   p, b);
  const put  = (p, b) => request('PUT',    p, b);
  const del  = (p)    => request('DELETE', p);

  return {
    // Auth
    loginPartner: (email, password) =>
      post('/api/auth/partner/login', { email, password }).then((d) => { setToken(d.token); return d; }),
    loginDriver: (email, password) =>
      post('/api/auth/driver/login', { email, password }).then((d) => { setToken(d.token); return d; }),
    logout: () => clearToken(),
    me: () => get('/api/auth/partner/me'),
    meDriver: () => get('/api/auth/driver/me'),
    isLoggedIn: () => !!getToken(),

    // Coop / tenant
    coop: ()     => get('/api/coop'),
    coverage: () => get('/api/coverage'),
    stats: ()    => get('/api/stats'),
    health: ()   => get('/api/health'),
    lead: (body) => post('/api/lead', body),

    // Orders
    orders: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return get('/api/orders' + (qs ? '?' + qs : ''));
    },
    order:        (id)   => get('/api/orders/' + id),
    createOrder:  (body) => post('/api/orders', body),
    assignDriver: (id, driver_id) => put('/api/orders/' + id + '/assign', { driver_id }),
    updateStatus: (id, status, extra = {}) => put('/api/orders/' + id + '/status', { status, ...extra }),
    verify:       (id, body) => put('/api/orders/' + id + '/verify', body),
    releasePayment: (id, body) => put('/api/orders/' + id + '/pay', body),
    cancelOrder:  (id, reason) => put('/api/orders/' + id + '/cancel', { reason }),

    // Drivers
    drivers:     () => get('/api/drivers'),
    driverOrders: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return get('/api/driver/orders' + (qs ? '?' + qs : ''));
    },
    claimOrder:  (id) => put('/api/driver/orders/' + id + '/claim', {}),
    driverStatus: (status) => put('/api/driver/status', { status }),

    // Partner stats
    partnerStats: () => get('/api/partner/stats'),
    partnerMonthly: () => get('/api/partner/monthly'),

    getToken,
    setToken,
    clearToken,
  };
})();

if (typeof module !== 'undefined') module.exports = API;
