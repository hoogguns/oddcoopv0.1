import Link from "next/link"
import { ArrowRight, CircleDollarSign, HandCoins, MapPinned, ScanLine, ShieldCheck, Truck } from "lucide-react"
import { SiteNav } from "@/components/site-nav"
import { SiteFooter } from "@/components/site-footer"
import { QuoteForm } from "@/components/quote/quote-form"
import { Faq } from "@/components/quote/faq"

const STEPS = [
  { icon: ScanLine, title: "Describe your device", text: "Tell us the model, condition, and ZIP. We price it instantly with two offers." },
  { icon: MapPinned, title: "A local coop claims it", text: "If a member coop serves your area, they accept the pickup in their territory." },
  { icon: Truck, title: "Driver verifies on-site", text: "A trained driver checks IMEI, model, and condition against your quote." },
  { icon: HandCoins, title: "Get paid the same day", text: "Payment is released on the spot — no waiting for a warehouse to receive it." },
]

const TRUST = [
  { icon: ShieldCheck, title: "Verified member coops", text: "Every buyer is a vetted, independently owned local business bound by shared standards." },
  { icon: CircleDollarSign, title: "Payment guarantees", text: "Coops that miss same-day payment deadlines earn strikes and can be suspended from the network." },
  { icon: ScanLine, title: "On-site device verification", text: "IMEI and condition are confirmed in person, so the price you see is the price you get." },
]

export default function QuotePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border bg-secondary/30">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-20">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Same-day payment in serviced ZIPs
              </span>
              <h1 className="mt-4 text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
                Sell your phone. Get paid the same day.
              </h1>
              <p className="mt-4 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
                OddCoop routes your device to a trusted local cooperative for instant pickup and
                immediate payment. Prefer to ship it yourself? Take the standard offer instead.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="#quote"
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Get an instant offer <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/join"
                  className="inline-flex h-11 items-center rounded-lg border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  Run a coop? Join the network
                </Link>
              </div>
              <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
                <Stat value="30+" label="ZIP codes served" />
                <Stat value="Same day" label="Typical payout" />
                <Stat value="14 days" label="Offers locked" />
              </dl>
            </div>

            <div className="rounded-2xl border border-border bg-card p-2 shadow-sm">
              <div className="rounded-xl bg-secondary/50 p-5">
                <p className="text-sm font-medium text-foreground">How your two offers compare</p>
                <div className="mt-4 space-y-3">
                  <OfferRow label="Standard · ship it free" amount="$340" muted note="Paid after inspection" />
                  <OfferRow label="Same-day · local pickup" amount="$313" note="Paid on the spot" highlight />
                </div>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  The same-day offer is slightly lower because a local coop handles pickup and pays
                  you immediately. You always choose which offer to take.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Quote form */}
        <section id="quote" className="scroll-mt-20 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mb-8 max-w-xl">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Get your offer</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Enter your device details below. We&apos;ll show a standard offer and, if a coop
                serves your ZIP, a same-day offer with instant payment.
              </p>
            </div>
            <QuoteForm />
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-border bg-secondary/30 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">How OddCoop works</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              A cooperative network, not a warehouse. Here&apos;s the same-day path from quote to
              cash.
            </p>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <li key={step.title} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs font-semibold tabular-nums text-primary">0{i + 1}</span>
                    <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Trust */}
        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Built for trust
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Selling a phone to a stranger is nerve-wracking. OddCoop puts standards, guarantees,
                  and on-site verification between you and the transaction.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {TRUST.map((item) => (
                  <div key={item.title} className="rounded-xl border border-border bg-card p-5">
                    <item.icon className="h-5 w-5 text-primary" />
                    <h3 className="mt-3 text-sm font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-border bg-secondary/30 py-14 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Frequently asked questions
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Everything you need to know before you sell.
            </p>
            <div className="mt-8">
              <Faq />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="text-lg font-semibold tracking-tight text-foreground">{value}</dt>
      <dd className="text-xs text-muted-foreground">{label}</dd>
    </div>
  )
}

function OfferRow({
  label,
  amount,
  note,
  highlight,
  muted,
}: {
  label: string
  amount: string
  note: string
  highlight?: boolean
  muted?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
        highlight ? "border-primary/50 bg-accent/50" : "border-border bg-card"
      }`}
    >
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      <span
        className={`text-lg font-semibold tabular-nums ${muted ? "text-muted-foreground" : "text-foreground"}`}
      >
        {amount}
      </span>
    </div>
  )
}
