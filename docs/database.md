# OddCoop — Database Abstraction

## Current implementation: JSON file store

All data is persisted to `data/oddcoop.json`.
The store is loaded into memory on startup and flushed to disk on every write.

**Atomic writes:** The save function writes to `oddcoop.json.tmp` then renames
atomically — a hard-kill mid-write cannot corrupt the file.

## Collections (tables)

| Collection | Description |
|---|---|
| `partners` | Buying coop accounts (company, email, plan, api_key, standing) |
| `drivers` | Pickup drivers (zones, rating, vehicle, trained status) |
| `orders` | Device buyback orders (full lifecycle) |
| `order_events` | Immutable audit log — every status change, payment, dispatch event |
| `coops` | DB-registered coop territories (supplements static tenants config) |
| `partner_integrations` | Roadie / Shipt / webhook connections per partner |
| `dispatch_jobs` | Gig-platform job records |
| `checklist_templates` | Partner-owned door inspection form templates |
| `leads` | Unauthenticated lead form submissions |

## Query API

The store exposes a `better-sqlite3`-compatible interface:

```js
const { getDb } = require('./server/db');
const db = getDb();

// Single row
const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(id);

// All rows
const orders = db.prepare('SELECT * FROM orders WHERE partner_id = ?').all(partnerId);

// Write
db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(newStatus, orderId);

// Named parameters
db.prepare('INSERT INTO orders (@id, @status) VALUES (@id, @status)').run({ id, status });
```

## Direct data access (internal only)

```js
const data = db._data();       // raw JS object — read/mutate directly
db._replace(data);             // atomically replace + persist
db._reload();                  // reload from disk (after external write)
```

## Migration to SQLite

The query API matches `better-sqlite3` exactly. To migrate:

1. Install `better-sqlite3`: `npm install better-sqlite3`
2. Replace `server/db.js` with a thin `better-sqlite3` wrapper
3. Write a one-time migration script that reads `oddcoop.json` and INSERTs rows
4. Update `DB_PATH` env var to point to `oddcoop.sqlite`

No route or service code changes are required — they all use the same
`db.prepare().get/all/run()` interface.

## Migration to PostgreSQL

For PostgreSQL, replace `server/db.js` with a `pg` or `postgres` adapter that
exposes the same API. The main difference is async — you would need to make
routes `async` and `await` all db calls, but the query structure stays the same.

## Schema reference

### orders

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `partner_id` | UUID | Buying partner |
| `driver_id` | UUID | Assigned driver (null if unassigned) |
| `external_ref` | string | Partner's own order number |
| `status` | string | One of the 12 lifecycle statuses |
| `seller_name` | string | |
| `seller_phone` | string | |
| `pickup_address` | string | |
| `pickup_zip` | string | Used for territory resolution |
| `device_brand` | string | |
| `device_model` | string | |
| `quoted_amount` | number | Seller offer (actual payment amount) |
| `expected_specs` | JSON | Partner's quoted specs (spec-lock) |
| `verified_specs` | JSON | Driver's observed specs (null until verify) |
| `verification_match` | bool/null | null = not yet verified |
| `door_checklist` | JSON | Checklist template snapshot |
| `payment_deadline_at` | ISO | 1-hour window after verification |
| `paid` | bool | |
| `buying_coop_id` | UUID | Cross-coop: the ordering partner |
| `pickup_coop_slug` | string | Cross-coop: the pickup territory |
| `coop_accept_required` | bool | Whether Coop R must formally accept |
