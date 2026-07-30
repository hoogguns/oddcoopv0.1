# OddCoop

**Same-day device pickup logistics for online buyback stores.**

Pilot market: **Salt Lake City metro — Wasatch Front (Ogden → Salt Lake City → Provo), Utah.**

OddCoop connects cell phone / device buyback websites with sellers at home via trained gig-economy drivers. Drivers verify the device against the buyback site's quoted specs, pack it to SOP, and unlock **same-day seller payment** when everything matches — a competitive edge in a crowded mail-in market.

| Surface | URL (local) | Audience |
|--------|-------------|----------|
| Marketing site | http://localhost:3847/ | Sellers, partners, press |
| Partner dashboard | http://localhost:3847/dashboard | Buyback website operators |
| Partner onboarding | http://localhost:3847/partners | New buyback partners |
| Driver portal | http://localhost:3847/drivers | Trained gig drivers |
| Login | http://localhost:3847/login | Partners & drivers |
| Pricing | http://localhost:3847/partners#pricing | Partner pricing sheet |
| Economics | http://localhost:3847/dashboard#economics | Live invoice + profit + calculator |
| Launch checklist | http://localhost:3847/launch | Internal go-live list |
| REST API | http://localhost:3847/api/* | Integrations |

## Why this product

- **Buyback sites** need faster cash-to-seller without taking on blind fraud risk.
- **Sellers** abandon quotes when payout is "7–14 days after we receive the phone."
- **OddCoop** inserts doorstep verification + packing so payment can fire the same day **only after a match**.

## Stack

- **Backend:** Node.js, Express, JSON file store, JWT + API keys
- **Frontend:** Dense static HTML/CSS/JS (no build step) served by Express
- **Auth:** Partner JWT / `X-API-Key`, Driver JWT

## Quick start

```bash
npm install
cp .env.example .env
npm run seed
npm start
```

Open http://localhost:3847

### Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Partner | `partner@wasatchbuybacks.demo` | `demo1234` |
| Driver | `sam.driver@oddcoop.demo` | `driver1234` |

Reset demo data:

```bash
npm run db:reset
```

## Deploy to Production (Render)

The repo includes a `render.yaml` Blueprint — Render reads it automatically.

### One-time setup

1. Go to **[dashboard.render.com](https://dashboard.render.com)** → sign in with GitHub
2. Click **New → Blueprint** → select `hoogguns/oddcoopv0.1`
3. Render detects `render.yaml` and pre-fills all settings
4. Click **Apply** — build and deploy starts automatically
5. Live URL: `https://oddcoop.onrender.com`

### What render.yaml configures automatically

| Setting | Value |
|---------|-------|
| Runtime | Node |
| Build command | `npm install` |
| Start command | `npm start` |
| Region | Oregon |
| Health check | `GET /api/health` |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Auto-generated on first deploy |
| `DB_PATH` | `/var/data/oddcoop.json` |

### Free plan notes

- Service spins down after 15 min idle — ~30s cold start on first request
- **DB resets on every redeploy** (persistent disk requires Starter plan, $7/mo)
- Export order data before pushing updates during pilot

### Enable persistent DB (when ready)

Uncomment the `disk:` block in `render.yaml` and upgrade to Starter plan:

```yaml
    disk:
      name: oddcoop-data
      mountPath: /var/data
      sizeGB: 1
```

### Dev → Prod workflow

```
Local (dev)  ──git push──►  GitHub main  ──auto-deploy──►  Render (prod)
```

Every merge to `main` triggers a new Render deploy. No manual steps required.

### Custom domain (optional)

In Render dashboard → your service → **Settings → Custom Domains** → add your domain and point a CNAME to `oddcoop.onrender.com`.

---

## Order lifecycle

```
pending → assigned → en_route → picked_up → verifying → verified → paid
                                              ↘ mismatch (pay held)
```

1. Buyback partner creates an order (dashboard or API) with `expected_specs` and `quoted_amount`.
2. Trained driver claims / is assigned and goes en route.
3. Driver picks up, runs verification checklist, packs device.
4. **Match** → `verified` → partner releases same-day pay.
5. **Mismatch** → `mismatch` → partner reviews before any funds move.

## Partner API (highlights)

```http
POST /api/auth/partner/login
POST /api/partner/orders
GET  /api/partner/orders
GET  /api/partner/orders/:id
POST /api/partner/orders/:id/pay
POST /api/partner/orders/:id/assign
GET  /api/partner/stats
GET  /api/partner/economics
GET  /api/partner/pricing
GET  /api/partner/drivers
GET  /api/pricing
```

Authenticate with `Authorization: Bearer <token>` or `X-API-Key: dl_live_…`.

## How OddCoop makes money

Partners pay **platform + per completed pickup** (see `/partners#pricing`).  
Your cost is mainly **driver + pack kit + risk + ops** (~$27 default; override with `COGS_*` env vars).  

**Contribution** = partner invoice − COGS on completed pickups.  
The partner dashboard **This month · money** panel shows both **their spend** and **your estimated profit** on their volume.

## Launch

1. Set a strong `JWT_SECRET` and `NODE_ENV=production` on the host.  
2. Walk `/launch` checklist.  
3. Create a real partner account (or use demo seed only for demos).  
4. Point a domain at the Node process (or put it behind a reverse proxy).  
5. Review `/privacy` and `/terms` with counsel before scale.

```bash
npm install
cp .env.example .env
# edit JWT_SECRET, COGS_*, PORT
npm start
```

Public endpoints:

```http
GET  /api/health
GET  /api/coverage
GET  /api/stats
GET  /api/how-it-works
POST /api/leads
```

## Project layout

```
oddcoopv0.1/
  server/           Express API, JSON DB, seed
  public/           Marketing + partner + driver UIs
  data/             JSON DB (gitignored)
  render.yaml       Render Blueprint (production)
  package.json
  README.md
```

## Market

- **State:** Utah  
- **Corridor:** Ogden · Layton · Bountiful · Salt Lake City · Murray · Sandy · Draper · Lehi · Orem · Provo  
- **Model:** Gig drivers + OddCoop buyback training (packing, locks, condition grades)
- **Q4 expansion:** Las Vegas · Phoenix

## Repo

https://github.com/hoogguns/oddcoopv0.1

## License

MIT
