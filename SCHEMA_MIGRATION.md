# Schema Migration Log

## v0.2 — Cross-Coop Fields (2026-07-27)

### Overview
This migration adds all fields required to support the full OddCoop cross-cooperative transaction model, dual-offer pricing, IMEI gate enforcement, payment deadline tracking, coop standing enforcement, and outbound shipping label storage.

The database is a JSON file store (`data/oddcoop.json`). Migrations are **non-destructive** — the `migrate()` function in `db.js` back-fills any missing fields on existing rows at startup.

---

### Orders — New Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `buying_coop_id` | string | `null` | partner_id of Coop A (purchasing partner — alias of partner_id) |
| `pickup_coop_slug` | string | `null` | slug of Coop R (territory owner) |
| `pickup_coop_id` | string | `null` | partner_id of Coop R (resolved from slug) |
| `coop_accept_required` | 0/1 | `0` | 1 when this is a cross-coop transaction requiring Coop R acceptance |
| `pickup_coop_accepted_at` | ISO string | `null` | When Coop R formally accepted the pickup |
| `seller_offer_standard` | number | `null` | Full mail-in quote (e.g. $455) |
| `seller_offer_sameday` | number | `null` | Discounted sameday payout (default: 75% of standard) |
| `seller_chose_sameday` | 0/1 | `0` | 1 if seller opted for sameday pickup & discounted pay |
| `payment_method_seller` | string | `null` | How seller wants to be paid: venmo/zelle/cashapp/ach/check |
| `payment_deadline_at` | ISO string | `null` | Coop A must pay within 1hr of inspection_passed_at |
| `payment_late_strikes` | number | `0` | Per-order count of missed deadlines (also tracked on partner) |
| `imei_attempts` | number | `0` | How many times driver has attempted IMEI entry |
| `imei_locked` | 0/1 | `0` | 1 after 8 failed IMEI attempts — order auto-cancelled |
| `inspection_passed_at` | ISO string | `null` | Timestamp when driver submitted passing Device Match |
| `driver_signature` | JSON string | `null` | `{ name, signed_at, checkboxes: [] }` |
| `shipping_label_url` | string | `null` | Coop A's prepaid outbound label URL or base64 PDF |
| `shipping_carrier_preference` | string | `null` | usps / ups / fedex |
| `tracking_number_outbound` | string | `null` | Outbound tracking number (distinct from inbound) |

---

### Partners — New Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `coop_standing` | string | `'good'` | good / probation / suspended |
| `late_payment_strikes` | number | `0` | Increments each time Coop A misses the 1hr payment window |
| `probation_at` | ISO string | `null` | Timestamp when placed on probation (at 3 strikes) |
| `suspended_at` | ISO string | `null` | Timestamp when suspended |
| `notify_url` | string | `null` | Webhook URL for cross-coop order pings (used in next sprint) |
| `territory_zip_codes` | JSON string | `'[]'` | ZIP codes this coop services |

---

### DB Top-Level Collections

| Collection | Notes |
|---|---|
| `coops[]` | Registered OddCoop members from `POST /api/coop/register`. Was previously stored ad-hoc. |

---

### Business Logic Changes

**`createOrder()`**
- Accepts `pickup_coop_slug`, `pickup_coop_id`, `seller_offer_sameday`, `seller_chose_sameday`, `payment_method_seller`, `shipping_carrier_preference`
- Auto-calculates sameday offer at 75% of standard if not explicitly set
- Sets `buying_coop_id = partnerId`, `coop_accept_required = 1` when `pickup_coop_slug` differs from `partnerId`
- `quoted_amount` reflects the effective amount (sameday rate if seller chose sameday)

**`verifyDevice()`** (Phase 1 / Phase 2 split)
- Phase 1: `{ imei_attempt: "<IMEI>" }` — validates IMEI, increments counter, locks + cancels at 8 fails
- Phase 2: `{ observed_specs, checklist, driver_signature, packed }` — full checklist submission
- Sets `payment_deadline_at` (1hr from now) and `inspection_passed_at` on match

**`processPayment()`**
- Detects late payment (`now > payment_deadline_at`)
- Calls `_recordLatePaymentStrike()` on Coop A if late
- `_recordLatePaymentStrike()` places Coop A on `probation` at 3 cumulative strikes

**`updateStatus()`**
- Sets `payment_deadline_at` and `inspection_passed_at` when transitioning to `verified`

---

### Next Steps
1. `POST /api/coop/orders/:id/notify` — push notification to Coop R (WebSocket + webhook)
2. `POST /api/coop/orders/:id/accept` — Coop R formal acceptance
3. Background timer to flag overdue payments (cron / setInterval)
4. Shipping label on-demand API (USPS / UPS / FedEx)
