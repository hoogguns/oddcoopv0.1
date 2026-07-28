import type { OrderStatus } from "./status"

export type Order = {
  id: string
  ref: string
  seller: string
  phone: string
  address: string
  city: string
  zip: string
  brand: string
  model: string
  storage: string
  color: string
  condition: "excellent" | "good" | "fair" | "poor"
  standardOffer: number
  sameDayOffer: number
  status: OrderStatus
  crossCoop: boolean
  createdAt: string
  windowStart?: string
  windowEnd?: string
  paymentDeadlineAt?: string
  driver?: string
}

const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString()
const minsAhead = (m: number) => new Date(Date.now() + m * 60000).toISOString()

export const ORDERS: Order[] = [
  {
    id: "ord_10007", ref: "WB-10007", seller: "Pat Garcia", phone: "801-555-2007",
    address: "111 Willow Way", city: "Murray", zip: "84107",
    brand: "Apple", model: "iPhone 15 Pro", storage: "256GB", color: "Natural Titanium",
    condition: "excellent", standardOffer: 620, sameDayOffer: 578, status: "verifying",
    crossCoop: false, createdAt: minsAgo(22), windowStart: minsAgo(10), windowEnd: minsAhead(20),
    paymentDeadlineAt: minsAhead(24), driver: "Sam Rivera",
  },
  {
    id: "ord_10003", ref: "WB-10003", seller: "Riley Davis", phone: "801-555-2003",
    address: "789 Elm Blvd", city: "Sandy", zip: "84070",
    brand: "Apple", model: "iPhone 13 Pro", storage: "256GB", color: "Sierra Blue",
    condition: "excellent", standardOffer: 410, sameDayOffer: 382, status: "en_route",
    crossCoop: false, createdAt: minsAgo(48), windowStart: minsAhead(5), windowEnd: minsAhead(65),
    driver: "Sam Rivera",
  },
  {
    id: "ord_10009", ref: "WB-10009", seller: "Dana Brooks", phone: "801-555-2009",
    address: "42 Foothill Dr", city: "Salt Lake City", zip: "84108",
    brand: "Samsung", model: "Galaxy S24 Ultra", storage: "512GB", color: "Titanium Gray",
    condition: "good", standardOffer: 540, sameDayOffer: 496, status: "verified",
    crossCoop: true, createdAt: minsAgo(72), paymentDeadlineAt: minsAhead(9), driver: "Mia Torres",
  },
  {
    id: "ord_10001", ref: "WB-10001", seller: "Jordan Lee", phone: "801-555-2001",
    address: "123 Main St", city: "Salt Lake City", zip: "84101",
    brand: "Apple", model: "iPhone 14", storage: "128GB", color: "Midnight",
    condition: "good", standardOffer: 320, sameDayOffer: 296, status: "accepted",
    crossCoop: false, createdAt: minsAgo(14), windowStart: minsAhead(45), windowEnd: minsAhead(120),
  },
  {
    id: "ord_10006", ref: "WB-10006", seller: "Sam Johnson", phone: "801-555-2006",
    address: "987 Maple Court", city: "Layton", zip: "84041",
    brand: "Samsung", model: "Galaxy S22 Ultra", storage: "512GB", color: "Burgundy",
    condition: "good", standardOffer: 290, sameDayOffer: 268, status: "notified",
    crossCoop: false, createdAt: minsAgo(4),
  },
  {
    id: "ord_10002", ref: "WB-10002", seller: "Taylor Smith", phone: "801-555-2002",
    address: "456 Oak Ave", city: "Provo", zip: "84601",
    brand: "Samsung", model: "Galaxy S23", storage: "256GB", color: "Phantom Black",
    condition: "fair", standardOffer: 210, sameDayOffer: 189, status: "mismatch",
    crossCoop: false, createdAt: minsAgo(96), driver: "Mia Torres",
  },
  {
    id: "ord_10004", ref: "WB-10004", seller: "Morgan White", phone: "801-555-2004",
    address: "321 Pine Rd", city: "Ogden", zip: "84401",
    brand: "Google", model: "Pixel 7", storage: "128GB", color: "Snow",
    condition: "good", standardOffer: 180, sameDayOffer: 165, status: "shipped",
    crossCoop: false, createdAt: minsAgo(180), driver: "Chris Hall",
  },
  {
    id: "ord_10005", ref: "WB-10005", seller: "Casey Brown", phone: "801-555-2005",
    address: "654 Cedar Lane", city: "Orem", zip: "84058",
    brand: "Apple", model: "iPhone 12", storage: "64GB", color: "White",
    condition: "fair", standardOffer: 155, sameDayOffer: 142, status: "paid",
    crossCoop: false, createdAt: minsAgo(240), driver: "Mia Torres",
  },
  {
    id: "ord_10008", ref: "WB-10008", seller: "Alexis Reed", phone: "801-555-2008",
    address: "220 Center St", city: "Lehi", zip: "84043",
    brand: "Apple", model: "iPhone 15", storage: "128GB", color: "Blue",
    condition: "excellent", standardOffer: 470, sameDayOffer: 438, status: "complete",
    crossCoop: true, createdAt: minsAgo(1440), driver: "Mia Torres",
  },
]

// Territory dashboard: incoming pickup requests to accept
export type PickupRequest = {
  id: string
  ref: string
  seller: string
  city: string
  zip: string
  distanceMi: number
  device: string
  condition: Order["condition"]
  sameDayOffer: number
  windowStart: string
  windowEnd: string
  status: "awaiting_accept" | "accepted" | "en_route" | "inspection_passed" | "complete"
  buyingCoop: string
  createdAt: string
}

export const PICKUP_REQUESTS: PickupRequest[] = [
  {
    id: "pk_2201", ref: "WB-10006", seller: "Sam Johnson", city: "Layton", zip: "84041",
    distanceMi: 3.2, device: "Galaxy S22 Ultra · 512GB", condition: "good", sameDayOffer: 268,
    windowStart: minsAhead(30), windowEnd: minsAhead(120), status: "awaiting_accept",
    buyingCoop: "PhoneCash", createdAt: minsAgo(2),
  },
  {
    id: "pk_2202", ref: "WB-10001", seller: "Jordan Lee", city: "Salt Lake City", zip: "84101",
    distanceMi: 5.8, device: "iPhone 14 · 128GB", condition: "good", sameDayOffer: 296,
    windowStart: minsAhead(45), windowEnd: minsAhead(120), status: "accepted",
    buyingCoop: "Wasatch Buybacks", createdAt: minsAgo(14),
  },
  {
    id: "pk_2203", ref: "WB-10003", seller: "Riley Davis", city: "Sandy", zip: "84070",
    distanceMi: 8.1, device: "iPhone 13 Pro · 256GB", condition: "excellent", sameDayOffer: 382,
    windowStart: minsAhead(5), windowEnd: minsAhead(65), status: "en_route",
    buyingCoop: "Wasatch Buybacks", createdAt: minsAgo(48),
  },
  {
    id: "pk_2204", ref: "WB-10007", seller: "Pat Garcia", city: "Murray", zip: "84107",
    distanceMi: 6.4, device: "iPhone 15 Pro · 256GB", condition: "excellent", sameDayOffer: 578,
    windowStart: minsAgo(10), windowEnd: minsAhead(20), status: "inspection_passed",
    buyingCoop: "Wasatch Buybacks", createdAt: minsAgo(22),
  },
]

export const DRIVERS = [
  { name: "Sam Rivera", code: "DRV-SAM-001", vehicle: "Toyota Camry 2022", zones: ["Salt Lake City", "Sandy", "Murray"], rating: 4.9, status: "available", trained: true },
  { name: "Mia Torres", code: "DRV-MIA-002", vehicle: "Honda Civic 2021", zones: ["Provo", "Orem", "Lehi", "Draper"], rating: 4.8, status: "on_pickup", trained: true },
  { name: "Chris Hall", code: "DRV-CHRIS-003", vehicle: "Ford Focus 2020", zones: ["Ogden", "Layton", "Bountiful"], rating: 4.7, status: "available", trained: true },
]

export type Activity = {
  id: string
  kind: "order" | "payment" | "driver" | "system" | "warning"
  text: string
  at: string
}

export const ACTIVITY: Activity[] = [
  { id: "a1", kind: "warning", text: "Payment deadline approaching for WB-10009 — release same-day ACH within 9 minutes", at: minsAgo(1) },
  { id: "a2", kind: "order", text: "Driver Sam Rivera marked WB-10007 as verifying", at: minsAgo(3) },
  { id: "a3", kind: "order", text: "New order WB-10006 notified to territory coops", at: minsAgo(4) },
  { id: "a4", kind: "payment", text: "Same-day payment of $142 released to Casey Brown (WB-10005)", at: minsAgo(38) },
  { id: "a5", kind: "driver", text: "Mia Torres accepted cross-coop pickup WB-10009", at: minsAgo(44) },
  { id: "a6", kind: "warning", text: "Device mismatch flagged on WB-10002 — battery health below quote", at: minsAgo(96) },
  { id: "a7", kind: "system", text: "WB-10004 shipped to buyer via UPS 1Z999AA10123456784", at: minsAgo(178) },
]

// Partner KPIs
export const KPIS = {
  openOrders: 5,
  verifiedToday: 3,
  awaitingPayment: 2,
  crossCoopOrders: 2,
  latePaymentStrikes: 1,
}

// Economics summary (SaaS plan)
export const ECONOMICS = {
  plan: "Pilot (Growth)",
  includedOrders: 500,
  ordersThisPeriod: 128,
  platformFee: 0,
  overageFees: 0,
  sameDayPays: 46,
  sameDayVolume: 14820,
  avgOffer: 322,
  blendedMargin: 18.4,
}

export const STANDING = {
  status: "good" as "good" | "probation" | "suspended",
  onTimePaymentRate: 98.2,
  strikes: 1,
  strikeLimit: 3,
}
