import { Card, Badge, Button } from "@/components/ui"
import { ECONOMICS, STANDING, ACTIVITY, ORDERS } from "@/lib/data"
import { formatCurrency, formatRelativeTime, formatDeadline, cn } from "@/lib/utils"
import { IconDollar, IconAlert, IconTruck, IconCheck, IconClock } from "@/components/icons"

export function StandingCard() {
  const pct = STANDING.onTimePaymentRate
  const toneLabel =
    STANDING.status === "good" ? "Good standing" : STANDING.status === "probation" ? "Probation" : "Suspended"
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Coop standing</h3>
        <Badge tone={STANDING.status === "good" ? "success" : "warning"}>{toneLabel}</Badge>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">On-time same-day payment rate</p>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-3xl font-semibold tracking-tight text-foreground">{pct}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
        <span className="text-sm text-muted-foreground">Late-payment strikes</span>
        <span className="text-sm font-medium text-foreground">
          {STANDING.strikes} / {STANDING.strikeLimit}
        </span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Three strikes in a rolling 90 days moves your coop to probation and pauses new order routing.
      </p>
    </Card>
  )
}

export function EconomicsCard() {
  const usagePct = Math.round((ECONOMICS.ordersThisPeriod / ECONOMICS.includedOrders) * 100)
  const rows = [
    { label: "Plan", value: ECONOMICS.plan },
    { label: "Orders this period", value: `${ECONOMICS.ordersThisPeriod} / ${ECONOMICS.includedOrders}` },
    { label: "Same-day payouts", value: `${ECONOMICS.sameDayPays}` },
    { label: "Same-day volume", value: formatCurrency(ECONOMICS.sameDayVolume) },
    { label: "Avg. offer", value: formatCurrency(ECONOMICS.avgOffer) },
    { label: "Blended margin", value: `${ECONOMICS.blendedMargin}%` },
  ]
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <IconDollar className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">SaaS economics</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        OddCoop charges a flat platform subscription — never a cut of your margin.
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${usagePct}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{usagePct}% of included order volume used</p>
      <dl className="mt-4 divide-y divide-border">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-2 text-sm">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="font-medium text-foreground">{r.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

export function PaymentQueue() {
  const queue = ORDERS.filter((o) => o.status === "verified" && o.paymentDeadlineAt)
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <IconClock className="h-5 w-5 text-warning" />
        <h3 className="font-semibold text-foreground">Payment queue</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Verified devices awaiting same-day ACH release.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {queue.map((o) => {
          const d = formatDeadline(o.paymentDeadlineAt!)
          return (
            <div
              key={o.id}
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{o.ref}</p>
                <p className="text-xs text-muted-foreground">
                  {o.seller} · {formatCurrency(o.sameDayOffer)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span
                  className={cn(
                    "text-xs font-medium",
                    d.overdue ? "text-destructive" : d.urgent ? "text-warning" : "text-muted-foreground",
                  )}
                >
                  {d.label}
                </span>
                <Button size="sm">Release ACH</Button>
              </div>
            </div>
          )
        })}
        {queue.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No payments due right now.</p>
        )}
      </div>
    </Card>
  )
}

const KIND_META: Record<string, { tone: string; Icon: typeof IconCheck }> = {
  order: { tone: "text-primary", Icon: IconTruck },
  payment: { tone: "text-success", Icon: IconDollar },
  driver: { tone: "text-primary", Icon: IconTruck },
  system: { tone: "text-muted-foreground", Icon: IconCheck },
  warning: { tone: "text-warning", Icon: IconAlert },
}

export function ActivityFeed() {
  return (
    <Card className="p-5">
      <h3 className="font-semibold text-foreground">Activity</h3>
      <ol className="mt-4 flex flex-col gap-4">
        {ACTIVITY.map((a) => {
          const meta = KIND_META[a.kind] ?? KIND_META.system
          const Icon = meta.Icon
          return (
            <li key={a.id} className="flex gap-3">
              <span className={cn("mt-0.5 shrink-0", meta.tone)}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm leading-snug text-foreground">{a.text}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatRelativeTime(a.at)}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
