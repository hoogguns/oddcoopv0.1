/* pricing.js — frontend quote calculation mirror.
 * Mirrors quoteService.js so the page can show a live preview quote
 * without an API round-trip on every selector change.
 * The server is still the source of truth — the final offer shown to the
 * seller comes from /api/v1/quote and is not recalculated client-side.
 */
window.Pricing = (function () {

  var CONDITION_MULTIPLIERS = {
    excellent: 0.85,
    good:      0.72,
    fair:      0.52,
    broken:    0.18,
  };

  var STORAGE_PREMIUMS = {
    '64GB':  0,
    '128GB': 0,
    '256GB': 25,
    '512GB': 55,
    '1TB':   90,
  };

  var CARRIER_MULTIPLIERS = {
    'Unlocked': 1.00,
    'AT&T':     0.94,
    'T-Mobile': 0.94,
    'Verizon':  0.94,
    'Sprint':   0.90,
  };

  var SAMEDAY_RATE = 0.82;

  function roundToFive(n) {
    return Math.round(n / 5) * 5;
  }

  /**
   * Quick client-side estimate (for live UI feedback only).
   * Always verify against the server response before displaying the final offer.
   *
   * @param {object} opts
   * @returns {{ standard: number, sameDay: number } | null}
   */
  function estimate(opts) {
    var base = opts.baseMarketValue;
    if (!base) return null;

    var storagePremium = STORAGE_PREMIUMS[opts.storage]  || 0;
    var carrierMult    = CARRIER_MULTIPLIERS[opts.carrier] || 1;
    var conditionMult  = CONDITION_MULTIPLIERS[opts.condition] || CONDITION_MULTIPLIERS.fair;

    var adjusted = (base + storagePremium) * carrierMult * conditionMult;
    var standard = roundToFive(adjusted);
    var sameDay  = roundToFive(standard * SAMEDAY_RATE);

    return { standard: standard, sameDay: sameDay };
  }

  function formatMoney(n) {
    return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  return { estimate: estimate, formatMoney: formatMoney, SAMEDAY_RATE: SAMEDAY_RATE };
})();
