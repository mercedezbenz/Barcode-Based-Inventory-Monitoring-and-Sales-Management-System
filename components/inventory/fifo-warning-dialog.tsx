"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertTriangle,
  Clock,
  ShieldCheck,
  ArrowRight,
  Package,
  CalendarDays,
  Layers,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Info,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { InventoryItem } from "@/lib/types"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FifoCheckResult {
  /** The item the user scanned */
  scannedItem: InventoryItem
  /** The oldest available item (by expiry, then by date added) */
  oldestItem: InventoryItem
  /** Whether the scanned item IS the oldest (FIFO-compliant) */
  isFifoCompliant: boolean
  /** All items with the same product name that have available stock, sorted oldest-first */
  availableBatches: InventoryItem[]
}

export interface FifoWarningDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fifoResult: FifoCheckResult | null
  /** Called when user proceeds with the oldest stock (FIFO compliant) */
  onProceedWithOldest: (item: InventoryItem) => void
  /** Called when user overrides FIFO and proceeds with the scanned item */
  onProceedWithScanned: (item: InventoryItem, reason: string) => void
  /** Called to cancel / go back */
  onCancel: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function resolveStockLeft(item: InventoryItem): number {
  const incoming = (item as any).incoming ?? (item as any).incomingStock ?? 0
  const outgoing = (item as any).outgoing ?? (item as any).outgoingStock ?? 0
  const goodReturn = (item as any).goodReturnStock ?? 0
  const damageReturn = (item as any).damageReturnStock ?? 0
  return Math.max(0, incoming - outgoing + goodReturn - damageReturn)
}

function getProductName(item: InventoryItem): string {
  if (item.name) return item.name
  if (item.subcategory) return `${item.category} - ${item.subcategory}`
  return item.category
}

function parseDate(d: any): Date | null {
  if (!d) return null
  if (d instanceof Date) return d
  if (d?.toDate) return d.toDate()
  if (d?.seconds) return new Date(d.seconds * 1000)
  const parsed = new Date(d)
  return isNaN(parsed.getTime()) ? null : parsed
}

function formatDate(d: any): string {
  const date = parseDate(d)
  if (!date) return "—"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function getDaysUntilExpiry(d: any): number | null {
  const date = parseDate(d)
  if (!date) return null
  const now = new Date()
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function getExpiryBadge(d: any): { label: string; className: string } | null {
  const days = getDaysUntilExpiry(d)
  if (days === null) return null
  if (days < 0) return { label: "Expired", className: "bg-red-100 text-red-700 border-red-200" }
  if (days <= 3) return { label: `${days}d left`, className: "bg-red-100 text-red-700 border-red-200" }
  if (days <= 7) return { label: `${days}d left`, className: "bg-amber-100 text-amber-700 border-amber-200" }
  if (days <= 30) return { label: `${days}d left`, className: "bg-orange-100 text-orange-700 border-orange-200" }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// FIFO Check Logic (exported for use in scan-item-dialog)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Performs FIFO validation for a scanned item against all inventory items.
 *
 * 1. Finds all items with the same product name that have available stock.
 * 2. Sorts by expiration date (earliest first), then by date added (oldest first).
 * 3. Compares scanned item against the oldest available batch.
 */
export function performFifoCheck(
  scannedItem: InventoryItem,
  allItems: InventoryItem[]
): FifoCheckResult {
  const scannedName = getProductName(scannedItem).toLowerCase().trim()

  // Find all items with the same product name and available stock
  const sameName = allItems.filter((item) => {
    const name = getProductName(item).toLowerCase().trim()
    return name === scannedName && resolveStockLeft(item) > 0
  })

  // Sort: expiry date ascending (earliest first), then createdAt ascending (oldest first)
  const sorted = [...sameName].sort((a, b) => {
    const aExpiry = parseDate((a as any).expiryDate ?? (a as any).expirationDate)
    const bExpiry = parseDate((b as any).expiryDate ?? (b as any).expirationDate)

    // Items with expiry dates come before those without
    if (aExpiry && bExpiry) {
      const diff = aExpiry.getTime() - bExpiry.getTime()
      if (diff !== 0) return diff
    } else if (aExpiry && !bExpiry) {
      return -1
    } else if (!aExpiry && bExpiry) {
      return 1
    }

    // Tie-break: date added (oldest first)
    const aCreated = parseDate(a.createdAt)?.getTime() ?? Infinity
    const bCreated = parseDate(b.createdAt)?.getTime() ?? Infinity
    return aCreated - bCreated
  })

  const oldestItem = sorted.length > 0 ? sorted[0] : scannedItem
  const isFifoCompliant = oldestItem.id === scannedItem.id

  return {
    scannedItem,
    oldestItem,
    isFifoCompliant,
    availableBatches: sorted,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Item Info Card (reused for both scanned and oldest items)
// ─────────────────────────────────────────────────────────────────────────────

function ItemInfoCard({
  item,
  label,
  badge,
  highlight,
  recommended,
}: {
  item: InventoryItem
  label: string
  badge?: React.ReactNode
  highlight?: "green" | "amber" | "blue"
  recommended?: boolean
}) {
  const stockLeft = resolveStockLeft(item)
  const expiry = (item as any).expiryDate ?? (item as any).expirationDate
  const expiryBadge = getExpiryBadge(expiry)
  const createdAt = parseDate(item.createdAt)

  const borderColor =
    highlight === "green" ? "border-emerald-300 dark:border-emerald-700" :
    highlight === "amber" ? "border-amber-300 dark:border-amber-700" :
    highlight === "blue" ? "border-sky-300 dark:border-sky-700" :
    "border-slate-200 dark:border-border"

  const bgColor =
    highlight === "green" ? "bg-emerald-50/50 dark:bg-emerald-950/20" :
    highlight === "amber" ? "bg-amber-50/50 dark:bg-amber-950/20" :
    highlight === "blue" ? "bg-sky-50/50 dark:bg-sky-950/20" :
    "bg-white dark:bg-card"

  return (
    <div className={cn("rounded-xl border-2 p-4 transition-all duration-200", borderColor, bgColor)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
          {badge}
        </div>
        {recommended && (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-bold px-2 py-0.5 gap-1">
            <ShieldCheck className="h-3 w-3" />
            FIFO Recommended
          </Badge>
        )}
      </div>

      {/* Product Name */}
      <p className="text-base font-bold text-slate-800 dark:text-foreground leading-tight mb-3">
        {getProductName(item)}
      </p>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
        {/* Date Added */}
        <div className="flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Date Added</p>
            <p className="text-sm font-semibold text-slate-700 dark:text-foreground">
              {createdAt ? createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
            </p>
          </div>
        </div>

        {/* Expiry Date */}
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Expiry Date</p>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-slate-700 dark:text-foreground">
                {formatDate(expiry)}
              </p>
              {expiryBadge && (
                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border", expiryBadge.className)}>
                  {expiryBadge.label}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stock Left */}
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Stock Left</p>
            <p className={cn(
              "text-sm font-bold",
              stockLeft <= 0 ? "text-red-600" : stockLeft <= 5 ? "text-amber-600" : "text-emerald-600"
            )}>
              {stockLeft}
            </p>
          </div>
        </div>

        {/* Barcode */}
        <div className="flex items-center gap-2">
          <Package className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Barcode</p>
            <p className="text-xs font-mono text-slate-500 dark:text-muted-foreground">
              {item.barcode || "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FIFO Warning Dialog Component
// ─────────────────────────────────────────────────────────────────────────────

export function FifoWarningDialog({
  open,
  onOpenChange,
  fifoResult,
  onProceedWithOldest,
  onProceedWithScanned,
  onCancel,
}: FifoWarningDialogProps) {
  const [showAllBatches, setShowAllBatches] = useState(false)
  const [overrideReason, setOverrideReason] = useState("")
  const [showOverridePanel, setShowOverridePanel] = useState(false)

  if (!fifoResult) return null

  const { scannedItem, oldestItem, availableBatches } = fifoResult

  const handleProceedWithOldest = () => {
    onProceedWithOldest(oldestItem)
    setShowOverridePanel(false)
    setOverrideReason("")
    setShowAllBatches(false)
  }

  const handleProceedWithScanned = () => {
    onProceedWithScanned(scannedItem, overrideReason || "No reason provided")
    setShowOverridePanel(false)
    setOverrideReason("")
    setShowAllBatches(false)
  }

  const handleClose = () => {
    onCancel()
    setShowOverridePanel(false)
    setOverrideReason("")
    setShowAllBatches(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v) }}>
      <DialogContent className="!w-[98vw] sm:!w-auto sm:max-w-[640px] !p-0 !gap-0 !overflow-hidden">

        {/* ════════ HEADER ════════ */}
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
          <DialogHeader className="!space-y-1.5">
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900 border border-amber-200 dark:border-amber-700">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <span className="text-slate-800 dark:text-foreground">FIFO Warning</span>
                <p className="text-xs font-normal text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                  Older stocks are available for this product
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* ════════ BODY ════════ */}
        <div className="px-5 sm:px-6 py-5 max-h-[65vh] overflow-y-auto space-y-4">

          {/* Explanation banner */}
          <div className="flex items-start gap-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800 px-4 py-3">
            <Info className="h-4 w-4 text-sky-500 mt-0.5 shrink-0" />
            <p className="text-xs text-sky-700 dark:text-sky-300 leading-relaxed">
              <strong>FIFO (First-In, First-Out):</strong> The oldest stock should be dispatched first
              to minimize waste and ensure freshness. We detected older batches with available stock.
            </p>
          </div>

          {/* ── OLDEST STOCK (Recommended) ── */}
          <div>
            <ItemInfoCard
              item={oldestItem}
              label="Oldest Stock"
              highlight="green"
              recommended
              badge={
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-bold px-1.5 py-0.5">
                  Oldest
                </Badge>
              }
            />
          </div>

          {/* ── VS DIVIDER ── */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200 dark:bg-border" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">vs</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-border" />
          </div>

          {/* ── SCANNED ITEM ── */}
          <div>
            <ItemInfoCard
              item={scannedItem}
              label="Scanned Item"
              highlight="amber"
              badge={
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-bold px-1.5 py-0.5">
                  Scanned
                </Badge>
              }
            />
          </div>

          {/* ── ALL AVAILABLE BATCHES (collapsible) ── */}
          {availableBatches.length > 2 && (
            <div>
              <button
                type="button"
                onClick={() => setShowAllBatches(!showAllBatches)}
                className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-foreground transition-colors w-full justify-center py-1"
              >
                {showAllBatches ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showAllBatches ? "Hide" : "Show"} all {availableBatches.length} batches
              </button>

              {showAllBatches && (
                <div className="mt-2 space-y-2 animate-in fade-in-0 slide-in-from-top-2 duration-200">
                  {availableBatches.map((item, idx) => {
                    const isOldest = item.id === oldestItem.id
                    const isScanned = item.id === scannedItem.id
                    const stockLeft = resolveStockLeft(item)
                    const expiry = (item as any).expiryDate ?? (item as any).expirationDate
                    const expiryBadgeData = getExpiryBadge(expiry)

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border transition-all",
                          isOldest
                            ? "bg-emerald-50/60 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                            : isScanned
                              ? "bg-amber-50/60 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
                              : "bg-white border-slate-200 dark:bg-card dark:border-border"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-[10px] font-bold text-slate-400 w-5 text-center shrink-0">
                            #{idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium text-slate-700 dark:text-foreground truncate">
                                {item.barcode || "No barcode"}
                              </p>
                              {isOldest && (
                                <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full border border-emerald-200 shrink-0">
                                  Oldest
                                </span>
                              )}
                              {isScanned && (
                                <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200 shrink-0">
                                  Scanned
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Expiry: {formatDate(expiry)}
                              {expiryBadgeData && (
                                <span className={cn("ml-1.5 text-[9px] font-bold px-1 py-0.5 rounded border", expiryBadgeData.className)}>
                                  {expiryBadgeData.label}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <Badge
                          className={cn(
                            "text-xs font-semibold shrink-0",
                            stockLeft <= 0
                              ? "bg-red-100 text-red-700 border-red-200"
                              : stockLeft <= 5
                                ? "bg-amber-100 text-amber-700 border-amber-200"
                                : "bg-emerald-100 text-emerald-700 border-emerald-200"
                          )}
                          variant="outline"
                        >
                          {stockLeft} left
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── OVERRIDE PANEL ── */}
          {showOverridePanel && (
            <div className="rounded-xl border-2 border-amber-200 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  Override FIFO — Proceed with Scanned Item
                </p>
              </div>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
                You are choosing to skip the oldest stock. Please provide a reason for traceability.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600 dark:text-foreground">
                  Reason for Override <span className="text-slate-400">(optional)</span>
                </Label>
                <Input
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Customer request, priority order, quality issue..."
                  className="h-9 text-sm bg-white dark:bg-card"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  onClick={handleProceedWithScanned}
                  className="flex-1 h-10 gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm rounded-xl"
                >
                  <ArrowRight className="h-4 w-4" />
                  Confirm Override
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowOverridePanel(false)}
                  className="h-10 px-4 text-sm rounded-xl"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ════════ FOOTER — Action Buttons ════════ */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/50 dark:bg-muted/20">
          {!showOverridePanel ? (
            <div className="grid grid-cols-2 gap-3">
              {/* Option 1: Use Oldest Stock (FIFO) */}
              <Button
                type="button"
                onClick={handleProceedWithOldest}
                className="h-12 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-emerald-200 dark:shadow-none transition-all hover:scale-[1.01]"
              >
                <ShieldCheck className="h-5 w-5" />
                <div className="text-left leading-tight">
                  <span className="block">Use Oldest Stock</span>
                  <span className="block text-[10px] font-normal opacity-80">FIFO Compliant</span>
                </div>
              </Button>

              {/* Option 2: Use Scanned Item (Override) */}
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowOverridePanel(true)}
                className="h-12 gap-2 font-semibold text-sm rounded-xl border-2 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30 transition-all"
              >
                <ArrowRight className="h-5 w-5" />
                <div className="text-left leading-tight">
                  <span className="block">Use Scanned Item</span>
                  <span className="block text-[10px] font-normal opacity-70">Override FIFO</span>
                </div>
              </Button>
            </div>
          ) : (
            <p className="text-xs text-center text-slate-400">
              Complete the override form above or cancel to go back.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
