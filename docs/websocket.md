# OddCoop — WebSocket Protocol

## Connection

Connect to `ws://<host>/ws` (or `wss://` in production).

```js
const ws = new WebSocket('ws://localhost:3847/ws');
```

## Subscribe

After connecting, send a subscribe message within 30 seconds:

```json
{ "type": "subscribe", "partnerId": "coop_abc123" }
```

**Fields:**

| Field | Required | Description |
|---|---|---|
| `type` | ✅ | Must be `"subscribe"` |
| `partnerId` | One of | Partner UUID (from JWT payload) |
| `coopSlug` | One of | Coop slug (e.g. `"wasatchbuybacks"`) |

If only `partnerId` is provided the server automatically resolves the coop slug
from the database and subscribes to both channels, so broadcasts reach the client
regardless of which key services use when sending.

**Server acknowledgement:**
```json
{
  "type": "subscribed",
  "partnerId": "uuid",
  "coopSlug": "wasatchbuybacks",
  "channels": ["uuid", "wasatchbuybacks"]
}
```

## Keepalive

Send a ping any time; the server replies immediately:

```json
{ "type": "ping" }
→ { "type": "pong" }
```

## Events

### `coopR_new_order`
Sent to Coop R when a new cross-coop pickup order is assigned to their territory.

```json
{
  "type":     "coopR_new_order",
  "sound":    "ding_dong",
  "order_id": "uuid",
  "order": {
    "id":               "uuid",
    "status":           "pending",
    "seller_name":      "Jordan Lee",
    "pickup_address":   "123 Main St",
    "pickup_city":      "Salt Lake City",
    "pickup_zip":       "84101",
    "device_brand":     "Apple",
    "device_model":     "iPhone 14",
    "device_storage":   "128GB",
    "device_condition": "good",
    "buying_coop_name": "PhoneCash"
  },
  "message":  "New pickup order in your territory — accept before 20:00 local time",
  "sent_at":  "2026-07-29T18:22:15.000Z"
}
```

### `coopA_order_accepted`
Sent to Coop A when Coop R formally accepts the order.

```json
{
  "type":    "coopA_order_accepted",
  "order_id": "uuid",
  "message": "Coop R has accepted the pickup for order uuid",
  "sent_at": "2026-07-29T18:30:00.000Z"
}
```

### `coopA_inspection_passed`
Sent to Coop A when the driver completes a passing verification.
Starts the 1-hour payment deadline clock.

```json
{
  "type":                 "coopA_inspection_passed",
  "order_id":             "uuid",
  "payment_deadline_at":  "2026-07-29T19:30:00.000Z",
  "message":              "Device inspection PASSED — you have 1 hour to pay the seller",
  "sent_at":              "2026-07-29T18:30:00.000Z"
}
```

### `coopA_inspection_mismatch`
Sent to Coop A when the device does not match the quoted specs.

```json
{
  "type":    "coopA_inspection_mismatch",
  "order_id": "uuid",
  "message": "Device inspection FAILED — review required before payment",
  "sent_at": "2026-07-29T18:30:00.000Z"
}
```

## Auto-reconnect example (vanilla JS)

```js
function connectWS(partnerId, onEvent) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'subscribe', partnerId }));
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      onEvent(msg);
    } catch {}
  };

  // Reconnect on close (Render spins down idle instances)
  ws.onclose = () => setTimeout(() => connectWS(partnerId, onEvent), 3000);

  return ws;
}
```
