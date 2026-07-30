/**
 * server.js — OddCoop application entry point.
 *
 * Responsibilities (single file, single concern):
 *   1. Load environment configuration via config.js (which calls dotenv.config)
 *   2. Optionally auto-seed the database on first boot
 *   3. Create the Express application (server/app.js)
 *   4. Create the HTTP server
 *   5. Attach the WebSocket server (server/websocket/wsServer.js)
 *   6. Expose broadcast helpers on app.locals for routes + services
 *   7. Start listening on the configured port
 *   8. Handle graceful shutdown on SIGTERM / SIGINT
 *
 * This file intentionally contains no business logic — it is pure wiring.
 *
 * Run:
 *   node server.js          (production)
 *   nodemon server.js       (development — via `npm run dev`)
 */
'use strict';

// ── 1. Configuration + environment ──────────────────────────────────────────
// config.js calls dotenv.config() so .env is loaded before anything else reads
// process.env. Import config before any other local module.
const config = require('./server/config/config');
const http   = require('http');

// ── 2. Database boot + optional auto-seed ────────────────────────────────────
const { getDb, save } = require('./server/db');

if (config.autoSeed) {
  try {
    const db = getDb();
    const d  = db._data();
    const isEmpty =
      (!d.partners || d.partners.length === 0) &&
      (!d.drivers  || d.drivers.length  === 0) &&
      (!d.orders   || d.orders.length   === 0);

    if (isEmpty) {
      console.log('📦  Empty database detected — running auto-seed...');
      const { runSeed } = require('./server/seed');
      runSeed();
      console.log('✅  Auto-seed complete.');
    }
  } catch (e) {
    console.error('DB init / seed error:', e.message);
  }
}

// ── 3. Create Express application ────────────────────────────────────────────
const { createApp } = require('./server/app');
const app = createApp();

// ── 4. Create HTTP server ─────────────────────────────────────────────────────
const server = http.createServer(app);

// ── 5. Attach WebSocket server ────────────────────────────────────────────────
const { createWsServer } = require('./server/websocket/wsServer');
const { wss, broadcastToSlug, broadcastToPartner } = createWsServer(server, getDb);

// ── 6. Expose broadcast helpers globally ─────────────────────────────────────
// Routes and services import these via `req.app.locals` or by requiring
// server/websocket/wsServer.js directly if a reference to app is unavailable.
app.locals.broadcastToSlug    = broadcastToSlug;
app.locals.broadcastToPartner = broadcastToPartner;
app.locals.wss                = wss;

// ── 7. Start listening ────────────────────────────────────────────────────────
server.listen(config.port, () => {
  console.log(`\n🚀  OddCoop ${require('./package.json').version} [${config.env}]`);
  console.log(`    HTTP       → http://localhost:${config.port}`);
  console.log(`    WebSocket  → ws://localhost:${config.port}/ws`);
  console.log(`    Dashboard  → http://localhost:${config.port}/dashboard`);
  console.log(`    Drivers    → http://localhost:${config.port}/drivers`);
  console.log(`    Health     → http://localhost:${config.port}/api/health\n`);
});

// ── 8. Graceful shutdown ──────────────────────────────────────────────────────
//
// On SIGTERM (Render deploy teardown) or SIGINT (Ctrl-C in dev):
//   1. Stop accepting new connections.
//   2. Send WebSocket CLOSE frames to all clients.
//   3. Flush in-memory DB state to disk atomically.
//   4. Hard-exit after 5 s if still waiting for in-flight requests.
//
// The atomic write in db.js (write .tmp → rename) ensures oddcoop.json is
// never left in a half-written state even if the process is killed mid-flush.
function shutdown(signal) {
  console.log(`\n[shutdown] ${signal} received — draining connections...`);

  server.close(() => console.log('[shutdown] HTTP server closed.'));
  wss.close(() => console.log('[shutdown] WebSocket server closed.'));

  try {
    const db   = getDb();
    const data = db._data();
    save(data);
    console.log('[shutdown] DB flushed to disk.');
  } catch (e) {
    console.error('[shutdown] DB flush error:', e.message);
  }

  const timer = setTimeout(() => {
    console.warn('[shutdown] Forced exit after 5 s timeout.');
    process.exit(0);
  }, 5000);

  // Allow the event loop to exit naturally if all handles close before the timer
  timer.unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ── Exports (used by tests and server/index.js shim) ─────────────────────────
module.exports = { app, server, broadcastToSlug, broadcastToPartner };
