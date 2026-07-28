"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const FAQS = [
  {
    q: "Why is the same-day offer lower than the standard offer?",
    a: "When a local coop picks up your device and pays you immediately, they take on the cost and risk of pickup, on-the-spot inspection, and instant payment. That convenience is reflected in a slightly lower offer. If you'd rather ship it yourself, the standard offer is always available.",
  },
  {
    q: "How does the same-day payment actually work?",
    a: "Once a partner coop accepts your pickup, a trained driver comes to you, verifies the device against your quote (IMEI, model, condition), and releases payment via instant ACH or your preferred method before they leave with the device.",
  },
  {
    q: "What if my device doesn't match the quote?",
    a: "The driver inspects the device on-site. If something differs from what you entered — a lower battery health, a hidden crack, or a carrier lock — you'll see a revised offer and can accept or decline it with no pressure and no obligation.",
  },
  {
    q: "Is my data wiped?",
    a: "Yes. We recommend signing out of all accounts and performing a factory reset before pickup. Every device is also professionally data-sanitized by the coop after intake, and you receive a data-wipe confirmation.",
  },
  {
    q: "What is a coop and who am I selling to?",
    a: "OddCoop is a cooperative network of independently owned local device businesses and repair shops. Instead of shipping to one big warehouse, your device goes to a vetted local member that handles pickup and payment. Every coop is bound by the same standards and payment guarantees.",
  },
]

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="flex flex-col gap-2">
      {FAQS.map((item, i) => {
        const isOpen = open === i
        return (
          <div key={i} className="rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              aria-expanded={isOpen}
            >
              <span className="text-sm font-medium text-foreground">{item.q}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </button>
            {isOpen && (
              <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
