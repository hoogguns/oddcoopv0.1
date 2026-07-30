/**
 * routes/health.js — application health check endpoint.
 *
 * GET /api/health
 *
 * Returns a structured JSON object used by:
 *   • Render.com health check (configured in render.yaml)
 *   • Uptime monitors
 *   • Developer smoke tests
 *
 * Response shape:
 * {
 *   "status":    "ok",
 *   "version":   "0.1.0",
 *   "env":       "production",
 *   "uptime":    123.45,
 *   "timestamp": "2026-07-29T18:22:15.000Z",
 *   "db": {
 *     "ok":      true,
 *     "orders":  12,
 *     "partners": 2,
 *     "drivers":  5
 *   }
 * }
 *
 * On DB error the response is status 503 with "db.ok": false.
 */
'use strict';

const express = require('express');
const config  = require('../config/config');
const { getDb } = require('../db');

const router  = express.Router();
const VERSION = require('../../package.json').version;

/**
 * GET /api/health
 * Liveness + readiness probe. Checks DB connectivity and returns platform stats.
 */
router.get('/', (req, res) => {
  let dbStats;

  try {
    const db = getDb();
    const row = db.prepare(
      `SELECT
         (SELECT COUNT(*) FROM orders)                    AS orders,
         (SELECT COUNT(*) FROM partners WHERE active != 0) AS partners,
         (SELECT COUNT(*) FROM drivers  WHERE trained = 1) AS drivers`
    ).get();

    dbStats = {
      ok:       true,
      orders:   row.orders   || 0,
      partners: row.partners || 0,
      drivers:  row.drivers  || 0,
    };
  } catch (err) {
    dbStats = { ok: false, error: err.message };
  }

  const status = dbStats.ok ? 'ok' : 'degraded';
  const httpStatus = dbStats.ok ? 200 : 503;

  res.status(httpStatus).json({
    status,
    version:   VERSION,
    env:       config.env,
    uptime:    Math.round(process.uptime() * 100) / 100,
    timestamp: new Date().toISOString(),
    db:        dbStats,
  });
});

module.exports = router;
