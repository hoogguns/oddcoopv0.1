/**
 * quoteService.js — device buyback quote calculation engine.
 *
 * Produces Standard and Same-Day offers for a given device + condition.
 *
 * Pipeline:
 *   Base Market Value  (from device catalog)
 *     × Storage premium
 *     × Carrier adjustment
 *     × Condition multiplier
 *     = Standard offer
 *
 *   Standard offer × Same-Day rate (default 0.82)
 *     = Same-Day offer
 *
 * All multipliers are data-driven. Adding a new condition grade or adjusting
 * a carrier discount requires only changing the constants below — no logic changes.
 *
 * @module server/services/quoteService
 */
'use strict';

const devices = require('../models/devices.json');

// ── Condition multipliers ─────────────────────────────────────────────────────
// Maps a condition grade to a fraction of base market value.
const CONDITION_MULTIPLIERS = {
  excellent: 0.85,
  good:      0.72,
  fair:      0.52,
  broken:    0.18,
};

// ── Storage premium table (additive cents on the dollar above base) ────────────
// Represented as additional $ added to the base value per tier above the
// device's default (first) storage option.
const STORAGE_PREMIUMS = {
  '64GB':  0,
  '128GB': 0,
  '256GB': 25,
  '512GB': 55,
  '1TB':   90,
};

// ── Carrier adjustment ────────────────────────────────────────────────────────
// Locked devices are worth less because buyers must pay to unlock or sell to
// carrier-specific markets. Unlocked = no penalty.
const CARRIER_MULTIPLIERS = {
  'Unlocked': 1.00,
  'AT&T':     0.94,
  'T-Mobile': 0.94,
  'Verizon':  0.94,
  'Sprint':   0.90,
};

// ── Same-Day rate ─────────────────────────────────────────────────────────────
// Same-Day offer is a fraction of the Standard offer. The seller trades a small
// discount for immediate payment today vs waiting for mail-in processing.
const SAMEDAY_RATE = 0.82;

// ── Condition question scoring ────────────────────────────────────────────────
// Maps condition questionnaire answers to a condition grade.
// Each answer carries a penalty weight. If total penalty >= threshold, grade drops.
const CONDITION_GRADE_THRESHOLDS = [
  { maxPenalty: 0,  grade: 'excellent' },
  { maxPenalty: 1,  grade: 'good' },
  { maxPenalty: 3,  grade: 'fair' },
  { maxPenalty: 99, grade: 'broken' },
];

// Penalty per failing answer
const QUESTION_PENALTIES = {
  powers_on:         99,  // auto-broken if fails
  screen_cracks:      1,
  find_my_disabled:   1,
  liquid_damage:      2,
  battery_health:     1,
  cameras_functional: 1,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Round a dollar amount to the nearest $5 for cleaner quote display.
 *
 * @param {number} amount
 * @returns {number}
 */
function roundToFive(amount) {
  return Math.round(amount / 5) * 5;
}

/**
 * Look up a device model entry from the catalog.
 *
 * @param {string} brand
 * @param {string} model
 * @returns {object|null}
 */
function findDevice(brand, model) {
  const brandEntry = devices.find(
    (b) => b.brand.toLowerCase() === String(brand).toLowerCase()
  );
  if (!brandEntry) return null;
  return (
    brandEntry.models.find(
      (m) => m.model.toLowerCase() === String(model).toLowerCase()
    ) || null
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Calculate Standard and Same-Day offers for a device.
 *
 * @param {object} opts
 * @param {string} opts.brand       - Device brand (e.g. 'Apple')
 * @param {string} opts.model       - Device model (e.g. 'iPhone 15 Pro')
 * @param {string} opts.storage     - Storage capacity (e.g. '256GB')
 * @param {string} opts.carrier     - Carrier (e.g. 'Unlocked')
 * @param {string} opts.condition   - Condition grade: excellent|good|fair|broken
 * @returns {{
 *   standard:   number,
 *   sameDay:    number,
 *   breakdown:  object,
 *   condition:  string,
 *   available:  boolean,
 *   reason?:    string
 * }}
 */
function calculateQuote({ brand, model, storage, carrier, condition }) {
  const device = findDevice(brand, model);

  if (!device) {
    return {
      standard:  0,
      sameDay:   0,
      available: false,
      condition: condition || 'unknown',
      reason:    'Device not found in catalog',
      breakdown: {},
    };
  }

  const baseValue       = device.baseMarketValue;
  const storagePremium  = STORAGE_PREMIUMS[storage]  || 0;
  const carrierMult     = CARRIER_MULTIPLIERS[carrier] || CARRIER_MULTIPLIERS['Unlocked'];
  const conditionMult   = CONDITION_MULTIPLIERS[condition] || CONDITION_MULTIPLIERS.fair;

  const adjusted  = (baseValue + storagePremium) * carrierMult * conditionMult;
  const standard  = roundToFive(adjusted);
  const sameDay   = roundToFive(standard * SAMEDAY_RATE);

  return {
    standard,
    sameDay,
    sameDayRate:  SAMEDAY_RATE,
    available:    true,
    condition,
    breakdown: {
      baseMarketValue:  baseValue,
      storagePremium,
      carrierMultiplier: carrierMult,
      conditionMultiplier: conditionMult,
      adjustedBeforeRounding: Math.round(adjusted * 100) / 100,
    },
  };
}

/**
 * Derive a condition grade from condition questionnaire answers.
 *
 * @param {object} answers - Map of question key → boolean (true = passes, false = fails)
 * @returns {{ grade: string, failedQuestions: string[], penalty: number }}
 */
function gradeFromAnswers(answers) {
  let penalty = 0;
  const failed = [];

  for (const [key, passes] of Object.entries(answers)) {
    if (!passes && QUESTION_PENALTIES[key] != null) {
      penalty += QUESTION_PENALTIES[key];
      failed.push(key);
    }
  }

  const grade = CONDITION_GRADE_THRESHOLDS.find((t) => penalty <= t.maxPenalty)?.grade || 'broken';

  return { grade, failedQuestions: failed, penalty };
}

/**
 * Return the full device catalog, optionally filtered by brand.
 *
 * @param {string} [brand] - Optional brand filter
 * @returns {object[]}
 */
function getCatalog(brand) {
  if (brand) {
    const entry = devices.find((b) => b.brand.toLowerCase() === brand.toLowerCase());
    return entry ? [entry] : [];
  }
  return devices;
}

/**
 * Return all brands as a simple array of strings.
 *
 * @returns {string[]}
 */
function getBrands() {
  return devices.map((b) => b.brand);
}

module.exports = {
  calculateQuote,
  gradeFromAnswers,
  getCatalog,
  getBrands,
  findDevice,
  CONDITION_MULTIPLIERS,
  SAMEDAY_RATE,
};
