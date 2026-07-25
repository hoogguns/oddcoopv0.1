(() => {
  const $ = (sel, el = document) => el.querySelector(sel);

  let activeId = null;

  // ── session helpers ───────────────────────────────────────────────────
  const SESSION_KEY = 'oc_driver';
  function setSession(token, user) {
    API.setToken(token);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }
  function getUser() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
  }
  function clearSession() {
    API.clearToken();
    sessionStorage.removeItem(SESSION_KEY);
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function money(n) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n) || 0);
  }
  function fmtWhen(ts) {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ts; }
  }
  function statusChip(s) {
    const map = { pending:'chip-warn', assigned:'chip-brand', en_route:'chip-brand', picked_up:'chip-brand', verifying:'chip-warn', verified:'chip-good', mismatch:'chip-bad', paid:'chip-good', cancelled:'chip-bad' };
    return `<span class="chip ${map[s]||''}">${s}</span>`;
  }

  function showLogin() {
    $('#login-view').classList.remove('hidden');
    $('#app-view').classList.add('hidden');
  }

  function showApp() {
    $('#login-view').classList.add('hidden');
    $('#app-view').classList.remove('hidden');
    const u = getUser();
    if (u) {
      const nameEl = $('#side-name');
      const zoneEl = $('#side-zone');
      if (nameEl) nameEl.textContent = u.name || 'Driver';
      if (zoneEl) zoneEl.textContent = `${u.driver_code || ''} · ★ ${u.rating || '—'} · ${(u.zones || []).join(', ')}`;
    }
  }

  async function bootstrap() {
    if (!API.getToken()) return showLogin();
    try {
      const me = await API.meDriver();
      setSession(API.getToken(), me.driver);
      showApp();
      await refresh();
    } catch {
      clearSession();
      showLogin();
    }
  }

  async function refresh() {
    try {
      const data = await API.driverOrders();
      const assigned  = data.assigned  || data.orders?.filter(o => ['assigned','en_route','picked_up','verifying'].includes(o.status)) || [];
      const available = data.available || data.orders?.filter(o => o.status === 'pending') || [];
      renderMine(assigned);
      renderOpen(available);
      if (activeId) {
        const still = assigned.find((o) => o.id === activeId);
        if (still) await openJob(activeId);
      }
    } catch (e) { console.warn('refresh', e); }
  }

  function renderMine(orders) {
    const countEl = $('#active-count');
    if (countEl) countEl.textContent = orders.length + ' active';
    const body = $('#active-body');
    if (!body) return;
    body.innerHTML = '';
    const emptyEl = $('#active-empty');
    if (!orders.length) { emptyEl && emptyEl.classList.remove('hidden'); return; }
    emptyEl && emptyEl.classList.add('hidden');
    for (const o of orders) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono text-sm">${escapeHtml(o.external_ref || o.id.slice(0,8))}</td>
        <td>${escapeHtml(o.seller_name)}</td>
        <td><strong>${escapeHtml(o.device_brand)} ${escapeHtml(o.device_model)}</strong></td>
        <td>${statusChip(o.status)}</td>
        <td><button class="btn btn-soft btn-sm" type="button">Open</button></td>
      `;
      tr.querySelector('button').addEventListener('click', () => openJob(o.id));
      body.appendChild(tr);
    }
  }

  function renderOpen(orders) {
    const countEl = $('#avail-count');
    if (countEl) countEl.textContent = orders.length + ' orders';
    const body = $('#avail-body');
    if (!body) return;
    body.innerHTML = '';
    const emptyEl = $('#avail-empty');
    if (!orders.length) { emptyEl && emptyEl.classList.remove('hidden'); return; }
    emptyEl && emptyEl.classList.add('hidden');
    for (const o of orders) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono text-sm">${escapeHtml(o.external_ref || o.id.slice(0,8))}</td>
        <td><strong>${escapeHtml(o.device_brand)} ${escapeHtml(o.device_model)}</strong><div class="muted text-sm">${escapeHtml(o.device_condition)}</div></td>
        <td>${escapeHtml(o.pickup_city)}</td>
        <td class="amount">${money(o.quoted_amount)}</td>
        <td class="text-sm">${fmtWhen(o.window_start)}–${fmtWhen(o.window_end)}</td>
        <td><button class="btn btn-primary btn-sm" type="button">Claim + route</button></td>
      `;
      tr.querySelector('button').addEventListener('click', async () => {
        try {
          const { order } = await API.claimOrder(o.id);
          activeId = order.id;
          setView('active');
          await refresh();
          await openJob(order.id);
        } catch (err) { alert(err.message); }
      });
      body.appendChild(tr);
    }
  }

  async function openJob(id) {
    activeId = id;
    setView('active');
    try {
      const { order } = await API.driverOrder(id);
      const jobBody = $('#job-body');
      if (!jobBody) return;

      const expected  = order.expected_specs  || {};
      const driverFlow = [
        ['assigned',  'en_route',  'Start route'],
        ['en_route',  'picked_up', 'Mark picked up'],
        ['picked_up', 'verifying', 'Start verifying'],
        ['verified',  'shipped',   'Mark parcel dropped'],
      ];
      const statusBtns = driverFlow
        .filter(([from]) => order.status === from)
        .map(([,to,label]) => `<button class="btn btn-soft btn-sm" data-st="${to}" type="button">${label}</button>`);
      if (['picked_up','verifying'].includes(order.status))
        statusBtns.push(`<button class="btn btn-ghost btn-sm" data-st="verifying" type="button">Verifying</button>`);

      const canVerify = ['picked_up','verifying'].includes(order.status);

      jobBody.innerHTML = `
        <div class="stack">
          <div>
            <strong>${escapeHtml(order.device_brand)} ${escapeHtml(order.device_model)}</strong>
            <div class="text-sm text-muted">${escapeHtml(order.device_storage||'')} · ${escapeHtml(order.device_color||'')} · ${escapeHtml(order.device_condition)}</div>
          </div>
          <div class="text-sm">
            <div><strong>Seller:</strong> ${escapeHtml(order.seller_name)} · ${escapeHtml(order.seller_phone)}</div>
            <div><strong>Address:</strong> ${escapeHtml(order.pickup_address)}, ${escapeHtml(order.pickup_city)} ${escapeHtml(order.pickup_zip)}</div>
            <div><strong>Partner:</strong> ${escapeHtml(order.partner_name||'—')}</div>
            <div><strong>Quote:</strong> ${money(order.quoted_amount)}</div>
          </div>
          <div>
            <div class="text-sm"><strong>Expected specs</strong></div>
            <pre class="mono text-sm" style="margin:.25rem 0 0;white-space:pre-wrap;background:var(--canvas);padding:.5rem;border-radius:6px">${escapeHtml(JSON.stringify(expected,null,2))}</pre>
          </div>
          <div class="row">${statusBtns.join('')}</div>
          <div class="card" style="padding:.65rem;box-shadow:none">
            <div class="text-sm mb-1"><strong>Parcel tracking</strong></div>
            <div class="form-grid">
              <label class="field">Carrier
                <select id="d-trk-carrier"><option value="">Select…</option><option>UPS</option><option>FedEx</option><option>USPS</option><option>DHL</option><option>Other</option></select>
              </label>
              <label class="field">Tracking #
                <input id="d-trk-number" class="mono" value="${escapeHtml(order.tracking_number||'')}" />
              </label>
            </div>
            <button class="btn btn-ghost btn-sm mt-1" type="button" id="d-trk-save">Save tracking</button>
            ${order.tracking_url ? `<a class="text-sm" href="${escapeHtml(order.tracking_url)}" target="_blank" rel="noopener">Track package</a>` : ''}
          </div>
          ${order.door_checklist ? `<div><div class="text-sm"><strong>Partner door checklist</strong></div>
            <pre class="mono text-sm" style="margin:.25rem 0 0;white-space:pre-wrap;background:var(--canvas);padding:.5rem;border-radius:6px">${escapeHtml(JSON.stringify(order.door_checklist,null,2))}</pre></div>` : ''}
          ${canVerify ? `<form id="inline-verify-form" class="stack" style="border-top:1px solid var(--line);padding-top:.7rem">
            <strong class="text-sm">On-site verification</strong>
            <div class="form-grid">
              <label class="field">Observed brand<input name="brand" value="${escapeHtml(expected.brand||order.device_brand||'')}" required /></label>
              <label class="field">Observed model<input name="model" value="${escapeHtml(expected.model||order.device_model||'')}" required /></label>
              <label class="field">Storage<input name="storage" value="${escapeHtml(expected.storage||order.device_storage||'')}" /></label>
              <label class="field">Condition
                <select name="condition">${['Excellent','Good','Fair','Poor'].map(c=>`<option ${c===(expected.condition||order.device_condition)?'selected':''}>${c}</option>`).join('')}</select>
              </label>
              <label class="field">Powers on?
                <select name="powers_on"><option value="true" selected>Yes</option><option value="false">No</option></select>
              </label>
              <label class="field">Account locked?
                <select name="account_locked"><option value="false" selected>No</option><option value="true">Yes</option></select>
              </label>
              <label class="field">Screen cracks?
                <select name="screen_cracks"><option value="false" selected>No</option><option value="true">Yes</option></select>
              </label>
              <label class="field">Packed to SOP?
                <select name="packed"><option value="true" selected>Yes</option><option value="false">No</option></select>
              </label>
              <label class="field full">Notes<textarea name="notes" placeholder="Anything the partner should know"></textarea></label>
            </div>
            <button class="btn btn-accent" type="submit">Submit verification</button>
          </form>` : order.verification_match != null
            ? `<div class="alert ${order.verification_match ? 'alert-ok' : 'alert-error'}">${order.verification_match ? 'Match recorded — partner can pay same day.' : 'Mismatch recorded — partner review required.'}</div>`
            : ''}
        </div>
      `;

      jobBody.querySelectorAll('[data-st]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try { await API.driverStatus(order.id, btn.dataset.st); await refresh(); await openJob(order.id); }
          catch (err) { alert(err.message); }
        });
      });

      const trkSave = $('#d-trk-save');
      if (trkSave) {
        trkSave.addEventListener('click', async () => {
          try {
            // No dedicated tracking endpoint on driver side — use status update with extra fields
            await API.driverStatus(order.id, order.status);
            await refresh(); await openJob(order.id);
          } catch (err) { alert(err.message); }
        });
      }

      const inlineVerify = $('#inline-verify-form');
      if (inlineVerify) {
        inlineVerify.addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(inlineVerify);
          try {
            const res = await API.verifyDevice(order.id, {
              observed_specs: {
                brand: fd.get('brand'), model: fd.get('model'),
                storage: fd.get('storage'), condition: fd.get('condition'),
              },
              checklist: {
                powers_on:      fd.get('powers_on')      === 'true',
                account_locked: fd.get('account_locked') === 'true',
                icloud_locked:  fd.get('account_locked') === 'true',
                screen_cracks:  fd.get('screen_cracks')  === 'true',
                meets_condition: true,
              },
              packed: fd.get('packed') === 'true',
              notes:  fd.get('notes') || '',
            });
            alert(res.message || 'Verification submitted');
            await refresh(); await openJob(order.id);
          } catch (err) { alert(err.message); }
        });
      }
    } catch (e) { console.warn('openJob', e); }
  }

  function setView(name) {
    document.querySelectorAll('.side-nav a[data-view]').forEach((a) => {
      a.classList.toggle('active', a.dataset.view === name);
    });
    ['available','active','verify','history'].forEach((v) => {
      const el = document.getElementById('view-' + v);
      if (el) el.classList.toggle('hidden', v !== name);
    });
    const titles = { available: 'Available pickups', active: 'My active orders', verify: 'Device verification', history: 'Completed orders' };
    const titleEl = $('#view-title');
    if (titleEl) titleEl.textContent = titles[name] || 'Driver portal';
  }

  // ── login form ───────────────────────────────────────────────────
  $('#login-form') && $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const res = await API.loginDriver(fd.get('email'), fd.get('password'));
      setSession(res.token, res.driver);
      showApp();
      await refresh();
    } catch (err) {
      const alertEl = $('#login-alert');
      if (alertEl) {
        alertEl.className = 'alert alert-error';
        alertEl.textContent = err.message;
        alertEl.classList.remove('hidden');
      }
    }
  });

  $('#btn-logout') && $('#btn-logout').addEventListener('click', () => { clearSession(); showLogin(); });
  $('#btn-refresh') && $('#btn-refresh').addEventListener('click', () => refresh());

  document.querySelectorAll('.side-nav a[data-view]').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); setView(a.dataset.view); });
  });

  bootstrap();
})();
