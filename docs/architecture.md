# OddCoop — Architecture Overview

## System diagram

```
Browser / API client
      │
      ├── HTTP  ──────► server.js (entry)
      │                      │
      │                      ├── server/app.js          (Express factory)
      │                      │     ├── helmet            security headers
      │                      │     ├── compression       gzip responses
      │                      │     ├── cors              cross-origin headers
      │                      │     ├── logger.js         request ID + timing
      │                      │     ├── json / urlencoded body parsers
      │                      │     ├── static            /public/*
      │                      │     ├── tenant resolver   req.tenant from Host
      │                      │     ├── rate limiters     auth / lead / public
      │                      │     ├── /api/health       health.js
      │                      │     ├── /api/auth         auth.js
      │                      │     ├── /api/coop         coop.js
      │                      │     ├── /api/orders       orders.js
      │                      │     ├── /api/public       public.js
      │                      │     ├── page routes       /login /dashboard /drivers /join
      │                      │     ├── notFound          404 handler
      │                      │     └── errorHandler      global error handler
      │                      │
      │                      └── server/websocket/wsServer.js
      │
      └── WebSocket ──► ws://host/ws  (same HTTP server, path /ws)
```

## Module map

```
server.js                   Entry point — wires HTTP + WS + shutdown
server/
  app.js                    Express factory (middleware stack)
  config/
    config.js               Centralised env configuration (one import for all env vars)
    pricing.js              SaaS plan definitions + invoice/margin calculations
    tenants.js              Multi-tenant registry (static + DB-backed)
  db.js                     JSON file store with SQL-like query interface
  seed.js                   Demo data seeding
  middleware/
    auth.js                 JWT sign/verify + API-key auth + requireAuth(role)
    logger.js               Structured request logger (req-id, timing, actor)
    errorHandler.js         404 notFound + global error handler
    requireTenant.js        X-Coop-Slug / subdomain tenant resolution
  routes/
    health.js               GET /api/health
    auth.js                 POST /api/auth/partner/login|register, /driver/login
    coop.js                 GET/POST /api/coop/* (territory, cross-coop)
    orders.js               Full order lifecycle — partner + driver endpoints
    public.js               Unauthenticated stats, coverage, lead capture
  services/
    orders.js               Order business logic (create, status, verify, pay)
    status.js               Status state machine + actor permissions
    checklists.js           Partner-owned door inspection templates
    network.js              Cross-coop territory resolution + driver dispatch
    notify.js               WS broadcast + HTTP webhook for coop events
    dispatch.js             Gig-platform connectors (Roadie, Shipt, manual, webhook)
  websocket/
    wsServer.js             WebSocket server factory + broadcast helpers
public/
  index.html                Marketing homepage
  dashboard.html            Partner operations dashboard
  drivers.html              Driver mobile portal
  login.html                Auth page
  join.html                 Coop network onboarding
  css/site.css              Design system (dark-first, teal accent)
  js/
    api.js                  Frontend API client (fetch wrapper + token mgmt)
    site.js                 Shared utilities (theme, WS, signature pad, toast)
    dashboard.js            Partner dashboard view logic
    drivers.js              Driver portal view logic
data/
  oddcoop.json              JSON data store (gitignored)
storage/                    File uploads / generated assets (gitignored)
docs/                       Technical documentation
```

## Request lifecycle

```
Request arrives
    │
    ├─► helmet          — set security headers
    ├─► compression     — compress response body
    ├─► cors            — CORS headers
    ├─► logger          — attach req.id, start timer
    ├─► json parser     — parse body
    ├─► static          — serve public files (returns early if matched)
    ├─► tenant resolver — attach req.tenant
    ├─► rate limiter    — check limits (returns 429 if exceeded)
    ├─► route handler   — business logic
    │       └─► auth middleware — verify JWT / API key → populate req.user
    ├─► logger finish   — log line on res.finish
    └─► errorHandler    — catch any thrown error → JSON response
```

## Event-driven flows

Business events flow through the system as a combination of:
1. **DB writes** — order_events table records every state change with actor + detail
2. **WebSocket broadcasts** — real-time push to subscribed dashboard clients
3. **HTTP webhooks** — async POST to partner `notify_url` for offline coops

### Order created → cross-coop notification

```
POST /api/orders/partner/orders
    │
    ├─► orders.createOrder()
    │     └─► coopsForZip(pickup_zip) → resolve pickup_coop_slug
    │
    └─► orders.js route
          └─► notifyCoopR(order)
                ├─► broadcastToSlug(pickup_coop_slug, payload)   ← WebSocket
                └─► safePost(coop.notify_url, payload)           ← HTTP webhook
```

### Device verified → payment timer

```
POST /api/orders/driver/orders/:id/verify
    │
    └─► orders.verifyDevice()
          ├─► compare observed_specs vs expected_specs
          ├─► status = 'verified' | 'mismatch'
          ├─► payment_deadline_at = now + 1hr  (if verified)
          └─► notifyCoopA(order, 'inspection_passed')
```

## Data store

The current data layer is a JSON file store (`data/oddcoop.json`) with a
SQL-like query interface that emulates `better-sqlite3` method signatures:

```js
db.prepare(sql).get(...params)     // single row
db.prepare(sql).all(...params)     // all rows
db.prepare(sql).run(...params)     // INSERT / UPDATE / DELETE
```

This makes migration to SQLite or PostgreSQL a single-file swap (`server/db.js`)
without touching any route or service code.

See [database.md](database.md) for the full schema and migration guide.
