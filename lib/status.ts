export type OrderStatus =
  | "pending"
  | "notified"
  | "accepted"
  | "assigned"
  | "en_route"
  | "verifying"
  | "verified"
  | "mismatch"
  | "paid"
  | "shipped"
  | "complete"
  | "cancelled"

type Tone = "neutral" | "teal" | "success" | "warning" | "destructive"

export const STATUS_META: Record<OrderStatus, { label: string; tone: Tone; description: string }> = {
  pending: { label: "Pending", tone: "neutral", description: "Awaiting coop notification" },
  notified: { label: "Notified", tone: "teal", description: "Territory coops alerted" },
  accepted: { label: "Accepted", tone: "teal", description: "Territory coop claimed pickup" },
  assigned: { label: "Assigned", tone: "teal", description: "Driver assigned to route" },
  en_route: { label: "En route", tone: "warning", description: "Driver heading to seller" },
  verifying: { label: "Verifying", tone: "warning", description: "Driver inspecting device" },
  verified: { label: "Verified", tone: "success", description: "Device passed inspection" },
  mismatch: { label: "Mismatch", tone: "destructive", description: "Device did not match quote" },
  paid: { label: "Paid", tone: "success", description: "Same-day payment released" },
  shipped: { label: "Shipped", tone: "teal", description: "Device shipped to buyer" },
  complete: { label: "Complete", tone: "success", description: "Order fully settled" },
  cancelled: { label: "Cancelled", tone: "neutral", description: "Order cancelled" },
}

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground border-border",
  teal: "bg-accent text-accent-foreground border-transparent",
  success: "bg-success-muted text-success-foreground border-transparent",
  warning: "bg-warning-muted text-warning-foreground border-transparent",
  destructive: "bg-destructive-muted text-destructive-foreground border-transparent",
}

// Ordered pipeline for the seller/order timeline
export const PIPELINE: OrderStatus[] = [
  "notified",
  "accepted",
  "assigned",
  "en_route",
  "verifying",
  "verified",
  "paid",
  "shipped",
  "complete",
]
