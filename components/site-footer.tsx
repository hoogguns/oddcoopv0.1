import Link from "next/link"
import { Logo } from "./logo"

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              A cooperative network for device buyback. Fair offers, local pickup, and same-day
              payment through member coops.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <FooterCol
              title="Product"
              links={[
                { href: "/", label: "Sell a device" },
                { href: "/join", label: "Join the coop" },
                { href: "/dashboard", label: "Partner dashboard" },
              ]}
            />
            <FooterCol
              title="Operations"
              links={[
                { href: "/territory", label: "Territory console" },
                { href: "/driver", label: "Driver app" },
              ]}
            />
            <FooterCol
              title="Company"
              links={[
                { href: "/", label: "How it works" },
                { href: "/", label: "Trust & safety" },
                { href: "/", label: "Support" },
              ]}
            />
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} OddCoop Cooperative. All rights reserved.</p>
          <p>Member coops are independently owned and operated.</p>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-3 flex flex-col gap-2">
        {links.map((l, i) => (
          <li key={`${l.href}-${i}`}>
            <Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
