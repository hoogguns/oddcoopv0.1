"use client"

import { useMemo, useState } from "react"
import { Card, StatusBadge, Badge } from "@/components/ui"
import { ORDERS } from "@/lib/data"
import { formatCurrency, formatRelativeTime, cn } from "@/lib/utils"

const FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "awaiting_payment", label: "Awaiting payment" },
  { key: "cross", label: "Cross-coop" },
] as const

type FilterKey = (typeof FILTERS)[number]["key"]

const OPEN_STATUSES = ["notified", "accepted", "assigned", "en_route", "verifying"]

export function OrdersTable() {
  const [filter, setFilter] = useState<FilterKey>("all")
  const [query, setQuery] = useState("")

  const rows = useMemo(() => {
    return ORDERS.filter((o) => {
      if (filter === "open" && !OPEN_STATUSES.includes(o.status)) return false
      if (filter === "awaiting_payment" && o.status !== "verified") return false
      if (filter === "cross" && !o.crossCoop) return false
      if (query) {
        const q = query.toLowerCase()
        return (
          o.ref.toLowerCase().includes(q) ||
          o.seller.toLowerCase().includes(q) ||
          o.model.toLowerCase().includes(q) ||
          o.city.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [filter, query])

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/70",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ref, seller, model…"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-64"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Device</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Same-day</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Age</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr
                key={o.id}
                className="border-b border-border last:border-0 transition-colors hover:bg-secondary/50"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    {o.ref}
                    {o.crossCoop && <Badge tone="teal">Cross-coop</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{o.seller}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-foreground">{o.model}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.storage} · {o.color}
                  </p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {o.city}
                  <span className="text-xs"> · {o.zip}</span>
                </td>
                <td className="px-4 py-3 font-medium text-foreground">
                  {formatCurrency(o.sameDayOffer)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.status} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatRelativeTime(o.createdAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No orders match this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
