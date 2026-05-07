/**
 * lib/sales-status-mapper.ts
 *
 * DISPLAY-ONLY sales status normalization layer.
 *
 * PURPOSE:
 *   Maps internal encoder/Firebase statuses → simplified sales-friendly statuses.
 *   This is PURELY a UI transformation. It NEVER writes to Firebase.
 *
 * ENCODER INTERNAL STATUSES (DO NOT MODIFY):
 *   READY_FOR_PROCESSING | FOR_VERIFICATION | FOR_DELIVERY |
 *   ON_DELIVERY | COMPLETED | CANCELLED
 *
 * SALES DISPLAY STATUSES (this file manages):
 *   Pending | On Delivery | Completed | Cancelled
 */

// ─── Sales Display Status Type ────────────────────────────────────────────────

export type SalesDisplayStatus = "Pending" | "On Delivery" | "Completed" | "Cancelled"

// Used for filter state (lowercase + underscore keys)
export type SalesStatusFilterKey = "all" | "pending" | "on_delivery" | "completed" | "cancelled"

// ─── Status Mapping Table ─────────────────────────────────────────────────────

/**
 * The canonical mapping from internal encoder status → sales display status.
 * All comparisons are done case-insensitively.
 */
const STATUS_MAP: Record<string, SalesDisplayStatus> = {
  // ─── Pending ────────────────────────────────────────────────────────────────
  // Encoder internal statuses
  ready_for_processing: "Pending",
  for_verification: "Pending",
  for_delivery: "Pending",
  pending: "Pending",
  // Legacy / order-utils.ts statuses
  processing: "Pending",
  ready_for_delivery: "Pending",
  in_production: "Pending",
  in_transit: "Pending",
  verified: "Pending",

  // ─── On Delivery ────────────────────────────────────────────────────────────
  on_delivery: "On Delivery",
  out_for_delivery: "On Delivery",
  dispatched: "On Delivery",
  shipped: "On Delivery",

  // ─── Completed ──────────────────────────────────────────────────────────────
  completed: "Completed",
  delivered: "Completed",

  // ─── Cancelled ──────────────────────────────────────────────────────────────
  cancelled: "Cancelled",
}

// ─── Core Normalizer ──────────────────────────────────────────────────────────

/**
 * normalizeSalesStatus
 *
 * Converts any internal encoder/Firebase status string into
 * a sales-friendly display status.
 *
 * Features:
 *  - Case-insensitive (handles UPPER_CASE, lower_case, Mixed)
 *  - Strips extra whitespace
 *  - Handles null/undefined safely → defaults to "Pending"
 *  - Does NOT mutate Firebase data
 *
 * @param status - Raw status string from Firestore order document
 * @returns SalesDisplayStatus — one of: Pending | On Delivery | Completed | Cancelled
 */
export function normalizeSalesStatus(status: string | null | undefined): SalesDisplayStatus {
  if (!status || typeof status !== "string") return "Pending"

  // Normalize: lowercase, trim, replace spaces/hyphens with underscores
  const normalized = status
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_")

  return STATUS_MAP[normalized] ?? "Pending"
}

// ─── Filter Key Converter ─────────────────────────────────────────────────────

/**
 * salesStatusToFilterKey
 *
 * Converts a SalesDisplayStatus into the filter key used in state/URLs.
 *
 * @param displayStatus - e.g. "On Delivery"
 * @returns SalesStatusFilterKey — e.g. "on_delivery"
 */
export function salesStatusToFilterKey(displayStatus: SalesDisplayStatus): SalesStatusFilterKey {
  switch (displayStatus) {
    case "Pending":     return "pending"
    case "On Delivery": return "on_delivery"
    case "Completed":   return "completed"
    case "Cancelled":   return "cancelled"
    default:            return "pending"
  }
}

/**
 * filterKeyToDisplayLabel
 *
 * Converts a filter key to a human-readable label.
 *
 * @param key - SalesStatusFilterKey
 * @returns Human-readable label string
 */
export function filterKeyToDisplayLabel(key: SalesStatusFilterKey): string {
  switch (key) {
    case "all":         return "All"
    case "pending":     return "Pending"
    case "on_delivery": return "On Delivery"
    case "completed":   return "Completed"
    case "cancelled":   return "Cancelled"
    default:            return "All"
  }
}

// ─── Batch Normalizer ─────────────────────────────────────────────────────────

/**
 * normalizeOrdersForSales
 *
 * Applies normalizeSalesStatus to an array of orders without mutating them.
 * Returns new order objects with a `salesStatus` display field appended.
 *
 * @param orders - Raw order array from Firebase / useOrders hook
 * @returns Orders with `salesStatus: SalesDisplayStatus` added
 */
export function normalizeOrdersForSales<T extends { status?: string; salesStatus?: string }>(
  orders: T[]
): (T & { salesStatus: SalesDisplayStatus })[] {
  if (!Array.isArray(orders)) return []
  return orders.map((order) => ({
    ...order,
    salesStatus: normalizeSalesStatus((order as any).salesStatus || order?.status),
  }))
}

// ─── Filter Matching ──────────────────────────────────────────────────────────

/**
 * matchesSalesFilter
 *
 * Checks whether an order's raw status matches a given sales filter key.
 * Used in filter logic to avoid re-normalizing on every item.
 *
 * @param rawStatus - Raw status string from Firebase
 * @param filterKey - The current active filter
 * @returns boolean
 */
export function matchesSalesFilter(
  rawStatus: string | null | undefined,
  filterKey: SalesStatusFilterKey,
  salesStatusField?: string | null
): boolean {
  if (filterKey === "all") return true
  const displayStatus = normalizeSalesStatus(salesStatusField || rawStatus)
  const displayKey = salesStatusToFilterKey(displayStatus)
  return displayKey === filterKey
}

// ─── KPI Counters ─────────────────────────────────────────────────────────────

/**
 * computeSalesKPIs
 *
 * Calculates KPI counts from an array of orders using sales-side normalization.
 * Does NOT count based on raw encoder statuses.
 *
 * @param orders - Raw orders array
 * @returns Object with totalOrders, pending, onDelivery, completed, cancelled counts
 */
export function computeSalesKPIs<T extends { status?: string; salesStatus?: string }>(orders: T[]): {
  totalOrders: number
  pending: number
  onDelivery: number
  completed: number
  cancelled: number
} {
  const result = { totalOrders: 0, pending: 0, onDelivery: 0, completed: 0, cancelled: 0 }

  if (!Array.isArray(orders)) return result

  result.totalOrders = orders.length

  for (const order of orders) {
    const s = normalizeSalesStatus((order as any).salesStatus || order?.status)
    if (s === "Pending")     result.pending++
    else if (s === "On Delivery") result.onDelivery++
    else if (s === "Completed")   result.completed++
    else if (s === "Cancelled")   result.cancelled++
  }

  return result
}

// ─── Status Distribution (for charts) ────────────────────────────────────────

/**
 * computeSalesStatusDistribution
 *
 * Generates chart-ready status distribution data using sales-side normalization.
 * Excludes zero-count statuses for cleaner charts.
 *
 * @param orders - Raw orders array
 * @returns Array of { name, value } for pie/donut charts
 */
export function computeSalesStatusDistribution<T extends { status?: string; salesStatus?: string }>(
  orders: T[]
): { name: SalesDisplayStatus; value: number }[] {
  const counts: Record<SalesDisplayStatus, number> = {
    Pending: 0,
    "On Delivery": 0,
    Completed: 0,
    Cancelled: 0,
  }

  if (!Array.isArray(orders)) return []

  for (const order of orders) {
    const s = normalizeSalesStatus((order as any).salesStatus || order?.status)
    counts[s]++
  }

  return (Object.entries(counts) as [SalesDisplayStatus, number][])
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))
}

// ─── Badge Style Resolver ─────────────────────────────────────────────────────

export type BadgeVariant = {
  containerClass: string
  textClass: string
  borderClass: string
  iconColor: string
  label: string
}

/**
 * getSalesBadgeVariant
 *
 * Returns pre-computed Tailwind class strings for a given sales display status.
 * Centralizes all badge styling to prevent duplication across components.
 *
 * @param status - Raw status from Firebase OR SalesDisplayStatus
 * @returns BadgeVariant object with class strings
 */
export function getSalesBadgeVariant(status: string | null | undefined): BadgeVariant {
  const displayStatus = normalizeSalesStatus(status)

  switch (displayStatus) {
    case "Pending":
      return {
        containerClass: "bg-amber-50 dark:bg-amber-950/30",
        textClass: "text-amber-700 dark:text-amber-400",
        borderClass: "border-amber-200 dark:border-amber-800",
        iconColor: "text-amber-500",
        label: "Pending",
      }
    case "On Delivery":
      return {
        containerClass: "bg-blue-50 dark:bg-blue-950/30",
        textClass: "text-blue-700 dark:text-blue-400",
        borderClass: "border-blue-200 dark:border-blue-800",
        iconColor: "text-blue-500",
        label: "On Delivery",
      }
    case "Completed":
      return {
        containerClass: "bg-emerald-50 dark:bg-emerald-950/30",
        textClass: "text-emerald-700 dark:text-emerald-400",
        borderClass: "border-emerald-200 dark:border-emerald-800",
        iconColor: "text-emerald-500",
        label: "Completed",
      }
    case "Cancelled":
      return {
        containerClass: "bg-red-50 dark:bg-red-950/30",
        textClass: "text-red-700 dark:text-red-400",
        borderClass: "border-red-200 dark:border-red-800",
        iconColor: "text-red-500",
        label: "Cancelled",
      }
  }
}

// ─── Row Left-Border Color ────────────────────────────────────────────────────

/**
 * getSalesRowBorderColor
 *
 * Returns the Tailwind left-border color class for a table row,
 * based on the sales-normalized status.
 *
 * @param status - Raw status from Firebase
 * @returns Tailwind border-l-* class string
 */
export function getSalesRowBorderColor(status: string | null | undefined): string {
  const displayStatus = normalizeSalesStatus(status)
  switch (displayStatus) {
    case "Pending":     return "border-l-amber-400"
    case "On Delivery": return "border-l-blue-400"
    case "Completed":   return "border-l-emerald-400"
    case "Cancelled":   return "border-l-red-400"
    default:            return "border-l-gray-200"
  }
}

// ─── Chart Color Map ──────────────────────────────────────────────────────────

/**
 * SALES_STATUS_CHART_COLORS
 *
 * Canonical color values for pie/donut charts, keyed by SalesDisplayStatus.
 */
export const SALES_STATUS_CHART_COLORS: Record<SalesDisplayStatus, string> = {
  Pending: "#f59e0b",
  "On Delivery": "#3b82f6",
  Completed: "#10b981",
  Cancelled: "#ef4444",
}
