import type { ReactNode } from "react"
import { Card } from "@/components/ui"
import { cn } from "@/lib/utils"

export function KpiCard({
  label,
  value,
  sub,
  icon,
  tone = "neutral",
}: {
  label: string
  value: string | number
  sub?: string
  icon?: ReactNode
  tone?: "neutral" | "teal" | "success" | "warning" | "destructive"
}) {
  const accent: Record<string, string> = {
    neutral: "text-muted-foreground",
    teal: "text-primary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon && <span className={cn("shrink-0", accent[tone])}>{icon}</span>}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      {sub && <p className={cn("mt-1 text-xs", accent[tone])}>{sub}</p>}
    </Card>
  )
}
