import { cn } from "@/lib/utils"

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Two interlocking rings = cooperative network */}
        <circle cx="12" cy="16" r="8.5" stroke="var(--primary)" strokeWidth="3" fill="none" />
        <circle cx="20" cy="16" r="8.5" stroke="var(--primary)" strokeWidth="3" fill="none" opacity="0.55" />
        {/* center node = same-day payment handshake */}
        <circle cx="16" cy="16" r="2.4" fill="var(--primary)" />
      </svg>
      {showText && (
        <span className="text-[17px] font-semibold tracking-tight text-foreground">
          Odd<span className="text-primary">Coop</span>
        </span>
      )}
    </span>
  )
}
