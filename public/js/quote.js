/* quote.js — quote flow controller.
 *
 * Manages a 5-step flow:
 *   1. Device Selection  (brand / model / storage / carrier / color)
 *   2. Condition         (guided questionnaire → grade)
 *   3. Your Offers       (Standard vs Same-Day side-by-side)
 *   4. Your Information  (name, phone, email, address, ZIP)
 *   5. Confirm & Submit  (review order summary, POST to /api/v1/orders)
 *
 * Depends on: pricing.js, deviceSelector.js (loaded before this file)
 */
(function () {

  /* ── State ──────────────────────────────────────────────────────────── */
  var state = {
    step:         1,
    device:       {},          // { brand, model, storage, carrier, color, baseMarketValue }
    condition:    '',          // 'excellent' | 'good' | 'fair' | 'broken'
    answers:      {},          // { powers_on: true, screen_cracks: false, … }
    offer:        'standard',  // 'standard' | 'sameday'
    standardAmt:  0,
    samedayAmt:   0,
    sameDayAvail: false,
    coopName:     '',
    seller:       {},          // { name, phone, email, address, city, zip }
    submitting:   false,
  };

  var TOTAL_STEPS = 5;

  /* ── Condition questions ─────────────────────────────────────────────── */
  var QUESTIONS = [
    { key: 'powers_on',         text: 'Does the device power on?',                         sub: 'Hold the power button for 5 seconds.' },
    { key: 'screen_cracks',     text: 'Is the screen free of cracks or damage?',           sub: 'Check under bright light and at an angle.', invert: true },
    { key: 'find_my_disabled',  text: 'Is Find My / iCloud / FRP disabled?',               sub: 'Go to Settings → [your name] → Find My to verify.' },
    { key: 'liquid_damage',     text: 'Is there no visible liquid or corrosion damage?',   sub: 'Check port openings and under the battery cover if removable.', invert: true },
    { key: 'battery_health',    text: 'Is battery health above 85%?',                      sub: 'Settings → Battery → Battery Health & Charging.' },
    { key: 'cameras_functional',text: 'Are all cameras fully functional?',                 sub: 'Test front and rear cameras in the camera app.' },
  ];

  // "invert" = question asks about a problem — "Yes, there is damage" means fails
  // For display we flip: "Is there no damage?" → Yes = passes, No = fails

  /* ── DOM helpers ─────────────────────────────────────────────────────── */
  function qs(sel)  { return document.querySelector(sel); }
  function qsa(sel) { return document.querySelectorAll(sel); }
  function show(el) { if (el) el.classList.remove('hidden'); }
  function hide(el) { if (el) el.classList.add('hidden'); }

  /* ── Progress bar ────────────────────────────────────────────────────── */
  function updateProgress() {
    var segs = qsa('.progress-seg');
    segs.forEach(function (seg, i) {
      var n = i + 1;
      seg.classList.remove('done', 'active');
      if (n < state.step)  seg.classList.add('done');
      if (n === state.step) seg.classList.add('active');
    });
    var lbl = qs('.progress-label');
    if (lbl) lbl.textContent = 'Step ' + state.step + ' of ' + TOTAL_STEPS;
  }

  /* ── Show a step ─────────────────────────────────────────────────────── */
  function goTo(n) {
    state.step = n;
    qsa('.step-card').forEach(function (c) { c.classList.remove('active'); });
    var card = qs('[data-step="' + n + '"]');
    if (card) {
      card.classList.add('active');
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    updateProgress();
    if (n === 3) renderOffers();
    if (n === 5) renderReview();
  }

  /* ── Step 1: Device selection ────────────────────────────────────────── */
  function initDeviceStep() {
    var els = {
      brand:   qs('#sel-brand'),
      model:   qs('#sel-model'),
      storage: qs('#sel-storage'),
      carrier: qs('#sel-carrier'),
      color:   qs('#sel-color'),
    };

    DeviceSelector.init(els, function (d) {
      state.device = d;
      var btn = qs('#btn-device-next');
      if (btn) btn.disabled = !d.complete;
      // Live preview estimate
      if (d.complete && d.baseMarketValue) {
        var est = Pricing.estimate(d);
        var preview = qs('#device-preview');
        if (preview && est) {
          preview.textContent = 'Est. ' + Pricing.formatMoney(est.standard) + ' standard';
          show(preview);
        }
      }
    });

    var btn = qs('#btn-device-next');
    if (btn) {
      btn.disabled = true;
      btn.addEventListener('click', function () {
        if (!state.device.complete) return;
        goTo(2);
      });
    }
  }

  /* ── Step 2: Condition questionnaire ─────────────────────────────────── */
  function initConditionStep() {
    var container = qs('#condition-questions');
    if (!container) return;

    container.innerHTML = '';
    QUESTIONS.forEach(function (q) {
      var div = document.createElement('div');
      div.className = 'cq-item';
      div.dataset.key = q.key;
      div.innerHTML =
        '<div>' +
          '<div class="cq-question">' + q.text + '</div>' +
          (q.sub ? '<div class="cq-sub">' + q.sub + '</div>' : '') +
        '</div>' +
        '<div class="cq-btns">' +
          '<button class="cq-btn" data-val="yes">Yes</button>' +
          '<button class="cq-btn" data-val="no">No</button>' +
        '</div>';

      div.querySelectorAll('.cq-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var val   = btn.dataset.val;
          var passes = val === 'yes';  // "Yes" = condition is met / positive answer
          state.answers[q.key] = passes;

          // Visual state
          div.querySelectorAll('.cq-btn').forEach(function (b) {
            b.classList.remove('sel-yes', 'sel-no');
          });
          btn.classList.add(val === 'yes' ? 'sel-yes' : 'sel-no');
          div.classList.remove('answered', 'answered-no');
          div.classList.add(passes ? 'answered' : 'answered-no');

          checkConditionComplete();
        });
      });

      container.appendChild(div);
    });

    var backBtn = qs('#btn-condition-back');
    if (backBtn) backBtn.addEventListener('click', function () { goTo(1); });

    var nextBtn = qs('#btn-condition-next');
    if (nextBtn) {
      nextBtn.disabled = true;
      nextBtn.addEventListener('click', function () {
        // Derive grade
        var grade = deriveGrade(state.answers);
        state.condition = grade;
        // Fetch authoritative quote from server
        fetchQuote();
      });
    }
  }

  function checkConditionComplete() {
    var answered = Object.keys(state.answers).length;
    var btn = qs('#btn-condition-next');
    if (btn) btn.disabled = answered < QUESTIONS.length;
    // Show running grade estimate
    if (answered > 0) {
      var grade = deriveGrade(state.answers);
      var el = qs('#condition-grade-preview');
      if (el) {
        el.className = 'grade-badge grade-' + grade;
        el.textContent = grade.charAt(0).toUpperCase() + grade.slice(1);
        show(el);
      }
    }
  }

  function deriveGrade(answers) {
    var penalties = {
      powers_on:          99,
      screen_cracks:       1,
      find_my_disabled:    1,
      liquid_damage:       2,
      battery_health:      1,
      cameras_functional:  1,
    };
    // "invert" questions: false = problem exists = penalty
    var penalty = 0;
    Object.keys(answers).forEach(function (k) {
      if (!answers[k] && penalties[k] != null) penalty += penalties[k];
    });
    if (penalty >= 99) return 'broken';
    if (penalty >= 3)  return 'fair';
    if (penalty >= 1)  return 'good';
    return 'excellent';
  }

  function fetchQuote() {
    var btn = qs('#btn-condition-next');
    if (btn) { btn.disabled = true; btn.textContent = 'Calculating…'; }

    var params = new URLSearchParams({
      brand:    state.device.brand,
      model:    state.device.model,
      storage:  state.device.storage || '128GB',
      carrier:  state.device.carrier || 'Unlocked',
      condition: state.condition,
    });

    Promise.all([
      fetch('/api/v1/quote?' + params).then(function (r) { return r.json(); }),
      fetch('/api/v1/territory/' + encodeURIComponent(state.seller.zip || '00000'))
        .then(function (r) { return r.json(); })
        .catch(function () { return { sameDayAvailable: false }; }),
    ])
    .then(function (results) {
      var quoteData    = results[0];
      var territoryData = results[1];

      if (quoteData.ok && quoteData.quote) {
        state.standardAmt  = quoteData.quote.standard;
        state.samedayAmt   = quoteData.quote.sameDay;
        state.sameDayAvail = territoryData.sameDayAvailable || false;
        state.coopName     = (territoryData.coop && territoryData.coop.name) || '';
      }
      goTo(3);
    })
    .catch(function () {
      // Fallback to client-side estimate
      var est = Pricing.estimate(Object.assign({}, state.device, { condition: state.condition }));
      if (est) {
        state.standardAmt = est.standard;
        state.samedayAmt  = est.sameDay;
      }
      goTo(3);
    })
    .finally(function () {
      if (btn) { btn.disabled = false; btn.textContent = 'See My Offers'; }
    });
  }

  /* ── Step 3: Offers ──────────────────────────────────────────────────── */
  function renderOffers() {
    var stdPrice = qs('#offer-standard-price');
    var sdPrice  = qs('#offer-sameday-price');
    var sdCard   = qs('#offer-sameday-card');
    var sdUnavail = qs('#sameday-unavail');

    if (stdPrice) stdPrice.textContent = Pricing.formatMoney(state.standardAmt);
    if (sdPrice)  sdPrice.textContent  = Pricing.formatMoney(state.samedayAmt);

    // Same-day availability gate
    if (!state.sameDayAvail) {
      if (sdCard) sdCard.style.opacity = '.4';
      if (sdCard) sdCard.style.pointerEvents = 'none';
      if (sdUnavail) show(sdUnavail);
      state.offer = 'standard';
      selectOffer('standard');
    } else {
      if (sdCard) sdCard.style.opacity = '';
      if (sdCard) sdCard.style.pointerEvents = '';
      if (sdUnavail) hide(sdUnavail);
    }

    // Grade badge
    var gradeEl = qs('#offer-grade');
    if (gradeEl) {
      gradeEl.className = 'grade-badge grade-' + state.condition;
      gradeEl.textContent = state.condition.charAt(0).toUpperCase() + state.condition.slice(1);
    }

    // Wire offer cards
    var cards = qsa('.offer-card');
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        if (card.style.pointerEvents === 'none') return;
        var type = card.dataset.offer;
        if (type) selectOffer(type);
      });
    });

    // Default select standard
    selectOffer(state.sameDayAvail ? 'sameday' : 'standard');
  }

  function selectOffer(type) {
    state.offer = type;
    qsa('.offer-card').forEach(function (c) {
      c.classList.remove('selected', 'selected-sameday');
    });
    var target = qs('.offer-card[data-offer="' + type + '"]');
    if (target) target.classList.add(type === 'sameday' ? 'selected-sameday' : 'selected');
    var checkStd = qs('#offer-standard-card .offer-check svg');
    var checkSd  = qs('#offer-sameday-card .offer-check svg');
    // Show/hide check marks
    [qs('#offer-standard-card'), qs('#offer-sameday-card')].forEach(function (c) {
      if (!c) return;
      var check = c.querySelector('.offer-check');
      if (check) check.innerHTML = c.dataset.offer === type
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>'
        : '';
    });
  }

  function initOfferStep() {
    var backBtn = qs('#btn-offer-back');
    if (backBtn) backBtn.addEventListener('click', function () { goTo(2); });

    var nextBtn = qs('#btn-offer-next');
    if (nextBtn) nextBtn.addEventListener('click', function () { goTo(4); });
  }

  /* ── Step 4: Seller information ──────────────────────────────────────── */
  function initInfoStep() {
    var backBtn = qs('#btn-info-back');
    if (backBtn) backBtn.addEventListener('click', function () { goTo(3); });

    var nextBtn = qs('#btn-info-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (!collectInfo()) return;
        goTo(5);
      });
    }

    // ZIP live lookup
    var zipInput = qs('#info-zip');
    if (zipInput) {
      var debounceTimer;
      zipInput.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        var zip = zipInput.value.trim();
        if (zip.length < 5) return;
        debounceTimer = setTimeout(function () { checkZip(zip); }, 500);
      });
    }
  }

  function checkZip(zip) {
    fetch('/api/v1/territory/' + encodeURIComponent(zip))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        state.sameDayAvail = d.sameDayAvailable || false;
        state.coopName     = (d.coop && d.coop.name) || '';
        var ind = qs('#zip-indicator');
        if (!ind) return;
        ind.classList.remove('covered', 'uncovered');
        if (d.sameDayAvailable) {
          ind.classList.add('covered');
          ind.innerHTML = '<span class="zip-dot"></span>Same-day pickup available · ' + (d.coop ? d.coop.name : '');
        } else {
          ind.classList.add('uncovered');
          ind.innerHTML = '<span class="zip-dot"></span>Standard mail-in only in this area';
        }
        show(ind);
      })
      .catch(function () {});
  }

  function collectInfo() {
    var fields = {
      sellerName:    qs('#info-name'),
      sellerPhone:   qs('#info-phone'),
      sellerEmail:   qs('#info-email'),
      pickupAddress: qs('#info-address'),
      pickupCity:    qs('#info-city'),
      pickupZip:     qs('#info-zip'),
    };

    var valid = true;
    Object.keys(fields).forEach(function (k) {
      var el = fields[k];
      if (!el) return;
      el.style.borderColor = '';
      if (!el.value.trim() && k !== 'sellerEmail') {
        el.style.borderColor = 'var(--bad)';
        valid = false;
      }
      if (el.value.trim()) state.seller[k] = el.value.trim();
    });

    if (!valid) {
      var err = qs('#info-error');
      if (err) { err.textContent = 'Please fill in all required fields.'; show(err); }
      return false;
    }

    // Update same-day availability based on entered ZIP
    checkZip(state.seller.pickupZip || '');
    return true;
  }

  /* ── Step 5: Review & Submit ─────────────────────────────────────────── */
  function renderReview() {
    var quotedAmount = state.offer === 'sameday' ? state.samedayAmt : state.standardAmt;

    var rows = [
      ['Device',    state.device.brand + ' ' + state.device.model],
      ['Storage',   state.device.storage || '—'],
      ['Carrier',   state.device.carrier || '—'],
      ['Condition', state.condition.charAt(0).toUpperCase() + state.condition.slice(1)],
      ['Name',      state.seller.sellerName],
      ['Phone',     state.seller.sellerPhone],
      ['Pickup',    state.seller.pickupAddress + ', ' + state.seller.pickupCity + ' ' + state.seller.pickupZip],
      ['Offer type',state.offer === 'sameday' ? 'Same-Day payment' : 'Standard (mail-in)'],
    ];

    var table = qs('#review-table');
    if (table) {
      table.innerHTML = rows.map(function (r) {
        return '<div class="review-row"><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>';
      }).join('');
    }

    var amtEl = qs('#review-amount');
    if (amtEl) amtEl.textContent = Pricing.formatMoney(quotedAmount);

    var typeEl = qs('#review-offer-type');
    if (typeEl) typeEl.textContent = state.offer === 'sameday' ? 'Same-Day' : 'Standard';
  }

  function initReviewStep() {
    var backBtn = qs('#btn-review-back');
    if (backBtn) backBtn.addEventListener('click', function () { goTo(4); });

    var submitBtn = qs('#btn-submit');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        if (state.submitting) return;
        submitOrder();
      });
    }
  }

  function submitOrder() {
    if (state.submitting) return;
    state.submitting = true;

    var submitBtn = qs('#btn-submit');
    if (submitBtn) submitBtn.classList.add('loading');

    var quotedAmount = state.offer === 'sameday' ? state.samedayAmt : state.standardAmt;

    var body = {
      sellerName:      state.seller.sellerName,
      sellerPhone:     state.seller.sellerPhone,
      sellerEmail:     state.seller.sellerEmail  || '',
      pickupAddress:   state.seller.pickupAddress,
      pickupCity:      state.seller.pickupCity,
      pickupZip:       state.seller.pickupZip,
      deviceBrand:     state.device.brand,
      deviceModel:     state.device.model,
      deviceStorage:   state.device.storage,
      deviceCarrier:   state.device.carrier,
      deviceColor:     state.device.color || '',
      deviceCondition: state.condition,
      selectedOffer:   state.offer,
      quotedAmount:    quotedAmount,
      standardOffer:   state.standardAmt,
      samedayOffer:    state.samedayAmt,
    };

    fetch('/api/v1/orders', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d.ok) throw new Error(d.error || 'Order creation failed');
      // Stash order info for success page
      try {
        sessionStorage.setItem('oc_last_order', JSON.stringify({
          orderId:    d.orderId,
          externalRef: d.order && d.order.externalRef,
          device:     body.deviceBrand + ' ' + body.deviceModel,
          amount:     quotedAmount,
          offer:      state.offer,
          coopName:   state.coopName,
          sameDay:    state.offer === 'sameday',
          message:    d.message,
        }));
      } catch (_e) { /* sessionStorage unavailable */ }
      window.location.href = '/success';
    })
    .catch(function (err) {
      state.submitting = false;
      if (submitBtn) submitBtn.classList.remove('loading');
      var errEl = qs('#submit-error');
      if (errEl) {
        errEl.textContent = err.message || 'Something went wrong — please try again.';
        show(errEl);
      }
    });
  }

  /* ── Boot ────────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    updateProgress();
    initDeviceStep();
    initConditionStep();
    initOfferStep();
    initInfoStep();
    initReviewStep();

    // Start on step 1 (in case hash navigation is used later)
    goTo(1);
  });

})();
