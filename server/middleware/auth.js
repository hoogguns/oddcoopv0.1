const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'oddcoop-dev-secret-change-in-prod';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '12h';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function requireAuth(role) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (role && payload.role !== role) {
        return res.status(403).json({ error: 'Forbidden — wrong role' });
      }
      req.user = payload;
      next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

// Convenience alias — routes import requirePartner directly
const requirePartner = requireAuth('partner');

module.exports = { signToken, requireAuth, requirePartner };
