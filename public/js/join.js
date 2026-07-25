/* join.js — OddCoop network onboarding page */
(function () {
  const zipSet = new Set();

  // ── load network summary ──────────────────────────────────────────────────
  async function loadNetwork() {
    try {
      const res = await fetch('/api/coop/network');
      const { coops } = await res.json();

      const totalDrivers = coops.reduce((s, c) => s + (c.driver_count || 0), 0);
      const totalZips    = coops.reduce((s, c) => s + (c.zip_codes  || []).length, 0);
      const totalCities  = coops.reduce((s, c) => s + (c.cities    || []).length, 0);

      setText('stat-coops',   coops.length);
      setText('stat-drivers', totalDrivers);
      setText('stat-zips',    totalZips);
      setText('stat-cities',  totalCities);

      const list = document.getElementById('coop-list');
      if (!coops.length) { list.innerHTML = '<p style="color:#999;font-size:14px">No coops registered yet — be the first!</p>'; return; }
      list.innerHTML = coops.map((c) => `
        <div class="coop-card">
          <div class="coop-icon" style="background:${c.color || '#2d8b8b'}">${c.logo_letter || c.name[0]}</div>
          <div class="coop-info">
            <div class="cn">${esc(c.name)}</div>
            <div class="cm">${esc(c.market || '')} &mdash; ${(c.cities || []).slice(0,4).map(esc).join(', ')}${c.cities && c.cities.length > 4 ? ` +${c.cities.length - 4} more` : ''}</div>
          </div>
          <span class="coop-badge">${c.driver_count || 0} driver${c.driver_count !== 1 ? 's' : ''} &bull; ${(c.zip_codes || []).length} ZIPs</span>
        </div>
      `).join('');
    } catch (e) {
      console.error('Failed to load network:', e);
    }
  }

  // ── ZIP tag input ─────────────────────────────────────────────────────────
  const zipInput = document.getElementById('f-zip-input');
  zipInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addZip(zipInput.value.trim().replace(',', ''));
      zipInput.value = '';
    }
  });
  zipInput.addEventListener('blur', () => {
    const v = zipInput.value.trim();
    if (v) { addZip(v); zipInput.value = ''; }
  });

  function addZip(zip) {
    zip = zip.replace(/[^0-9]/g, '');
    if (zip.length !== 5 || zipSet.has(zip)) return;
    zipSet.add(zip);
    renderZips();
  }

  function renderZips() {
    const container = document.getElementById('zip-tags');
    container.innerHTML = [...zipSet].map((z) => `
      <span class="zip-tag">${z}<button type="button" onclick="removeZip('${z}')">×</button></span>
    `).join('');
    document.getElementById('f-zip-codes').value = JSON.stringify([...zipSet]);
  }

  window.removeZip = function (zip) { zipSet.delete(zip); renderZips(); };

  // ── form submit ───────────────────────────────────────────────────────────
  document.getElementById('join-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    const alert = document.getElementById('alert');
    alert.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Registering...';

    const cities = document.getElementById('f-cities').value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const body = {
      name:          document.getElementById('f-name').value.trim(),
      contact_name:  document.getElementById('f-contact').value.trim(),
      contact_email: document.getElementById('f-email').value.trim(),
      contact_phone: document.getElementById('f-phone').value.trim() || undefined,
      market:        document.getElementById('f-market').value.trim() || undefined,
      corridor:      document.getElementById('f-corridor').value.trim() || undefined,
      color:         document.getElementById('f-color').value.trim() || undefined,
      website:       document.getElementById('f-website').value.trim() || undefined,
      zip_codes:     [...zipSet],
      cities,
    };

    if (!body.zip_codes.length) {
      showAlert('error', 'Please add at least one ZIP code for your territory.');
      btn.disabled = false;
      btn.textContent = 'Join the network →';
      return;
    }

    try {
      const res = await fetch('/api/coop/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showAlert('error', data.error || 'Registration failed.');
        btn.disabled = false;
        btn.textContent = 'Join the network →';
        return;
      }
      showAlert('success',
        `🎉 Welcome, ${esc(data.coop.name)}! You're now part of a ${data.network_size}-coop network. ` +
        `${esc(data.benefit)}`
      );
      document.getElementById('join-form').reset();
      zipSet.clear();
      renderZips();
      btn.textContent = 'Joined ✓';
      loadNetwork();
    } catch (err) {
      showAlert('error', 'Network error — check your connection.');
      btn.disabled = false;
      btn.textContent = 'Join the network →';
    }
  });

  function showAlert(type, msg) {
    const el = document.getElementById('alert');
    el.className = 'alert ' + type;
    el.innerHTML = msg;
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  loadNetwork();
})();
