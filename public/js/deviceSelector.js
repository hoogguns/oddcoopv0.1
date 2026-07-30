/* deviceSelector.js — cascading brand → model → storage → carrier → color.
 * Fetches the device catalog from /api/v1/devices on init.
 * Exposes window.DeviceSelector for use by quote.js.
 */
window.DeviceSelector = (function () {

  var catalog = [];

  /**
   * Initialise the selector module. Fetches the catalog and wires up
   * the four <select> elements. Returns a Promise that resolves when ready.
   *
   * @param {object} els  — { brand, model, storage, carrier, color }
   * @param {Function} onChange  — called whenever any selector changes
   * @returns {Promise<void>}
   */
  function init(els, onChange) {
    return fetch('/api/v1/devices')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        catalog = data.catalog || [];
        populateBrands(els.brand);
        wire(els, onChange);
      });
  }

  /* ── populate ─────────────────────────────────────────────────────── */

  function populateBrands(sel) {
    sel.innerHTML = '<option value="">Select brand…</option>';
    catalog.forEach(function (b) {
      var opt = document.createElement('option');
      opt.value = b.brand;
      opt.textContent = b.brand;
      sel.appendChild(opt);
    });
  }

  function populateModels(brandName, sel) {
    sel.innerHTML = '<option value="">Select model…</option>';
    sel.disabled = !brandName;
    if (!brandName) return null;
    var entry = catalog.find(function (b) { return b.brand === brandName; });
    if (!entry) return null;
    entry.models.forEach(function (m) {
      var opt = document.createElement('option');
      opt.value = m.model;
      opt.textContent = m.model;
      sel.appendChild(opt);
    });
    return entry;
  }

  function populateStorage(brandName, modelName, sel) {
    sel.innerHTML = '<option value="">Select storage…</option>';
    sel.disabled = !modelName;
    if (!modelName) return null;
    var entry = catalog.find(function (b) { return b.brand === brandName; });
    if (!entry) return null;
    var model = entry.models.find(function (m) { return m.model === modelName; });
    if (!model) return null;
    model.storageOptions.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      sel.appendChild(opt);
    });
    return model;
  }

  function populateCarrier(brandName, modelName, sel) {
    sel.innerHTML = '<option value="">Select carrier…</option>';
    sel.disabled = !modelName;
    if (!modelName) return;
    var entry = catalog.find(function (b) { return b.brand === brandName; });
    var model = entry && entry.models.find(function (m) { return m.model === modelName; });
    if (!model) return;
    model.carriers.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });
    // Default to Unlocked
    sel.value = 'Unlocked';
  }

  function populateColor(brandName, modelName, sel) {
    sel.innerHTML = '<option value="">Select color (optional)…</option>';
    sel.disabled = !modelName;
    if (!modelName) return;
    var entry = catalog.find(function (b) { return b.brand === brandName; });
    var model = entry && entry.models.find(function (m) { return m.model === modelName; });
    if (!model) return;
    model.colors.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });
  }

  function getBaseValue(brandName, modelName) {
    var entry = catalog.find(function (b) { return b.brand === brandName; });
    var model = entry && entry.models.find(function (m) { return m.model === modelName; });
    return model ? model.baseMarketValue : 0;
  }

  /* ── wiring ───────────────────────────────────────────────────────── */

  function wire(els, onChange) {
    els.brand.addEventListener('change', function () {
      var brand = els.brand.value;
      populateModels(brand, els.model);
      populateStorage(null, null, els.storage);
      populateCarrier(null, null, els.carrier);
      populateColor(null, null, els.color);
      notify(els, onChange);
    });

    els.model.addEventListener('change', function () {
      var brand = els.brand.value;
      var model = els.model.value;
      populateStorage(brand, model, els.storage);
      populateCarrier(brand, model, els.carrier);
      populateColor(brand, model, els.color);
      // Default first storage
      if (els.storage.options.length > 1) {
        els.storage.selectedIndex = 1;
      }
      notify(els, onChange);
    });

    els.storage.addEventListener('change', function () { notify(els, onChange); });
    els.carrier.addEventListener('change', function () { notify(els, onChange); });
    els.color.addEventListener('change',   function () { notify(els, onChange); });
  }

  function notify(els, onChange) {
    if (typeof onChange !== 'function') return;
    var brand = els.brand.value;
    var model = els.model.value;
    onChange({
      brand:    brand,
      model:    model,
      storage:  els.storage.value,
      carrier:  els.carrier.value,
      color:    els.color.value,
      baseMarketValue: getBaseValue(brand, model),
      complete: !!(brand && model && els.storage.value && els.carrier.value),
    });
  }

  return { init: init };

})();
