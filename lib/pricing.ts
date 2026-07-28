// Client-side quote estimator for the public seller flow.
// Not authoritative pricing — a realistic demo model.

export const SERVICED_ZIPS = new Set([
  "84401", "84403", "84404", "84405", "84414", "84015", "84010", "84070",
  "84094", "84020", "84043", "84057", "84058", "84601", "84604", "84606",
  "84102", "84103", "84104", "84105", "84106", "84107", "84108", "84111",
  "84115", "84116", "84117", "84119", "84120", "84121", "84123", "84124",
  "84041",
])

export const MODELS: Record<string, { label: string; base: number }[]> = {
  Apple: [
    { label: "iPhone 15 Pro Max", base: 720 },
    { label: "iPhone 15 Pro", base: 640 },
    { label: "iPhone 15", base: 490 },
    { label: "iPhone 14 Pro", base: 520 },
    { label: "iPhone 14", base: 340 },
    { label: "iPhone 13 Pro", base: 430 },
    { label: "iPhone 13", base: 300 },
    { label: "iPhone 12", base: 200 },
  ],
  Samsung: [
    { label: "Galaxy S24 Ultra", base: 560 },
    { label: "Galaxy S24", base: 400 },
    { label: "Galaxy S23 Ultra", base: 430 },
    { label: "Galaxy S23", base: 300 },
    { label: "Galaxy S22 Ultra", base: 310 },
    { label: "Galaxy Z Flip 5", base: 350 },
  ],
  Google: [
    { label: "Pixel 8 Pro", base: 420 },
    { label: "Pixel 8", base: 320 },
    { label: "Pixel 7 Pro", base: 260 },
    { label: "Pixel 7", base: 190 },
  ],
}

export const STORAGE_MULT: Record<string, number> = {
  "64GB": 0.9,
  "128GB": 1,
  "256GB": 1.1,
  "512GB": 1.22,
  "1TB": 1.35,
}

export const CONDITIONS = [
  { id: "excellent", label: "Excellent", mult: 1, desc: "Like new. No scratches, screen flawless, everything works." },
  { id: "good", label: "Good", mult: 0.82, desc: "Light wear. Minor scuffs, no cracks, fully functional." },
  { id: "fair", label: "Fair", mult: 0.62, desc: "Visible wear. Scratches or small dents, screen intact." },
  { id: "poor", label: "Poor", mult: 0.38, desc: "Heavy wear or cracked glass. Powers on and functions." },
] as const

export type ConditionId = (typeof CONDITIONS)[number]["id"]

export type QuoteInput = {
  brand: string
  model: string
  storage: string
  condition: ConditionId
  batteryHealth: number
  unlocked: boolean
  zip: string
}

export type QuoteResult = {
  standard: number
  sameDay: number
  serviced: boolean
  discountPct: number
}

export function estimateQuote(input: QuoteInput): QuoteResult | null {
  const models = MODELS[input.brand]
  if (!models) return null
  const model = models.find((m) => m.label === input.model)
  if (!model) return null

  const cond = CONDITIONS.find((c) => c.id === input.condition)
  const storageMult = STORAGE_MULT[input.storage] ?? 1
  const condMult = cond?.mult ?? 0.8

  // Battery health scales the final 0-15% of value
  const batteryFactor = 0.85 + 0.15 * Math.min(1, Math.max(0.5, input.batteryHealth / 100))
  const lockPenalty = input.unlocked ? 1 : 0.92

  const standard = Math.round(model.base * storageMult * condMult * batteryFactor * lockPenalty)

  const serviced = SERVICED_ZIPS.has(input.zip.trim())
  // Same-day is slightly lower: local coop absorbs pickup + instant payout cost
  const discountPct = serviced ? 8 : 0
  const sameDay = serviced ? Math.round(standard * (1 - discountPct / 100)) : standard

  return { standard, sameDay, serviced, discountPct }
}
