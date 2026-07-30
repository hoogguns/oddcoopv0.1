/**
 * auth.js — JWT authentication middleware.
 *
 * Exports:
 *   signToken(payload)        — signs a JWT with the configured secret + expiry
 *   requireAuth(role?)        — Express middleware; validates Bearer token + optional role
 *   requirePartner            — convenience alias for requireAuth('partner')
 *
 * Security notes:
 *   • JWT_SECRET MUST be set in production. The server will refuse to start if it is
 *     missing and NODE_ENV === 'production'.
 *   • In development a clear warning is logged so the insecure default is never silent.
 */
'use strict';

const jwt = require('jsonwebtoken');

// ── Secret resolution ─────────────────────────────────────────────────────────

const DEV_FALLBACK = 'oddcoop-dev-secret-change-in-prod';

function resolveSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret === DEV_FALLBACK) {
    if (process.env.NODE_ENV === 'production') {
      // Hard-fail: a predictable secret in production is a critical vulnerability.
      throw new Error(
        '[auth] JWT_SECRET is not set or uses the insecure default. ' +
          'Set a strong random value in your environment before starting in production.'
      );
    }
    // Development: allow but warn loudly.
    console.warn(
      '[auth] WARNING: JWT_SECRET is not set — using insecure dev fallback. ' +
        'Set JWT_SECRET in .env before deploying.'
    );
    return DEV_FALLBACK;
  }

  return secret;
}

const JWT_SECRET = resolveSecret();
const JWT_EXPIRY = process.env.JWT_EXPIRY || '12h';

// ── Token utilities ───────────────────────────────────────────────────────────

/**
 * Sign a JWT with the configured secret and expiry.
 *
 * @param {object} payload - Claims to embed (role, id, email, …)
 * @returns {string} Signed JWT string
 */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Express middleware that validates a Bearer token in the Authorization header.
 * Optionally enforces a required role claim.
 *
 * @param {string} [role] - If provided, req.user.role must equal this value.
 * @returns {import('express').RequestHandler}
 */
function requireAuth(role) {
  return (req, res, next) => {
    // Support both Bearer token (dashboard/driver app) and API key (partner integrations)
    const header = req.headers.authorization || '';
    const apiKey = req.headers['x-api-key'] || '';

    let token = null;

    if (header.startsWith('Bearer ')) {
      token = header.slice(7);
    } else if (apiKey) {
      // API key holders are always the 'partner' role
      const db = require('../db').getDb();
      const data = db._data();
      const partner = (data.partners || []).find((p) => p.api_key === apiKey && p.active !== 0);
      if (!partner) return res.status(401).json({ error: 'Invalid API key' });
      if (role && role !== 'partner') {
        return res.status(403).json({ error: 'Forbidden — API keys are partner-scoped' });
      }
      req.user = { role: 'partner', id: partner.id, email: partner.email, company: partner.company_name };
      return next();
    }

    if (!token) return res.status(401).json({ error: 'Authentication required' });

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (role && payload.role !== role) {
        return res.status(403).json({ error: 'Forbidden — wrong role' });
      }
      req.user = payload;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

/** Convenience alias — routes import requirePartner directly. */
const requirePartner = requireAuth('partner');

module.exports = { signToken, requireAuth, requirePartner };
