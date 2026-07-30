/**
 * logger.js — structured HTTP request logger.
 *
 * Every request receives:
 *   • A unique request ID (req-<8 hex chars>) attached to req.id
 *   • A log line on response finish:
 *
 *     [2026-07-29T18:22:15Z] POST /api/v1/orders 201 41ms req_91b0e9
 *
 * The req.id is also sent back to the client as X-Request-Id so correlating
 * browser DevTools network logs with server logs is trivial.
 *
 * Authenticated user (role + id) is appended when req.user is populated by
 * the auth middleware that runs downstream.
 *
 * Uses Node's built-in crypto module — no extra dependencies.
 */
'use strict';

const crypto = require('crypto');

/**
 * Generate a short, unique request identifier.
 *
 * @returns {string} e.g. "req_a1b2c3d4"
 */
function generateRequestId() {
  return 'req_' + crypto.randomBytes(4).toString('hex');
}

/**
 * Format a duration in milliseconds as a human-readable string.
 *
 * @param {number} ms
 * @returns {string} e.g. "41ms", "1.3s"
 */
function formatDuration(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

/**
 * Express middleware that logs each request once the response finishes.
 *
 * Attaches:
 *   req.id        — unique request identifier
 *   req.startTime — high-resolution start timestamp (for duration calculation)
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function logger(req, res, next) {
  req.id        = generateRequestId();
  req.startTime = process.hrtime.bigint();

  // Echo the request ID back so clients can correlate logs
  res.setHeader('X-Request-Id', req.id);

  // Log on finish (not on 'close' — avoids duplicate lines for aborted requests)
  res.on('finish', () => {
    const durationNs = process.hrtime.bigint() - req.startTime;
    const durationMs = Number(durationNs / 1_000_000n);

    // Skip noisy health-check polls in development
    if (req.path === '/api/public/health' && res.statusCode < 400) return;

    const timestamp = new Date().toISOString();
    const method    = req.method.padEnd(6);
    const status    = res.statusCode;
    const duration  = formatDuration(durationMs);
    const id        = req.id;

    // Append authenticated actor if present (populated by auth middleware)
    const actor = req.user
      ? ` [${req.user.role}:${String(req.user.id).slice(-6)}]`
      : '';

    // Colour status code for terminal readability (stripped in non-TTY)
    let statusStr = String(status);
    if (process.stdout.isTTY) {
      if (status >= 500) statusStr = `\x1b[31m${status}\x1b[0m`; // red
      else if (status >= 400) statusStr = `\x1b[33m${status}\x1b[0m`; // yellow
      else if (status >= 200) statusStr = `\x1b[32m${status}\x1b[0m`; // green
    }

    console.log(`[${timestamp}] ${method} ${req.path} ${statusStr} ${duration} ${id}${actor}`);
  });

  next();
}

module.exports = logger;
