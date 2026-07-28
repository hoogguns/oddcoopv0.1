"use client"

import { useMemo, useState } from "react"
import {
  BadgeCheck,
  Battery,
  Clock,
  Loader2,
  MapPin,
  ShieldCheck,
  Truck,
  Zap,
} from "lucide-react"
import { Button, Card, Field, Input, Select } from "@/components/ui"
import {
  CONDITIONS,
  MODELS,
  STORAGE_MULT,
  estimateQuote,
  type ConditionId,
  type QuoteResult,
} from "@/lib/pricing"
import { formatCurrency, cn } from "@/lib/utils"

const COLORS = ["Midnight", "Starlight", "Blue", "Natural Titanium", "Phantom Black", "White", "Snow", "Burgundy"]

export function QuoteForm() {
  const [brand, setBrand] = useState("Apple")
  const [model, setModel] = useState("")
  const [storage, setStorage] = useState("128GB")
  const [color, setColor] = useState("")
  const [unlocked, setUnlocked] = useState(true)
  const [condition, setCondition] = useState<ConditionId>("good")
  const [battery, setBattery] = useState(90)
  const [imei, setImei] = useState("")
  const [zip, setZip] = useState("")

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<QuoteResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const models = MODELS[brand] ?? []
  const activeCondition = CONDITIONS.find((c) => c.id === condition)!
  const conditionIndex = CONDITIONS.findIndex((c) => c.id === condition)

  const imeiValid = useMemo(() => /^\d{15}$/.test(imei.replace(/\s/g, "")), [imei])

  function reset() {
    setResult(null)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!model) return setError("Please select your device model.")
    if (!/^\d{5}$/.test(zip.trim())) return setError("Enter a valid 5-digit ZIP code.")
    if (imei && !imeiValid) return setError("IMEI must be 15 digits. Leave blank if unsure.")

    setLoading(true)
    setResult(null)
    // Simulate network latency for a realistic loading state
    await new Promise((r) => setTimeout(r, 900))
    const quote = estimateQuote({ brand, model, storage, condition, batteryHealth: battery, unlocked, zip })
    setLoading(false)

    if (!quote) {
      setError("We couldn't price that device. Double-check the model and try again.")
      return
    }
    setResult(quote)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
      {/* Form */}
      <Card className="p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Brand">
              <Select
                value={brand}
                onChange={(e) => {
                  setBrand(e.target.value)
                  setModel("")
                  reset()
                }}
              >
                {Object.keys(MODELS).map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </Select>
            </Field>
            <Field label="Model">
              <Select
                value={model}
                onChange={(e) => {
                  setModel(e.target.value)
                  reset()
                }}
              >
                <option value="">Select a model</option>
                {models.map((m) => (
                  <option key={m.label}>{m.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Storage">
              <Select value={storage} onChange={(e) => setStorage(e.target.value)}>
                {Object.keys(STORAGE_MULT).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <Field label="Color">
              <Select value={color} onChange={(e) => setColor(e.target.value)}>
                <option value="">Select a color</option>
                {COLORS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Carrier status">
            <div className="grid grid-cols-2 gap-2">
              <ToggleChip active={unlocked} onClick={() => setUnlocked(true)} label="Unlocked" />
              <ToggleChip active={!unlocked} onClick={() => setUnlocked(false)} label="Carrier locked" />
            </div>
          </Field>

          {/* Condition meter */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Condition</span>
              <span className="text-xs font-medium text-primary">{activeCondition.label}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Device condition">
              {CONDITIONS.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCondition(c.id)}
                  aria-pressed={condition === c.id}
                  className={cn(
                    "h-2 rounded-full transition-colors",
                    i <= conditionIndex ? "bg-primary" : "bg-border",
                  )}
                >
                  <span className="sr-only">{c.label}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {CONDITIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCondition(c.id)}
                  className={cn(
                    "rounded-md px-1 py-1 text-[11px] font-medium transition-colors",
                    condition === c.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="rounded-lg bg-secondary/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {activeCondition.desc}
            </p>
          </div>

          {/* Battery health */}
          <Field label="Battery health" hint={`${battery}% maximum capacity`}>
            <div className="flex items-center gap-3">
              <Battery className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="range"
                min={60}
                max={100}
                value={battery}
                onChange={(e) => setBattery(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
                aria-label="Battery health percentage"
              />
              <span className="w-10 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">
                {battery}%
              </span>
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="IMEI" hint="Optional — dial *#06# to find it">
              <Input
                inputMode="numeric"
                placeholder="15-digit IMEI"
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                aria-invalid={!!imei && !imeiValid}
              />
            </Field>
            <Field label="ZIP code" hint="We check for a local coop near you">
              <Input
                inputMode="numeric"
                placeholder="e.g. 84101"
                value={zip}
                maxLength={5}
                onChange={(e) => {
                  setZip(e.target.value.replace(/\D/g, ""))
                  reset()
                }}
              />
            </Field>
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive-muted px-3 py-2 text-sm text-destructive-foreground">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Calculating offers…
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" /> Get my offers
              </>
            )}
          </Button>
        </form>
      </Card>

      {/* Result */}
      <div className="lg:sticky lg:top-24">
        <OfferPanel loading={loading} result={result} model={model} storage={storage} zip={zip} />
      </div>
    </div>
  )
}

function ToggleChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-10 rounded-lg border text-sm font-medium transition-colors",
        active
          ? "border-primary bg-accent text-accent-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  )
}

function OfferPanel({
  loading,
  result,
  model,
  storage,
  zip,
}: {
  loading: boolean
  result: QuoteResult | null
  model: string
  storage: string
  zip: string
}) {
  if (loading) {
    return (
      <Card className="flex flex-col gap-4 p-6">
        <div className="h-4 w-24 animate-pulse rounded bg-border" />
        <div className="h-12 w-40 animate-pulse rounded bg-border" />
        <div className="h-24 w-full animate-pulse rounded-lg bg-border" />
        <div className="h-24 w-full animate-pulse rounded-lg bg-border" />
      </Card>
    )
  }

  if (!result) {
    return (
      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
          <BadgeCheck className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-foreground">Your offers appear here</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Fill in your device details and we&apos;ll show a standard offer and, if a coop serves your
          ZIP, a same-day offer with instant payment.
        </p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4 animate-oc-slide-in">
      <p className="text-sm text-muted-foreground">
        Offers for <span className="font-medium text-foreground">{model || "your device"}</span>
        {storage ? ` · ${storage}` : ""}
      </p>

      {/* Standard offer */}
      <Card className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Truck className="h-4 w-4" /> Standard offer
            </div>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
              {formatCurrency(result.standard)}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Ship it free with a prepaid label. Payment issues after the device is received and
          inspected — typically 2–4 business days.
        </p>
      </Card>

      {/* Same-day offer */}
      {result.serviced ? (
        <Card className="border-primary/50 bg-accent/40 p-5 ring-1 ring-primary/20">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Zap className="h-4 w-4" /> Same-day offer
              </div>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
                {formatCurrency(result.sameDay)}
              </p>
            </div>
            <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
              Coop nearby
            </span>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-card/70 px-3 py-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              A local partner coop picks up your device today and pays you on the spot. The offer is{" "}
              <span className="font-medium text-foreground">{result.discountPct}% lower</span> than
              standard because the coop absorbs pickup and immediate-payment costs.
            </p>
          </div>
          <Button size="lg" className="mt-4 w-full">
            Continue with same-day sale
          </Button>
        </Card>
      ) : (
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <MapPin className="h-4 w-4" /> No coop in {zip} yet
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Same-day pickup isn&apos;t available in your area right now. You can still take the
            standard offer and ship for free, and we&apos;ll notify you when a coop joins your ZIP.
          </p>
          <Button size="lg" variant="secondary" className="mt-4 w-full">
            Continue with standard offer
          </Button>
        </Card>
      )}

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        Offers are locked for 14 days. No obligation.
      </div>
    </div>
  )
}
