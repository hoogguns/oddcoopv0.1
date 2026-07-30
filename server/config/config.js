/**
 * config.js — centralized environment configuration.
 *
 * Every module that needs a config value imports this file.
 * No module reads `process.env` directly outside this file.
 *
 * All values are resolved once at startup so misconfiguration fails fast
 * rather than silently at runtime.
 */
'use strict';

// Load .env file in development. In production (Render, etc.) the platform
// injects env vars directly; dotenv is a no-op when the variables are already set.
require('dotenv').config();

// ── JWT secret guard ─────────────────────────────────────────────────────────
// Handled by server/middleware/auth.js at module load time.
// Listed here for documentation completeness.

const config = {
  // ── Server ──────────────────────────────────────────────────────────────────
  /** TCP port the HTTP server binds to. */
  port: Number(process.env.PORT) || 3847,

  /** Node environment: 'development' | 'production' | 'test' */
  env: process.env.NODE_ENV || 'development',

  // ── Auth ────────────────────────────────────────────────────────────────────
  /** JWT signing secret. auth.js enforces this is set in production. */
  jwtSecret: process.env.JWT_SECRET,

  /** JWT expiry (e.g. '12h', '7d'). */
  jwtExpiry: process.env.JWT_EXPIRY || '12h',

  // ── Database ────────────────────────────────────────────────────────────────
  /**
   * Path to the JSON data file.
   * Override to /var/data/oddcoop.json on Render with a persistent disk.
   */
  dataPath: process.env.DB_PATH || require('path').join(__dirname, '..', '..', 'data', 'oddcoop.json'),

  // ── Rate limiting ────────────────────────────────────────────────────────────
  rateLimit: {
    /** Rolling window in ms (default 15 min). */
    windowMs:  Number(process.env.RATE_LIMIT_WINDOW_MS)  || 15 * 60 * 1000,
    /** Max login/register attempts per window per IP. */
    authMax:   Number(process.env.RATE_LIMIT_AUTH_MAX)   || 20,
    /** Max lead form submissions per window per IP. */
    leadMax:   Number(process.env.RATE_LIMIT_LEAD_MAX)   || 10,
    /** Max general public API requests per window per IP. */
    publicMax: Number(process.env.RATE_LIMIT_PUBLIC_MAX) || 120,
  },

  // ── CORS ─────────────────────────────────────────────────────────────────────
  /**
   * Allowed origins. Empty string → allow all (development default).
   * Comma-separated list in production:
   *   CORS_ORIGIN=https://wasatchbuybacks.oddcoop.com,https://oddcoop.com
   */
  corsOrigin: process.env.CORS_ORIGIN || '',

  // ── Platform COGS (SaaS economics) ───────────────────────────────────────────
  cogs: {
    hostingPerPartner: Number(process.env.SAAS_HOSTING_COGS) || 8,
    supportPerPartner: Number(process.env.SAAS_SUPPORT_COGS) || 15,
  },

  // ── Feature flags (extend as needed) ────────────────────────────────────────
  /** Whether auto-seeding on empty DB is enabled. Disable in prod if desired. */
  autoSeed: process.env.AUTO_SEED !== 'false',
};

module.exports = config;
