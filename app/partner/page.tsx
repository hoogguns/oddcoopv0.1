import type { Metadata } from "next"
import { SiteNav } from "@/components/site-nav"
import { SiteFooter } from "@/components/site-footer"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { OrdersTable } from "@/components/partner/orders-table"
import { StandingCard, EconomicsCard, PaymentQueue, ActivityFeed } from "@/components/partner/panels"
import { KPIS } from "@/lib/data"
import { IconTruck, IconCheck, IconClock, IconUsers, IconAlert } from "@/components/icons"

export const metadata: Metadata = {
  title: "Partner dashboard — OddCoop",
  description: "Manage orders, same-day payouts, coop standing, and SaaS economics.",
}

export default function PartnerPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-1">
          <p className="text-sm font-medium text-primary">Wasatch Buybacks</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">
            Partner dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Your storefront on OddCoop — orders, verification, and same-day payouts in one place.
          </p>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <KpiCard label="Open orders" value={KPIS.openOrders} icon={<IconTruck className="h-5 w-5" />} tone="teal" sub="In active pipeline" />
          <KpiCard label="Verified today" value={KPIS.verifiedToday} icon={<IconCheck className="h-5 w-5" />} tone="success" sub="Passed inspection" />
          <KpiCard label="Awaiting payment" value={KPIS.awaitingPayment} icon={<IconClock className="h-5 w-5" />} tone="warning" sub="Same-day ACH due" />
          <KpiCard label="Cross-coop" value={KPIS.crossCoopOrders} icon={<IconUsers className="h-5 w-5" />} tone="teal" sub="Fulfilled by partners" />
          <KpiCard label="Late strikes" value={KPIS.latePaymentStrikes} icon={<IconAlert className="h-5 w-5" />} tone="destructive" sub="Rolling 90 days" />
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <div>
              <h2 className="mb-3 text-lg font-semibold text-foreground">Orders</h2>
              <OrdersTable />
            </div>
            <PaymentQueue />
          </div>
          <div className="flex flex-col gap-6">
            <StandingCard />
            <EconomicsCard />
            <ActivityFeed />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
