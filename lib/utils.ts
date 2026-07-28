export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ")
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.round((now - then) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

export function formatDeadline(iso: string): { label: string; urgent: boolean; overdue: boolean } {
  const target = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.round((target - now) / 60000)
  if (diff < 0) return { label: `${Math.abs(diff)}m overdue`, urgent: true, overdue: true }
  if (diff < 60) return { label: `${diff}m left`, urgent: diff < 30, overdue: false }
  const hours = Math.floor(diff / 60)
  const mins = diff % 60
  return { label: `${hours}h ${mins}m left`, urgent: false, overdue: false }
}
