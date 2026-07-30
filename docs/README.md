# OddCoop — Technical Documentation

## Contents

| Document | Description |
|---|---|
| [architecture.md](architecture.md) | System architecture, module map, data flow |
| [api.md](api.md) | REST API reference — endpoints, auth, request/response shapes |
| [websocket.md](websocket.md) | WebSocket protocol — subscribe, events, reconnect behaviour |
| [database.md](database.md) | JSON data store schema, query API, migration path to SQLite |

---

## Quick start

```bash
npm install
cp .env.example .env    # set JWT_SECRET
npm run seed            # populate demo data
npm run dev             # start with nodemon
```

Server: http://localhost:3847  
Health: http://localhost:3847/api/health  
WS:     ws://localhost:3847/ws

## Sprint status

| Sprint | Deliverable | Status |
|---|---|---|
| Sprint 1 | Bootstrap — server, config, logger, health, WebSocket | ✅ Complete |
| Sprint 2.1 | Public buyback experience — device catalog, quote engine, 5-step quote flow, order creation | ✅ Complete |
| Sprint 3 | Coop network — ZIP fix, API URL audit, standing endpoints, admin scaffold, cross-coop seed, WS dashboard, Network view | ✅ Complete |
| Sprint 4 | Driver portal — IMEI checklist wizard, randomized questions, signature pad | 🔜 Next |
| Sprint 5 | Admin portal — order mgmt, suspensions, audit log, metrics UI | 🔜 Planned |
| Sprint 6 | Production features — dispatch APIs, shipping labels, notifications | 🔜 Planned |

## Demo credentials

| Role | Email | Password |
|---|---|---|
| Partner (Coop A) | `partner@wasatchbuybacks.demo` | `demo1234` |
| Partner (Coop R) | `partner@milehighdevices.demo` | `demo1234` |
| Partner (warning) | `ops@phonecash.demo` | `demo1234` |
| Driver | `sam.driver@oddcoop.demo` | `driver1234` |
| Driver | `mia.driver@oddcoop.demo` | `driver1234` |
