/* OddCoop — site.js: theme toggle, nav, shared utilities */

/* ── Theme ──────────────────────────────────────────── */
(function () {
  const root = document.documentElement;
  // Default: dark. Use stored pref or system.
  const stored = null; // localStorage blocked in sandboxed iframes — use in-memory
  let theme = window._ocTheme ||
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  root.setAttribute('data-theme', theme);
  window._ocTheme = theme;

  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('[data-theme-toggle]');
    if (!toggle) return;
    updateToggleIcon(toggle, theme);
    toggle.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', theme);
      window._ocTheme = theme;
      updateToggleIcon(toggle, theme);
    });
  });

  function updateToggleIcon(btn, t) {
    btn.setAttribute('aria-label', 'Switch to ' + (t === 'dark' ? 'light' : 'dark') + ' mode');
    btn.innerHTML = t === 'dark'
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }
})();

/* ── Mobile nav toggle ──────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const btn   = document.getElementById('nav-toggle');
  const panel = document.getElementById('nav-panel');
  if (btn && panel) {
    btn.addEventListener('click', () => panel.classList.toggle('open'));
  }

  // App sidebar toggle
  const menuBtn  = document.getElementById('app-menu-btn');
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay && overlay.classList.toggle('open');
    });
    overlay && overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  }

  // Year in footer
  const yr = document.getElementById('y');
  if (yr) yr.textContent = new Date().getFullYear();
});

/* ── OC SVG Logo ─────────────────────────────────────── */
// Returns the OC mark SVG string — call renderLogo() to inject
window.OC = window.OC || {};
OC.logoSVG = `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="OddCoop" role="img">
  <rect width="40" height="40" rx="10" fill="#01696f"/>
  <!-- Hexagonal OC mark: two interlocking cells -->
  <text x="20" y="27" text-anchor="middle" fill="white"
    font-family="'DM Sans', system-ui, sans-serif"
    font-size="17" font-weight="700" letter-spacing="-1">OC</text>
  <!-- Cooperative accent mark -->
  <path d="M12 8 L16 11 L12 14" stroke="rgba(255,255,255,0.4)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M28 8 L24 11 L28 14" stroke="rgba(255,255,255,0.4)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;

OC.renderLogos = function () {
  document.querySelectorAll('.oc-mark').forEach(el => {
    el.innerHTML = OC.logoSVG;
  });
};

document.addEventListener('DOMContentLoaded', OC.renderLogos);

/* ── Toast notifications ─────────────────────────────── */
OC.toast = function (title, body, duration = 5000) {
  let stack = document.getElementById('toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'toast-stack';
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `
    <div class="toast-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    </div>
    <div>
      <div class="toast-title">${title}</div>
      ${body ? `<div class="toast-body">${body}</div>` : ''}
    </div>
  `;
  stack.appendChild(t);
  setTimeout(() => {
    t.classList.add('removing');
    t.addEventListener('animationend', () => t.remove(), { once: true });
  }, duration);
};

/* ── Ding-dong WebSocket listener ───────────────────── */
// Called from dashboard/coop-r pages to wire up WS pings
OC.connectWS = function (partnerId, onOrder) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'subscribe', partner_id: partnerId }));
  };
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'coopR_new_order' || msg.type === 'order_update') {
        if (typeof onOrder === 'function') onOrder(msg);
      }
    } catch (_e) { /* ignore malformed WS frames */ }
  };
  ws.onclose = () => {
    // Reconnect after 3s
    setTimeout(() => OC.connectWS(partnerId, onOrder), 3000);
  };
  return ws;
};

/* ── Countdown clock ─────────────────────────────────── */
// OC.startCountdown(el, isoDeadline) — updates el every second
OC.startCountdown = function (el, deadline) {
  if (!el) return;
  const end = new Date(deadline).getTime();
  function tick() {
    const diff = end - Date.now();
    if (diff <= 0) {
      el.textContent = 'EXPIRED';
      el.classList.add('urgent');
      return;
    }
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    if (diff < 300000) el.classList.add('urgent'); // < 5 min
    else el.classList.remove('urgent');
  }
  tick();
  return setInterval(tick, 1000);
};

/* ── Signature pad ───────────────────────────────────── */
OC.initSignaturePad = function (canvas) {
  if (!canvas) return { getDataURL: () => null, clear: () => {} };
  const ctx = canvas.getContext('2d');
  let drawing = false, points = [];

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#e8eaed';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
  resize();
  window.addEventListener('resize', resize);

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  }

  canvas.addEventListener('mousedown',  e => { drawing=true; const p=pos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); points=[p]; });
  canvas.addEventListener('mousemove',  e => { if (!drawing) return; const p=pos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); points.push(p); });
  canvas.addEventListener('mouseup',    () => { drawing=false; });
  canvas.addEventListener('touchstart', e => { e.preventDefault(); drawing=true; const p=pos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); points=[p]; }, {passive:false});
  canvas.addEventListener('touchmove',  e => { e.preventDefault(); if (!drawing) return; const p=pos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); points.push(p); }, {passive:false});
  canvas.addEventListener('touchend',   () => { drawing=false; });

  return {
    getDataURL: () => points.length > 3 ? canvas.toDataURL() : null,
    clear: () => { ctx.clearRect(0, 0, canvas.width, canvas.height); points=[]; },
    hasSignature: () => points.length > 3
  };
};

/* ── Utility helpers ─────────────────────────────────── */
OC.fmt = {
  money:  v => '$' + Number(v||0).toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:0}),
  date:   v => v ? new Date(v).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'}) : '—',
  time:   v => v ? new Date(v).toLocaleTimeString('en-US', {hour:'numeric',minute:'2-digit'}) : '—',
  status: s => s ? s.replace(/_/g,' ').replace(/\b\w/g, c=>c.toUpperCase()) : '—',
  id:     v => v ? String(v).slice(-6).toUpperCase() : '—',
};

OC.showAlert = function (el, msg, type='bad') {
  if (!el) return;
  el.textContent = msg;
  el.className = `alert alert-${type}`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 6000);
};
