/**
 * dashboard.js — OddCoop partner dashboard controller.
 * Sprint 3: WebSocket live events, Network view, standing badge.
 */
(() => {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  let selectedId    = null;
  let driversCache  = [];
  let wsConn        = null;
  let wsReconnectTO = null;
  const WS_MAX_BACKOFF = 30000;
  let wsBackoff = 1500;

  // ── session helpers ───────────────────────────────────────────────────────
  const SESSION_KEY_PARTNER = 'oc_partner';
  function setSession(role, token, user) {
    API.setToken(token);
    sessionStorage.setItem(SESSION_KEY_PARTNER, JSON.stringify(user));
  }
  function getUser() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY_PARTNER)); } catch { return null; }
  }
  function clearSession() {
    API.clearToken();
    sessionStorage.removeItem(SESSION_KEY_PARTNER);
  }

  // ── utilities ─────────────────────────────────────────────────────────────
  function money(n) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n) || 0);
  }

  function statusChip(s) {
    const map = {
      pending: 'chip-warn', assigned: 'chip-brand', en_route: 'chip-brand',
      picked_up: 'chip-brand', verifying: 'chip-warn', verified: 'chip-good',
      mismatch: 'chip-bad', paid: 'chip-good', shipped: 'chip-good',
      delivered: 'chip-good', cancelled: 'chip-bad', none: '',
    };
    return `<span class="chip ${map[s] || ''}">${s}</span>`;
  }

  function standingChip(s) {
    const map = { good: 'chip-good', warning: 'chip-warn', suspended: 'chip-bad' };
    const labels = { good: '✓ Good standing', warning: '⚠ Warning', suspended: '✕ Suspended' };
    return `<span class="chip ${map[s] || ''}" style="font-size:.7rem">${labels[s] || s}</span>`;
  }

  function fmtWhen(ts) {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleString(); } catch { return ts; }
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function row(label, value, note = '') {
    return `<tr><td><strong>${label}</strong>${note ? `<div class="muted">${note}</div>` : ''}</td><td class="amount" style="text-align:right;white-space:nowrap">${value}</td></tr>`;
  }

  // ── Toast notifications ───────────────────────────────────────────────────
  let toastContainer = null;
  function ensureToastContainer() {
    if (toastContainer) return toastContainer;
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = [
      'position:fixed', 'bottom:1.5rem', 'right:1.5rem', 'z-index:9999',
      'display:flex', 'flex-direction:column', 'gap:.5rem', 'max-width:360px',
    ].join(';');
    document.body.appendChild(toastContainer);
    return toastContainer;
  }

  /**
   * Show a toast notification.
   * @param {string} message
   * @param {'info'|'success'|'warn'|'error'} type
   * @param {number} duration ms (0 = sticky)
   */
  function toast(message, type = 'info', duration = 5000) {
    const c = ensureToastContainer();
    const el = document.createElement('div');
    const colors = {
      info:    'background:#1f2328;color:#fff',
      success: 'background:#01696f;color:#fff',
      warn:    'background:#92570a;color:#fff',
      error:   'background:#b91c1c;color:#fff',
    };
    el.style.cssText = [
      colors[type] || colors.info,
      'padding:.65rem 1rem', 'border-radius:10px', 'font-size:.875rem',
      'line-height:1.4', 'box-shadow:0 4px 16px rgba(0,0,0,.18)',
      'display:flex', 'justify-content:space-between', 'align-items:flex-start', 'gap:.5rem',
      'animation:toastIn .2s ease',
    ].join(';');
    el.innerHTML = `<span>${escapeHtml(message)}</span><button style="background:none;border:none;color:inherit;cursor:pointer;padding:0;font-size:1rem;line-height:1;flex-shrink:0" type="button">×</button>`;
    el.querySelector('button').addEventListener('click', () => el.remove());
    c.appendChild(el);
    if (duration > 0) setTimeout(() => el.remove(), duration);

    // Inject animation keyframes once
    if (!document.getElementById('toast-keyframes')) {
      const style = document.createElement('style');
      style.id = 'toast-keyframes';
      style.textContent = '@keyframes toastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}';
      document.head.appendChild(style);
    }
  }

  // ── WebSocket ─────────────────────────────────────────────────────────────
  function wsUrl() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}/ws`;
  }

  function connectWs() {
    const user = getUser();
    if (!user || wsConn) return;

    try {
      wsConn = new WebSocket(wsUrl());
    } catch { return; }

    wsConn.addEventListener('open', () => {
      wsBackoff = 1500;
      wsConn.send(JSON.stringify({ type: 'subscribe', partnerId: user.id }));
    });

    wsConn.addEventListener('message', (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }
      handleWsMessage(msg);
    });

    wsConn.addEventListener('close', () => {
      wsConn = null;
      scheduleWsReconnect();
    });

    wsConn.addEventListener('error', () => {
      wsConn && wsConn.close();
    });

    // Keepalive ping every 25s
    const pingInterval = setInterval(() => {
      if (wsConn && wsConn.readyState === WebSocket.OPEN) {
        wsConn.send(JSON.stringify({ type: 'ping' }));
      } else {
        clearInterval(pingInterval);
      }
    }, 25000);
  }

  function scheduleWsReconnect() {
    if (wsReconnectTO) return;
    wsReconnectTO = setTimeout(() => {
      wsReconnectTO = null;
      wsConn = null;
      if (API.getToken()) connectWs();
    }, wsBackoff);
    wsBackoff = Math.min(wsBackoff * 1.5, WS_MAX_BACKOFF);
  }

  function handleWsMessage(msg) {
    if (msg.type === 'subscribed') return; // handshake ack
    if (msg.type === 'pong')       return;

    if (msg.type === 'coopR_new_order') {
      // We are Coop R — new order awaiting our acceptance
      const o = msg.order || {};
      toast(
        `🔔 New pickup in your territory!\n${o.device_brand || ''} ${o.device_model || ''} — ${o.pickup_city || ''} · Accept before 20:00`,
        'warn', 8000
      );
      // Refresh network / incoming orders view if currently visible
      if (!$('#view-network')?.classList.contains('hidden')) {
        loadIncoming().catch(() => {});
      }
      loadStats().catch(() => {});
    }

    if (msg.type === 'coopA_order_accepted') {
      toast(`✓ Coop R accepted your pickup — order ${(msg.order_id || '').slice(0, 8)}`, 'success', 6000);
      loadOrders().catch(() => {});
      loadStats().catch(() => {});
    }

    if (msg.type === 'coopA_inspection_passed') {
      toast(`✅ Device inspection PASSED — release same-day payment within 1 hour.`, 'success', 0);
      loadOrders().catch(() => {});
      if (selectedId) showDetail(selectedId).catch(() => {});
    }

    if (msg.type === 'coopA_inspection_mismatch') {
      toast(`⚠ Device inspection MISMATCH — review required.`, 'warn', 0);
      loadOrders().catch(() => {});
      if (selectedId) showDetail(selectedId).catch(() => {});
    }

    if (msg.type === 'order:new' || msg.type === 'order:updated') {
      loadOrders().catch(() => {});
      loadStats().catch(() => {});
    }
  }

  // ── coop header hydration ─────────────────────────────────────────────────
  async function hydrateCoop() {
    try {
      const coop = await API.coop();
      const tokens = {
        '{{COOP_NAME}}':      coop.name     || 'OddCoop',
        '{{COOP_MARKET}}':   coop.market   || '',
        '{{COOP_CORRIDOR}}': coop.corridor || '',
      };
      function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          let v = node.nodeValue, changed = false;
          for (const [t, r] of Object.entries(tokens)) if (v.includes(t)) { v = v.split(t).join(r); changed = true; }
          if (changed) node.nodeValue = v;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          for (const child of node.childNodes) walk(child);
        }
      }
      walk(document.body);
      if (coop.color) document.documentElement.style.setProperty('--brand', coop.color);
    } catch (e) { console.warn('coop hydration', e); }
  }

  // ── auth views ────────────────────────────────────────────────────────────
  function showLogin() {
    $('#login-view').classList.remove('hidden');
    $('#app-view').classList.add('hidden');
    wsConn && wsConn.close();
    wsConn = null;
  }

  function showApp() {
    $('#login-view').classList.add('hidden');
    $('#app-view').classList.remove('hidden');
    const user = getUser();
    if (user) {
      const nameEl  = $('#side-company');
      const planEl  = $('#side-plan');
      const emailEl = $('#side-email');
      const keyEl   = $('#api-key');
      if (nameEl)  nameEl.textContent  = user.company_name || user.company || 'Partner';
      if (planEl)  planEl.textContent  = (user.plan || 'pilot') + ' plan';
      if (emailEl) emailEl.value       = user.email || '';
      if (keyEl && user.api_key) keyEl.value = user.api_key;
    }
    connectWs();
    loadStanding().catch(() => {});
  }

  // ── standing sidebar badge ────────────────────────────────────────────────
  async function loadStanding() {
    try {
      const s    = await API.coopStanding();
      const el   = $('#standing-badge');
      if (el) el.innerHTML = standingChip(s.standing);
      // Show alert banner if suspended
      const banner = $('#standing-banner');
      if (banner) {
        if (s.standing === 'suspended') {
          banner.innerHTML = `<div class="alert alert-error" style="margin:.75rem 1rem 0">Your coop is <strong>suspended</strong>. ${escapeHtml(s.suspended_reason || '')} Contact support to resolve.</div>`;
          banner.style.display = '';
        } else if (s.standing === 'warning') {
          banner.innerHTML = `<div class="alert alert-warn" style="margin:.75rem 1rem 0">⚠ ${s.strikes_count} late payment strike(s). You will be suspended at 3.</div>`;
          banner.style.display = '';
        } else {
          banner.style.display = 'none';
        }
      }
    } catch { /* not fatal — partner may not be seeded yet */ }
  }

  // ── bootstrap ─────────────────────────────────────────────────────────────
  async function bootstrap() {
    if (!API.getToken()) { showLogin(); return; }
    try {
      const me = await API.me();
      setSession('partner', API.getToken(), me.partner);
      showApp();
      await hydrateCoop();
      await refreshAll();
    } catch {
      clearSession();
      showLogin();
    }
  }

  async function refreshAll() {
    await Promise.all([loadStats(), loadEconomicsLive(), loadOrders(), loadDrivers()]);
    if (selectedId) await showDetail(selectedId);
  }

  // ── stats ─────────────────────────────────────────────────────────────────
  async function loadStats() {
    try {
      const s = await API.partnerStats();
      if ($('#s-open'))   $('#s-open').textContent   = s.open_orders;
      if ($('#s-total'))  $('#s-total').textContent  = s.total_orders;
      if ($('#s-volume')) $('#s-volume').textContent = money(s.total_volume);
      if ($('#s-paid'))   $('#s-paid').textContent   = s.paid_today.count;
      if ($('#s-paid-vol')) $('#s-paid-vol').textContent = money(s.paid_today.volume) + ' volume';
      if ($('#s-cycle'))  $('#s-cycle').textContent  = s.avg_cycle_hours != null ? s.avg_cycle_hours + 'h' : '—';
    } catch (e) { console.warn('loadStats', e); }
  }

  // ── economics ─────────────────────────────────────────────────────────────
  async function loadEconomicsLive() {
    try {
      const e   = await API.partnerEconomics();
      const inv  = e.partner_invoice;
      const prof = e.platform_profit;
      const act  = e.activity;

      if ($('#profit-period'))   $('#profit-period').textContent   = e.period_label || e.period;
      if ($('#m-invoice')) {
        $('#m-invoice').textContent     = money(inv.total);
        $('#m-invoice-sub').textContent = `${inv.plan.name} · sub ${money(inv.platform_fee)} · overage ${money(inv.overage_fees || 0)}`;
      }
      if ($('#m-profit')) {
        $('#m-profit').textContent     = money(prof.contribution);
        $('#m-profit').style.color     = prof.contribution >= 0 ? 'var(--good)' : 'var(--bad)';
        $('#m-profit-sub').textContent = `Platform COGS ${money(prof.cogs_total)} (hosting/support)`;
      }
      if ($('#m-pickups')) {
        $('#m-pickups').textContent     = String(act.completed_pickups);
        $('#m-pickups-sub').textContent = `${act.orders_created} created · ${act.paid} paid · ${act.mismatch} mismatch`;
      }
      if ($('#m-unit')) {
        $('#m-unit').textContent    = prof.margin_pct == null ? '—' : `${prof.margin_pct.toFixed(0)}%`;
        $('#m-unit-sub').textContent = prof.margin_pct == null ? 'No SaaS bill yet' : 'Contribution margin on SaaS revenue';
        if (prof.margin_pct != null) $('#m-unit').style.color = prof.margin_pct >= 0 ? 'var(--good)' : 'var(--bad)';
      }
      if ($('#e-live-invoice')) {
        $('#e-live-invoice').textContent    = money(inv.total);
        $('#e-live-invoice-sub').textContent = `What this partner pays OddCoop (${inv.plan.name})`;
        $('#e-live-profit').textContent     = money(prof.contribution);
        $('#e-live-profit').style.color     = prof.contribution >= 0 ? 'var(--good)' : 'var(--bad)';
        $('#e-live-profit-sub').textContent  = 'Your platform profit on their volume (est.)';
        $('#e-live-breakdown').innerHTML = [
          row('Period',             e.period_label || e.period),
          row('Model',              inv.model || 'saas_subscription'),
          row('Plan',               inv.plan.name),
          row('Orders completed',   String(act.completed_pickups)),
          row('Subscription',       money(inv.platform_fee)),
          row('Overage fees',       money(inv.overage_fees || 0)),
          row('Partner SaaS bill',  money(inv.total)),
          row('Platform COGS',      money(prof.cogs_total)),
          row('OddCoop contribution', money(prof.contribution)),
        ].join('');
      }
      return e;
    } catch (err) { console.warn('economics', err); return null; }
  }

  // ── orders list ───────────────────────────────────────────────────────────
  async function loadOrders() {
    try {
      const status = $('#status-filter') && $('#status-filter').value;
      const q      = $('#q') && $('#q').value.trim();
      const params = {};
      if (status) params.status = status;
      if (q)      params.q     = q;
      const { orders, total } = await API.orders(params);
      if ($('#order-count')) $('#order-count').textContent = total + ' order' + (total === 1 ? '' : 's');
      const body = $('#orders-body');
      body.innerHTML = '';
      if (!orders.length) { $('#orders-empty')?.classList.remove('hidden'); return; }
      $('#orders-empty')?.classList.add('hidden');
      for (const o of orders) {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        if (o.id === selectedId) tr.style.background = 'var(--brand-soft)';
        const crossBadge = o.cross_coop ? `<span class="chip chip-brand" style="font-size:.65rem">cross-coop</span>` : '';
        tr.innerHTML = `
          <td>
            <div class="mono" style="font-size:.75rem">${escapeHtml(o.external_ref || o.id.slice(0, 8))}</div>
            <strong>${escapeHtml(o.device_brand)} ${escapeHtml(o.device_model)}</strong>
            <div style="color:var(--muted);font-size:.75rem">${escapeHtml(o.device_storage || '')} · ${escapeHtml(o.device_condition)}${crossBadge ? ' ' : ''}${crossBadge}</div>
          </td>
          <td>${escapeHtml(o.seller_name)}<div style="color:var(--muted);font-size:.75rem">${escapeHtml(o.pickup_city)}</div></td>
          <td class="amount">${money(o.quoted_amount)}</td>
          <td>${statusChip(o.status)}</td>
          <td style="color:var(--muted);font-size:.75rem">${escapeHtml(o.driver_name || '—')}</td>
          <td><button class="btn btn-ghost btn-sm" type="button" data-open="${o.id}">View</button></td>
        `;
        tr.addEventListener('click', (e) => { if (e.target.closest('button')) return; showDetail(o.id); });
        tr.querySelector('[data-open]').addEventListener('click', () => showDetail(o.id));
        body.appendChild(tr);
      }
    } catch (e) { console.warn('loadOrders', e); }
  }

  // ── order detail ──────────────────────────────────────────────────────────
  async function showDetail(id) {
    selectedId = id;
    const panel = $('#detail-panel');
    if (panel) panel.style.display = '';
    try {
      const { order, events } = await API.order(id);
      $('#detail-status').innerHTML = statusChip(order.status);
      const specs    = order.expected_specs  || {};
      const verified = order.verified_specs  || {};
      const checklist = order.door_checklist || {};
      const partnerStatuses = ['pending','assigned','en_route','picked_up','verifying','verified','mismatch','paid','shipped','in_transit','delivered','cancelled'];
      const statusOpts = partnerStatuses.map((s) => `<option value="${s}" ${s === order.status ? 'selected' : ''}>${s}</option>`).join('');
      const actions = [];
      if (order.status === 'verified' && !order.paid)
        actions.push(`<button class="btn btn-accent btn-sm" type="button" id="act-pay">Release same-day pay</button>`);
      if (['pending','assigned'].includes(order.status))
        actions.push(`<button class="btn btn-soft btn-sm" type="button" id="act-assign">Assign driver</button>`);
      if (!['delivered','cancelled'].includes(order.status))
        actions.push(`<button class="btn btn-ghost btn-sm" type="button" id="act-cancel">Cancel</button>`);

      const crossCoopSection = order.cross_coop ? `
        <div class="card" style="padding:.65rem;box-shadow:none;border-left:3px solid var(--brand)">
          <div class="text-sm mb-1"><strong>Cross-coop order</strong> <span class="chip chip-brand" style="font-size:.65rem">Coop R</span></div>
          <div class="text-sm"><strong>Territory coop:</strong> ${escapeHtml(order.pickup_coop_slug || '—')}</div>
          <div class="text-sm"><strong>Accepted:</strong> ${order.pickup_coop_accepted_at ? fmtWhen(order.pickup_coop_accepted_at) : '<span style="color:var(--warn)">Awaiting acceptance</span>'}</div>
          ${!order.pickup_coop_accepted_at ? `<button class="btn btn-soft btn-sm mt-1" type="button" id="act-notify-coop">Notify Coop R →</button>` : ''}
        </div>` : '';

      $('#detail-body').innerHTML = `
        <div class="stack">
          <div class="row between">
            <div><strong>${escapeHtml(order.device_brand)} ${escapeHtml(order.device_model)}</strong>
              <div class="text-sm text-muted mono">${escapeHtml(order.external_ref || order.id)}</div>
            </div>
            <div class="amount">${money(order.quoted_amount)}</div>
          </div>
          ${crossCoopSection}
          <div class="text-sm">
            <div><strong>Seller:</strong> ${escapeHtml(order.seller_name)} · ${escapeHtml(order.seller_phone)}</div>
            <div><strong>Pickup:</strong> ${escapeHtml(order.pickup_address)}, ${escapeHtml(order.pickup_city)} ${escapeHtml(order.pickup_zip)}</div>
            <div><strong>Driver:</strong> ${escapeHtml(order.driver_name || 'Unassigned')} ${order.driver_code ? '(' + escapeHtml(order.driver_code) + ')' : ''}</div>
            <div><strong>IMEI:</strong> <span class="mono">${escapeHtml(order.imei || '—')}</span></div>
            <div><strong>Packed:</strong> ${order.packed ? 'Yes' : 'No'} · <strong>Paid:</strong> ${order.paid ? 'Yes @ ' + fmtWhen(order.paid_at) : 'No'}</div>
          </div>
          <div class="card" style="padding:.65rem;box-shadow:none">
            <div class="text-sm mb-1"><strong>Update status</strong></div>
            <div class="row" style="align-items:stretch">
              <select id="act-status" style="flex:1;min-height:40px;border:1px solid var(--line);border-radius:8px;padding:.4rem">${statusOpts}</select>
              <button class="btn btn-primary btn-sm" type="button" id="act-status-save">Save</button>
            </div>
          </div>
          <div class="card" style="padding:.65rem;box-shadow:none">
            <div class="text-sm mb-1"><strong>Carrier tracking</strong></div>
            <div class="form-grid" style="gap:.4rem">
              <label class="field">Carrier
                <select id="trk-carrier">${['','UPS','FedEx','USPS','DHL','Other'].map((c) => `<option value="${c}" ${String(order.tracking_carrier||'')===c?'selected':''}>${c||'Select…'}</option>`).join('')}</select>
              </label>
              <label class="field">Tracking #
                <input id="trk-number" class="mono" value="${escapeHtml(order.tracking_number||'')}" placeholder="1Z…" />
              </label>
              <label class="field full">Tracking URL (optional)
                <input id="trk-url" value="${escapeHtml(order.tracking_url||'')}" placeholder="https://…" />
              </label>
            </div>
            <div class="row mt-1">
              <button class="btn btn-soft btn-sm" type="button" id="act-tracking">Save tracking</button>
              <label class="text-sm" style="display:flex;align-items:center;gap:.35rem"><input type="checkbox" id="trk-shipped" /> Mark shipped</label>
              ${order.tracking_url ? `<a class="btn btn-ghost btn-sm" href="${escapeHtml(order.tracking_url)}" target="_blank" rel="noopener">Track →</a>` : ''}
            </div>
          </div>
          <div class="card" style="padding:.65rem;box-shadow:none">
            <div class="text-sm mb-1"><strong>Dispatch</strong> <span class="text-muted">Roadie · Shipt · fleet · webhook</span></div>
            <div class="text-sm mb-1">Provider: <strong>${escapeHtml(order.dispatch_provider||'—')}</strong> · ${statusChip(order.dispatch_status||'none')}</div>
            <div class="row">
              <select id="dsp-provider" style="flex:1;min-height:40px;border:1px solid var(--line);border-radius:8px;padding:.4rem">
                <option value="roadie">Roadie</option>
                <option value="shipt">Shipt</option>
                <option value="manual">Manual / own fleet</option>
                <option value="custom_webhook">Custom webhook</option>
              </select>
              <button class="btn btn-soft btn-sm" type="button" id="act-dispatch">Send</button>
            </div>
          </div>
          <div>
            <div class="text-sm"><strong>Door checklist</strong> <span class="chip chip-brand">Partner-owned</span></div>
            <pre class="mono text-sm" style="margin:.25rem 0 0;white-space:pre-wrap;background:var(--canvas);padding:.5rem;border-radius:6px">${escapeHtml(JSON.stringify(checklist,null,2))}</pre>
          </div>
          ${order.verified_specs ? `<div>
            <div class="text-sm"><strong>Door result</strong> ${order.verification_match ? statusChip('verified') : statusChip('mismatch')}</div>
            <pre class="mono text-sm" style="margin:.25rem 0 0;white-space:pre-wrap;background:var(--canvas);padding:.5rem;border-radius:6px">${escapeHtml(JSON.stringify(verified,null,2))}</pre>
          </div>` : ''}
          <div class="row">${actions.join('')}</div>
          <div>
            <div class="text-sm mb-1"><strong>Event log</strong></div>
            <div class="timeline">${(events||[]).map((ev) => `<div class="ev"><div class="dot"></div><div><strong>${escapeHtml(ev.event)}</strong><span>${fmtWhen(ev.created_at)} · ${escapeHtml(ev.actor_type||'system')}</span></div></div>`).join('')}</div>
          </div>
        </div>
      `;

      $('#act-status-save')?.addEventListener('click', async () => {
        try { await API.updateStatus(order.id, $('#act-status').value); await refreshAll(); await showDetail(order.id); }
        catch (err) { toast(err.message, 'error'); }
      });
      $('#act-tracking')?.addEventListener('click', async () => {
        try {
          await API.updateTracking(order.id, {
            tracking_carrier: $('#trk-carrier').value || null,
            tracking_number:  $('#trk-number').value  || null,
            tracking_url:     $('#trk-url').value     || null,
            mark_shipped:     $('#trk-shipped').checked,
          });
          await refreshAll(); await showDetail(order.id);
        } catch (err) { toast(err.message, 'error'); }
      });
      $('#act-dispatch')?.addEventListener('click', async () => {
        try {
          const res = await API.dispatchOrder(order.id, { provider: $('#dsp-provider').value });
          toast(res.message || 'Dispatched', 'success');
          await refreshAll(); await showDetail(order.id);
        } catch (err) { toast(err.message, 'error'); }
      });
      $('#act-pay')?.addEventListener('click', async () => {
        if (!confirm('Release same-day payment to seller?')) return;
        try { await API.releasePayment(order.id); await refreshAll(); await showDetail(order.id); }
        catch (err) { toast(err.message, 'error'); }
      });
      $('#act-cancel')?.addEventListener('click', async () => {
        const reason = prompt('Cancel reason?', 'Cancelled by partner') || 'Cancelled by partner';
        try { await API.cancelOrder(order.id, reason); await refreshAll(); }
        catch (err) { toast(err.message, 'error'); }
      });
      $('#act-assign')?.addEventListener('click', () => openAssign(order.id));
      $('#act-notify-coop')?.addEventListener('click', async () => {
        try {
          const res = await API.coopNotifyOrder(order.id);
          toast(res.message || 'Coop R notified', 'success');
        } catch (err) { toast(err.message, 'error'); }
      });

      loadOrders().catch(() => {});
    } catch (e) { console.warn('showDetail', e); }
  }

  // ── drivers list ──────────────────────────────────────────────────────────
  async function loadDrivers() {
    try {
      const { drivers } = await API.partnerDrivers();
      driversCache = drivers;
      const body = $('#drivers-body');
      if (!body) return;
      body.innerHTML = drivers.map((d) => `
        <tr>
          <td><strong>${escapeHtml(d.name)}</strong><div style="color:var(--muted);font-size:.75rem">${escapeHtml(d.phone||'')}</div></td>
          <td>${(d.zones||[]).map((z) => `<span class="chip">${escapeHtml(z)}</span>`).join(' ')}</td>
          <td>${escapeHtml(d.vehicle||'—')}</td>
          <td class="mono" style="font-size:.75rem">${escapeHtml(d.driver_code||'—')}</td>
          <td>${d.rating}</td>
          <td>${statusChip(d.status)}</td>
        </tr>`).join('');
    } catch (e) { console.warn('loadDrivers', e); }
  }

  // ── assign modal ──────────────────────────────────────────────────────────
  function openAssign(orderId) {
    $('#assign-order-id').value = orderId;
    const sel = $('#assign-driver');
    sel.innerHTML = driversCache.map((d) => `<option value="${d.id}">${escapeHtml(d.name)} · ${escapeHtml(d.status)} · ${(d.zones||[]).join(', ')}</option>`).join('');
    $('#assign-modal').classList.add('open');
  }

  // ── Network view (cross-coop + incoming) ──────────────────────────────────
  async function loadNetworkView() {
    await Promise.all([loadIncoming(), loadCoopNetwork()]);
  }

  async function loadIncoming() {
    const body = $('#incoming-body');
    const count = $('#incoming-count');
    if (!body) return;
    try {
      const { incoming_orders, total } = await API.coopIncoming();
      if (count) count.textContent = total + ' incoming';
      body.innerHTML = '';
      if (!total) {
        body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--muted)">No cross-coop orders in your territory.</td></tr>`;
        return;
      }
      for (const o of incoming_orders) {
        const accepted = !!o.pickup_coop_accepted_at;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="mono" style="font-size:.75rem">${escapeHtml(o.external_ref || o.id.slice(0,8))}</td>
          <td><strong>${escapeHtml(o.device_brand)} ${escapeHtml(o.device_model)}</strong><div style="color:var(--muted);font-size:.75rem">${escapeHtml(o.device_condition)}</div></td>
          <td>${escapeHtml(o.pickup_city)}<div style="color:var(--muted);font-size:.75rem">${escapeHtml(o.pickup_zip)}</div></td>
          <td class="amount">${money(o.quoted_amount)}</td>
          <td>${statusChip(o.status)}</td>
          <td>
            ${!accepted
              ? `<button class="btn btn-primary btn-sm" type="button" data-accept="${o.id}">Accept →</button>`
              : `<span class="chip chip-good" style="font-size:.7rem">Accepted ${fmtWhen(o.pickup_coop_accepted_at)}</span>`}
          </td>
        `;
        tr.querySelector('[data-accept]')?.addEventListener('click', async (e) => {
          const btn = e.target;
          btn.disabled = true;
          btn.textContent = 'Accepting…';
          try {
            const res = await API.coopAcceptOrder(o.id);
            toast(res.message || 'Order accepted', 'success');
            await loadIncoming();
          } catch (err) { toast(err.message, 'error'); btn.disabled = false; btn.textContent = 'Accept →'; }
        });
        body.appendChild(tr);
      }
    } catch (e) { console.warn('loadIncoming', e); }
  }

  async function loadCoopNetwork() {
    const body = $('#network-coops-body');
    if (!body) return;
    try {
      const { coops, count } = await API.coopNetwork();
      body.innerHTML = coops.map((c) => `
        <tr>
          <td><strong>${escapeHtml(c.name)}</strong><div style="color:var(--muted);font-size:.75rem">${escapeHtml(c.slug)}</div></td>
          <td>${escapeHtml(c.market||'—')}</td>
          <td>${(c.cities||[]).slice(0,4).map(escapeHtml).join(', ')}${(c.cities||[]).length > 4 ? '…' : ''}</td>
          <td>${(c.zip_codes||[]).length} ZIPs</td>
          <td>${c.driver_count != null ? c.driver_count : '—'} drivers</td>
        </tr>`).join('') || `<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:var(--muted)">No coops in network yet.</td></tr>`;
    } catch (e) { console.warn('loadCoopNetwork', e); }
  }

  // ── economics calculator ──────────────────────────────────────────────────
  const PLANS = {
    starter: { name: 'Starter', monthly: 99,  included: 200,   overage: 0.25 },
    growth:  { name: 'Growth',  monthly: 249, included: 1500,  overage: 0.15 },
    network: { name: 'Network', monthly: 699, included: 10000, overage: 0.08 },
  };

  function num(id, fallback = 0) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const v = Number(el.value);
    return Number.isFinite(v) ? v : fallback;
  }

  function runEconomics() {
    if (!$('#econ-form')) return;
    const planKey = ($('#econ-plan') && $('#econ-plan').value) || 'growth';
    const plan    = PLANS[planKey] || PLANS.growth;
    const orders      = Math.max(0, num('econ-pickups', 0));
    const avgQuote    = Math.max(0, num('econ-quote', 0));
    const marginPct   = Math.min(100, Math.max(0, num('econ-margin', 0))) / 100;
    const baseline    = Math.max(0, num('econ-baseline', 0));
    const liftPct     = Math.min(100, Math.max(0, num('econ-lift', 0))) / 100;
    const mismatchPct = Math.min(100, Math.max(0, num('econ-mismatch', 0))) / 100;
    const overageUnits = Math.max(0, orders - plan.included);
    const overage     = overageUnits * plan.overage;
    const saasFee     = plan.monthly + overage;
    const cpp         = orders > 0 ? saasFee / orders : plan.monthly;
    const extraCloses = baseline * liftPct;
    const incrementalGp = extraCloses * avgQuote * marginPct * (1 - mismatchPct);
    const net = incrementalGp - saasFee;

    if ($('#econ-cost'))    $('#econ-cost').textContent     = money(saasFee);
    if ($('#econ-cost-sub')) $('#econ-cost-sub').textContent = plan.name + ' $' + plan.monthly + '/mo + overage ' + money(overage);
    if ($('#econ-cpp'))     $('#econ-cpp').textContent      = money(Math.round(cpp));
    if ($('#econ-extra'))   $('#econ-extra').textContent    = extraCloses.toFixed(1);
    if ($('#econ-net')) {
      $('#econ-net').textContent = money(Math.round(net));
      $('#econ-net-sub') && ($('#econ-net-sub').textContent = net >= 0 ? 'Positive ROI on SaaS' : 'SaaS exceeds modeled lift');
      $('#econ-net').style.color = net >= 0 ? 'var(--good)' : 'var(--bad)';
    }
    if ($('#econ-roi-body')) {
      $('#econ-roi-body').innerHTML = [
        row('Model', 'Pure SaaS subscription'),
        row('Plan', plan.name),
        row('Subscription / mo', money(plan.monthly)),
        row('Included orders', String(plan.included)),
        row('Orders this month', String(orders)),
        row('Overage', money(overage), overageUnits + ' × $' + plan.overage),
        row('Total SaaS cost / mo', money(Math.round(saasFee))),
        row('Your driver/logistics cost', 'You own this'),
        row('Incremental GP from same-day tools', money(Math.round(incrementalGp))),
        row('Net after SaaS', money(Math.round(net))),
      ].join('');
    }
    if ($('#econ-verdict')) {
      $('#econ-verdict').textContent = net >= 0
        ? 'SaaS can pay for itself if same-day tooling lifts closes ~' + (liftPct * 100).toFixed(0) + '% on baseline.'
        : 'At these lift assumptions the subscription costs more than incremental GP.';
      $('#econ-verdict').style.color = net >= 0 ? 'var(--good)' : 'var(--bad)';
    }
  }

  // ── integrations ──────────────────────────────────────────────────────────
  async function loadIntegrations() {
    const el = $('#integrations-list');
    if (!el) return;
    try {
      const { integrations, note } = await API.integrations();
      el.innerHTML = `<p class="text-sm text-muted">${escapeHtml(note||'')}</p>` +
        integrations.map((p) => {
          const badge = p.status === 'available' ? '<span class="chip chip-good">Available</span>' : '<span class="chip chip-warn">Planned</span>';
          const conn  = p.connected ? `<span class="chip chip-brand">Connected${p.connection && p.connection.default ? ' · default' : ''}</span>` : '<span class="chip">Not connected</span>';
          return `<article class="card">
            <div class="row between mb-1"><h3 style="margin:0">${escapeHtml(p.name)}</h3><div class="row">${badge}${conn}</div></div>
            <p class="text-sm text-muted">${escapeHtml(p.description)}</p>
            <p class="text-sm mt-1">Supports: ${(p.supports||[]).map(escapeHtml).join(', ')}</p>
            <div class="row mt-1">
              ${p.status === 'available'
                ? `<button type="button" class="btn btn-primary btn-sm" data-connect="${p.id}">${p.connected ? 'Update' : 'Connect'}</button>`
                : `<button type="button" class="btn btn-ghost btn-sm" disabled>Coming soon</button>`}
              ${p.docs_url ? `<a class="btn btn-ghost btn-sm" href="${escapeHtml(p.docs_url)}" target="_blank" rel="noopener">Docs</a>` : ''}
            </div>
          </article>`;
        }).join('');
      el.querySelectorAll('[data-connect]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const provider   = btn.getAttribute('data-connect');
          const api_key    = provider === 'manual' ? '' : (prompt('API key / token:', 'demo-key') || 'demo-key');
          const is_default = confirm('Set as default dispatch provider?');
          try {
            await fetch(`/api/orders/partner/integrations/${provider}/connect`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API.getToken() },
              body: JSON.stringify({ api_key: api_key || null, is_default, external_account: provider + '-account' }),
            });
            await loadIntegrations();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
    } catch (err) { el.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`; }
  }

  // ── view router ───────────────────────────────────────────────────────────
  const VIEW_TITLES = {
    orders:       'Orders',
    create:       'New pickup',
    drivers:      'Driver network',
    network:      'Coop network',
    api:          'API access',
    economics:    'Pricing & unit economics',
    integrations: 'Driver platform integrations',
  };

  function setView(name) {
    $$('.side-nav a[data-view]').forEach((a) => a.classList.toggle('active', a.dataset.view === name));
    ['orders','create','drivers','network','api','economics','integrations'].forEach((v) => {
      const el = document.getElementById('view-' + v);
      if (el) el.classList.toggle('hidden', v !== name);
    });
    if ($('#view-title')) $('#view-title').textContent = VIEW_TITLES[name] || 'Dashboard';
    const detailPanel = $('#detail-panel');

    if (name === 'orders')      { if (detailPanel) detailPanel.style.display = selectedId ? '' : 'none'; }
    if (name !== 'orders')      { if (detailPanel) detailPanel.style.display = 'none'; }
    if (name === 'drivers')      loadDrivers();
    if (name === 'network')      loadNetworkView();
    if (name === 'api')          { const u = getUser(); if (u && u.api_key && $('#api-key')) $('#api-key').value = u.api_key; }
    if (name === 'economics')    { runEconomics(); loadEconomicsLive(); }
    if (name === 'integrations') loadIntegrations();
    if ($('#profit-panel'))  $('#profit-panel').classList.toggle('hidden', ['create','api','integrations'].includes(name));
    if ($('#stats-row'))     $('#stats-row').classList.toggle('hidden', ['economics','create','api','integrations'].includes(name));
  }

  // ── event wiring ──────────────────────────────────────────────────────────
  $('#login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd    = new FormData(e.target);
    const alertEl = $('#login-alert');
    try {
      const res = await API.loginPartner(fd.get('email'), fd.get('password'));
      setSession('partner', res.token, res.partner);
      showApp();
      await hydrateCoop();
      await refreshAll();
    } catch (err) {
      if (alertEl) { alertEl.className = 'alert alert-error'; alertEl.textContent = err.message; alertEl.classList.remove('hidden'); }
    }
  });

  $('#btn-logout')?.addEventListener('click', () => { clearSession(); showLogin(); });

  $$('.side-nav a[data-view]').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); setView(a.dataset.view); });
  });

  $('#btn-new-pickup')?.addEventListener('click', () => setView('create'));
  $('#btn-refresh')?.addEventListener('click', () => refreshAll());
  $('#btn-filter')?.addEventListener('click', () => loadOrders());
  $('#q')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadOrders(); });

  $('#create-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    body.quoted_amount = Number(body.quoted_amount);
    body.expected_specs = {
      brand: body.device_brand, model: body.device_model, storage: body.device_storage,
      color: body.device_color, condition: body.device_condition, powers_on: true,
      screen_cracks: body.device_condition === 'Poor', account_locked: false,
    };
    const alertEl = $('#create-alert');
    try {
      const { order } = await API.createOrder(body);
      if (alertEl) { alertEl.className = 'alert alert-ok'; alertEl.textContent = 'Order created: ' + (order.external_ref || order.id); alertEl.classList.remove('hidden'); }
      e.target.reset();
      setView('orders');
      selectedId = order.id;
      await refreshAll();
    } catch (err) {
      if (alertEl) { alertEl.className = 'alert alert-error'; alertEl.textContent = err.message; alertEl.classList.remove('hidden'); }
    }
  });

  $('#btn-copy-key')?.addEventListener('click', async () => {
    const v = $('#api-key') && $('#api-key').value;
    if (!v) return;
    await navigator.clipboard.writeText(v);
    $('#btn-copy-key').textContent = 'Copied';
    setTimeout(() => ($('#btn-copy-key').textContent = 'Copy key'), 1200);
  });

  $$('#assign-modal [data-close]').forEach((b) => b.addEventListener('click', () => $('#assign-modal').classList.remove('open')));
  $('#btn-assign-confirm')?.addEventListener('click', async () => {
    const orderId  = $('#assign-order-id').value;
    const driverId = $('#assign-driver').value;
    try {
      await API.assignDriver(orderId, driverId);
      $('#assign-modal').classList.remove('open');
      await refreshAll();
    } catch (err) { toast(err.message, 'error'); }
  });

  if ($('#econ-form')) {
    $('#econ-form').addEventListener('input',  runEconomics);
    $('#econ-form').addEventListener('change', runEconomics);
  }
  $('#btn-econ-refresh')?.addEventListener('click', () => loadEconomicsLive());

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href="#economics"]');
    if (a) { e.preventDefault(); setView('economics'); location.hash = 'economics'; }
  });

  function routeHash() {
    const h = (location.hash || '').replace(/^#/, '');
    if (h === 'economics' && API.getToken()) setView('economics');
    if (h === 'network'   && API.getToken()) setView('network');
  }
  window.addEventListener('hashchange', routeHash);

  bootstrap().then(() => routeHash());
})();
