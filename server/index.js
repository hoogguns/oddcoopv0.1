require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { getDb } = require('./db');
const requireTenant = require('./middleware/requireTenant');

// ensure DB + schema; auto-seed empty store for launch demos
try {
  getDb();
  const count = getDb().prepare('SELECT COUNT(*) AS c FROM partners').get().c;
  if (count === 0) {
    console.log('  Empty database — running seed…');
    require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'seed.js')], {
      stdio: 'inherit',
      env: process.env,
    });
  }
} catch (err) {
  console.warn('  Seed check skipped:', err.message);
}

const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const publicRoutes = require('./routes/public');

const app = express();
const PORT = process.env.PORT || 3847;
const publicDir = path.join(__dirname, '..', 'public');
const isProd = process.env.NODE_ENV === 'production';

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProd) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
});

const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin.split(',').map((s) => s.trim()) } : undefined));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(isProd ? 'combined' : 'dev'));

// Attach tenant to every request
app.use(requireTenant);

// API routes
app.use('/api', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', orderRoutes);

// Tenant-aware HTML serving — replaces {{COOP_*}} tokens
function sendTenantHtml(file) {
  return (req, res) => {
    const filePath = path.join(publicDir, file);
    if (!fs.existsSync(filePath)) {
      return res.status(404).sendFile(path.join(publicDir, '404.html'));
    }
    let html = fs.readFileSync(filePath, 'utf8');
    const t = req.tenant;
    html = html
      .replace(/\{\{COOP_NAME\}\}/g, t.name)
      .replace(/\{\{COOP_SLUG\}\}/g, t.slug)
      .replace(/\{\{COOP_COLOR\}\}/g, t.color)
      .replace(/\{\{COOP_MARKET\}\}/g, t.market)
      .replace(/\{\{COOP_CORRIDOR\}\}/g, t.corridor)
      .replace(/\{\{COOP_LOGO_LETTER\}\}/g, t.logo_letter);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  };
}

// Static assets (CSS, JS, images) — no token replacement needed
app.use(express.static(publicDir, { maxAge: isProd ? '1h' : 0, etag: true }));

// Named page routes
app.get('/',           sendTenantHtml('index.html'));
app.get('/login',      sendTenantHtml('login.html'));
app.get('/dashboard',  sendTenantHtml('dashboard.html'));
app.get('/dashboard/{*rest}', sendTenantHtml('dashboard.html'));
app.get('/drivers',    sendTenantHtml('drivers.html'));
app.get('/drivers/{*rest}',   sendTenantHtml('drivers.html'));
app.get('/partners',   sendTenantHtml('partners.html'));
app.get('/partners/{*rest}',  sendTenantHtml('partners.html'));
app.get('/privacy',    sendTenantHtml('privacy.html'));
app.get('/terms',      sendTenantHtml('terms.html'));
app.get('/launch',     sendTenantHtml('launch.html'));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found' });
  next();
});

app.use((req, res) => {
  const notFound = path.join(publicDir, '404.html');
  if (fs.existsSync(notFound)) res.status(404).sendFile(notFound);
  else res.status(404).type('text').send('Not found');
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: isProd ? 'Internal server error' : err.message });
});

app.listen(PORT, () => {
  console.log('');
  console.log('  OddCoop — cooperative same-day device pickup logistics');
  console.log('  Multi-tenant: [slug].oddcoop.com per coop');
  console.log(`  Mode:   ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Local:  http://localhost:${PORT}`);
  console.log(`  Login:  http://localhost:${PORT}/login`);
  console.log(`  Dash:   http://localhost:${PORT}/dashboard`);
  console.log(`  Tip:    Set X-Coop-Slug: wasatchbuybacks header to test your coop`);
  console.log('');
});
