/**
 * errorHandler.js — global Express error + 404 handlers.
 *
 * Mount order in app.js (must come last in the middleware chain):
 *
 *   app.use(notFound);      // catches unmatched routes → 404
 *   app.use(errorHandler);  // catches all thrown errors  → 4xx / 5xx
 *
 * Any route can signal a specific HTTP status by attaching `.status` to the error:
 *
 *   const err = new Error('Partner not found');
 *   err.status = 404;
 *   throw err;
 *   // or
 *   next(err);
 *
 * The response shape is always:
 *   { error: string, requestId?: string }
 *
 * In development the full stack trace is also included:
 *   { error: string, requestId: string, stack: string }
 */
'use strict';

const config = require('../config/config');

/**
 * 404 handler — catches any request that fell through all mounted routes.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
function notFound(req, res) {
  res.status(404).json({
    error:     `Route not found: ${req.method} ${req.path}`,
    requestId: req.id,
  });
}

/**
 * Global error handler — must have exactly 4 parameters so Express recognises it.
 *
 * @param {Error & { status?: number }} err
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;

  // Log 5xx errors — 4xx are the client's problem, not ours
  if (status >= 500) {
    console.error(
      `[error] ${status} ${req.method} ${req.path} ${req.id || ''}`,
      err.message,
      err.stack
    );
  }

  const body = {
    error:     err.message || 'An unexpected error occurred',
    requestId: req.id,
  };

  // Expose stack trace in development only
  if (config.env === 'development' && err.stack) {
    body.stack = err.stack;
  }

  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
