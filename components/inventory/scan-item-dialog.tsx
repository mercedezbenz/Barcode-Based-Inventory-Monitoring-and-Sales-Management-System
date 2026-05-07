"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  ScanLine,
  PackagePlus,
  Truck,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Loader2,
  Package,
  CalendarDays,
  ArrowRightLeft,
  CornerDownLeft,
  ShieldCheck,
  Clock,
  Scale,
  Layers,
  ChevronRight,
  ArrowLeft,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { InventoryItem } from "@/lib/types"
import {
  performFifoCheck,
  FifoWarningDialog,
  type FifoCheckResult,
} from "./fifo-warning-dialog"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ScanItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  inventoryItems: InventoryItem[]
  onProductOut?: (item: InventoryItem) => void
  onReturnItem?: (item: InventoryItem) => void
  onRegisterNew?: (barcode: string) => void
  /** Pre-filled barcode from the global USB scanner — auto-processed on open */
  initialBarcode?: string | null
  /** Called after the initial barcode has been consumed so the parent can clear it */
  onInitialBarcodeConsumed?: () => void
}

type ScanState = "idle" | "searching" | "found" | "not-found"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function resolveStockLeft(item: InventoryItem): number {
  const incoming = (item as any).incoming_weight ?? (item as any).production_weight ?? 0
  const outgoing = (item as any).outgoing_weight ?? 0
  const goodReturn = (item as any).good_return_weight ?? 0
  const damageReturn = (item as any).damage_return_weight ?? 0
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
  if (!d) return "—"
  try {
    const date = d instanceof Date ? d : d?.toDate ? d.toDate() : new Date(d)
    if (isNaN(date.getTime())) return "—"
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return "—"
  }
}

function getDaysUntilExpiry(d: any): number | null {
  if (!d) return null
  try {
    const date = d instanceof Date ? d : d?.toDate ? d.toDate() : new Date(d)
    if (isNaN(date.getTime())) return null
    const now = new Date()
    return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  } catch {
    return null
  }
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

// Weight tally helper (mirrors outgoing-stock-dialog logic)
type TallyStatus = "tally" | "not-tally" | "no-data"

function getWeightTally(item: InventoryItem): {
  productionWeight: number | null
  packingWeight: number | null
  difference: number | null
  status: TallyStatus
} {
  const pw = (item as any).production_weight ?? null
  const pkw = (item as any).packing_weight ?? null
  if (pw === null || pw === undefined) {
    return { productionWeight: null, packingWeight: pkw, difference: null, status: "no-data" }
  }
  if (pkw === null || pkw === undefined) {
    return { productionWeight: pw, packingWeight: null, difference: null, status: "no-data" }
  }
  const diff = Math.abs(Number(pw) - Number(pkw))
  return {
    productionWeight: Number(pw),
    packingWeight: Number(pkw),
    difference: diff,
    status: diff <= 5 ? "tally" : "not-tally",
  }
}

/**
 * Get all batches for the same product that have stock > 0, sorted oldest-first (FIFO order).
 */
function getAvailableBatchesFifo(
  scannedItem: InventoryItem,
  allItems: InventoryItem[]
): InventoryItem[] {
  const scannedName = getProductName(scannedItem).toLowerCase().trim()
  const sameName = allItems.filter((item) => {
    const name = getProductName(item).toLowerCase().trim()
    return name === scannedName && resolveStockLeft(item) > 0
  })
  return [...sameName].sort((a, b) => {
    const aExpiry = parseDate((a as any).expiryDate ?? (a as any).expirationDate)
    const bExpiry = parseDate((b as any).expiryDate ?? (b as any).expirationDate)
    if (aExpiry && bExpiry) {
      const diff = aExpiry.getTime() - bExpiry.getTime()
      if (diff !== 0) return diff
    } else if (aExpiry && !bExpiry) {
      return -1
    } else if (!aExpiry && bExpiry) {
      return 1
    }
    const aCreated = parseDate(a.createdAt)?.getTime() ?? Infinity
    const bCreated = parseDate(b.createdAt)?.getTime() ?? Infinity
    return aCreated - bCreated
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Older Stock Modal
// ─────────────────────────────────────────────────────────────────────────────

interface OlderStockModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productName: string
  batches: InventoryItem[]
  onSelectBatch: (item: InventoryItem) => void
}

function OlderStockModal({
  open,
  onOpenChange,
  productName,
  batches,
  onSelectBatch,
}: OlderStockModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[98vw] sm:!w-auto sm:max-w-[600px] !p-0 !gap-0 !overflow-hidden">

        {/* ════ HEADER ════ */}
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <DialogHeader className="!space-y-1">
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 border border-blue-200">
                <Layers className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <span className="text-slate-800">Available Stock Batches</span>
                <p className="text-xs font-normal text-blue-700/80 mt-0.5">
                  Sorted oldest first · FIFO order
                </p>
              </div>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Select a batch below to proceed with Product Out for{" "}
              <span className="font-semibold text-slate-700">{productName}</span>.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* ════ BODY ════ */}
        <div className="px-5 sm:px-6 py-4 max-h-[60vh] overflow-y-auto space-y-3">
          {batches.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 border border-slate-200">
                <Package className="h-7 w-7 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">No other batches with available stock found.</p>
            </div>
          ) : (
            batches.map((item, idx) => {
              const stockLeft = resolveStockLeft(item)
              const expiry = (item as any).expiryDate ?? (item as any).expirationDate
              const expiryDays = getDaysUntilExpiry(expiry)
              const expiryBadge = getExpiryBadge(expiry)
              const createdAt = parseDate(item.createdAt)
              const isOldest = idx === 0

              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-xl border-2 p-4 transition-all duration-200",
                    isOldest
                      ? "border-emerald-300 bg-emerald-50/50"
                      : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/30"
                  )}
                >
                  {/* Batch header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 shrink-0">
                        #{idx + 1}
                      </span>
                      <p className="text-sm font-mono font-semibold text-slate-700 truncate">
                        {item.barcode || "No barcode"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isOldest && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-bold px-2 py-0.5 gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          FIFO First
                        </Badge>
                      )}
                      {expiryBadge && (
                        <Badge
                          className={cn("text-[10px] font-bold px-2 py-0.5 gap-1", expiryBadge.className)}
                          variant="outline"
                        >
                          <Clock className="h-3 w-3" />
                          {expiryBadge.label}
                        </Badge>
                      )}
                      <Badge
                        className={cn(
                          "text-xs font-bold px-2.5 py-0.5",
                          stockLeft <= 5
                            ? "bg-amber-100 text-amber-700 border-amber-200"
                            : "bg-emerald-100 text-emerald-700 border-emerald-200"
                        )}
                        variant="outline"
                      >
                        {stockLeft} left
                      </Badge>
                    </div>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 mb-3">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Date Added</p>
                        <p className="text-sm font-semibold text-slate-700">
                          {createdAt
                            ? createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Expiry Date</p>
                        <p className="text-sm font-semibold text-slate-700">
                          {formatDate(expiry)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Select button */}
                  <Button
                    type="button"
                    onClick={() => onSelectBatch(item)}
                    className={cn(
                      "w-full h-10 gap-2 font-semibold text-sm rounded-xl transition-all",
                      isOldest
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200"
                    )}
                  >
                    <Truck className="h-4 w-4" />
                    Use This Batch
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </Button>
                </div>
              )
            })
          )}
        </div>

        {/* ════ FOOTER ════ */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {batches.length} batch{batches.length !== 1 ? "es" : ""} available with stock
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 gap-2 text-sm rounded-xl border-slate-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ScanItemDialog({
  open,
  onOpenChange,
  inventoryItems,
  onProductOut,
  onReturnItem,
  onRegisterNew,
  initialBarcode,
  onInitialBarcodeConsumed,
}: ScanItemDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [barcodeValue, setBarcodeValue] = useState("")
  const [scanState, setScanState] = useState<ScanState>("idle")
  const [foundItem, setFoundItem] = useState<InventoryItem | null>(null)
  const [lastScannedBarcode, setLastScannedBarcode] = useState("")

  // FIFO state (for when stock IS available but older stock exists)
  const [fifoDialogOpen, setFifoDialogOpen] = useState(false)
  const [fifoResult, setFifoResult] = useState<FifoCheckResult | null>(null)

  // "View Older Stock" modal state (for when scanned batch = 0 stock)
  const [olderStockModalOpen, setOlderStockModalOpen] = useState(false)
  const [olderStockBatches, setOlderStockBatches] = useState<InventoryItem[]>([])

  // ── Reset ─────────────────────────────────────────────────────────────
  const resetScan = useCallback(() => {
    setBarcodeValue("")
    setScanState("idle")
    setFoundItem(null)
    setLastScannedBarcode("")
    setFifoResult(null)
    setOlderStockBatches([])
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  // ── Auto-focus when dialog opens ─────────────────────────────────────
  useEffect(() => {
    if (open) {
      resetScan()
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [open, resetScan])

  // ── Handle scan ──────────────────────────────────────────────────────
  const handleScan = useCallback(
    (barcode: string) => {
      const trimmed = barcode.trim()
      if (!trimmed) return

      setScanState("searching")
      setLastScannedBarcode(trimmed)
      setBarcodeValue("")

      setTimeout(() => {
        const match = inventoryItems.find(
          (item) => item.barcode?.toLowerCase() === trimmed.toLowerCase()
        )
        if (match) {
          setScanState("found")
          setFoundItem(match)
        } else {
          setScanState("not-found")
          setFoundItem(null)
        }
      }, 300)
    },
    [inventoryItems]
  )

  // ── Auto-process barcode from global scanner ────────────────────────
  useEffect(() => {
    if (open && initialBarcode && initialBarcode.trim().length > 0) {
      // Small delay to ensure modal has rendered before processing
      const timer = setTimeout(() => {
        handleScan(initialBarcode)
        onInitialBarcodeConsumed?.()
      }, 350)
      return () => clearTimeout(timer)
    }
  }, [open, initialBarcode, handleScan, onInitialBarcodeConsumed])

  // ── Key handler ──────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleScan(barcodeValue)
    }
  }

  // ── Product Out ──────────────────────────────────────────────────────
  // Only called when scanned batch has stock > 0.
  // Checks FIFO compliance; if not compliant, shows FIFO warning.
  const handleProductOut = () => {
    if (!foundItem || !onProductOut) return

    // Perform FIFO check (only relevant when scanned item has stock)
    const result = performFifoCheck(foundItem, inventoryItems)

    if (result.isFifoCompliant) {
      // Scanned item IS the oldest → proceed directly
      onProductOut(foundItem)
      onOpenChange(false)
    } else {
      // Scanned item is NOT the oldest → show FIFO warning (suggestion, not forced)
      setFifoResult(result)
      setFifoDialogOpen(true)
    }
  }

  // ── "View Older Stock" clicked ───────────────────────────────────────
  // Called when the scanned batch has 0 stock; opens the batch selection modal.
  const handleViewOlderStock = () => {
    if (!foundItem) return
    const batches = getAvailableBatchesFifo(foundItem, inventoryItems)
    setOlderStockBatches(batches)
    setOlderStockModalOpen(true)
  }

  // ── Older Stock: user selected a batch ──────────────────────────────
  const handleSelectOlderBatch = (item: InventoryItem) => {
    setOlderStockModalOpen(false)
    if (onProductOut) {
      onProductOut(item)
      onOpenChange(false)
    }
  }

  // ── FIFO: proceed with oldest stock ─────────────────────────────────
  const handleFifoProceedWithOldest = (item: InventoryItem) => {
    setFifoDialogOpen(false)

    // Log FIFO compliance
    logFifoAction(item, foundItem!, "FIFO_FOLLOWED", "")

    if (onProductOut) {
      onProductOut(item)
      onOpenChange(false)
    }
  }

  // ── FIFO: override and proceed with scanned item ────────────────────
  const handleFifoProceedWithScanned = (item: InventoryItem, reason: string) => {
    setFifoDialogOpen(false)

    // Log FIFO override
    logFifoAction(item, fifoResult?.oldestItem ?? item, "FIFO_OVERRIDDEN", reason)

    if (onProductOut) {
      onProductOut(item)
      onOpenChange(false)
    }
  }

  // ── Log FIFO action to transactions ─────────────────────────────────
  const logFifoAction = async (
    selectedItem: InventoryItem,
    alternativeItem: InventoryItem,
    action: "FIFO_FOLLOWED" | "FIFO_OVERRIDDEN",
    reason: string
  ) => {
    try {
      const { FirebaseService } = await import("@/services/firebase-service")
      await FirebaseService.addDocument("fifo_logs", {
        action,
        selected_item_id: selectedItem.id,
        selected_item_barcode: selectedItem.barcode || "",
        selected_item_name: getProductName(selectedItem),
        alternative_item_id: alternativeItem.id,
        alternative_item_barcode: alternativeItem.barcode || "",
        alternative_item_name: getProductName(alternativeItem),
        override_reason: reason,
        timestamp: new Date(),
      })
      console.log(`[FIFO] Logged ${action} — selected: ${selectedItem.barcode}, alternative: ${alternativeItem.barcode}`)
    } catch (err) {
      console.warn("[FIFO] Failed to log FIFO action:", err)
    }
  }

  const handleReturnItem = () => {
    if (foundItem && onReturnItem) {
      onReturnItem(foundItem)
      onOpenChange(false)
    }
  }

  const handleRegisterNew = () => {
    if (onRegisterNew) {
      onRegisterNew(lastScannedBarcode)
      onOpenChange(false)
    }
  }

  const stockLeft = foundItem ? resolveStockLeft(foundItem) : 0

  // Compute FIFO info for display badge when item has stock (stock > 0 only)
  const fifoInfo = foundItem && stockLeft > 0
    ? performFifoCheck(foundItem, inventoryItems)
    : null

  // When stock = 0, check if OTHER batches of same product have stock
  const hasOlderStockAvailable =
    foundItem && stockLeft <= 0
      ? getAvailableBatchesFifo(foundItem, inventoryItems).length > 0
      : false

  // Expiry days for badge
  const expiryDays = foundItem
    ? getDaysUntilExpiry((foundItem as any).expiryDate ?? (foundItem as any).expirationDate)
    : null

  // Weight tally for found item
  const weightTally = foundItem ? getWeightTally(foundItem) : null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!w-[98vw] sm:!w-auto sm:max-w-[680px] !p-0 !gap-0">

          {/* ════════ HEADER ════════ */}
          <div className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-slate-100">
            <DialogHeader className="!space-y-1">
              <DialogTitle className="flex items-center gap-2 sm:gap-2.5 text-lg sm:text-xl">
                <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-violet-100">
                  <ScanLine className="h-4 w-4 sm:h-5 sm:w-5 text-violet-600" />
                </div>
                Scan Item
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-slate-500">
                Scan a barcode using your USB scanner or type it manually and press Enter.
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* ════════ SCANNER INPUT ════════ */}
          <div className="px-3 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4">
            <div className="relative">
              <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-violet-400" />
              <Input
                ref={inputRef}
                value={barcodeValue}
                onChange={(e) => setBarcodeValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Scan barcode or type manually…"
                className="pl-11 sm:pl-12 pr-16 sm:pr-20 h-12 sm:h-14 text-base sm:text-lg font-mono tracking-wider border-2 border-violet-200 focus-visible:ring-violet-300 focus-visible:border-violet-400 rounded-xl bg-white"
                autoFocus
                autoComplete="off"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {barcodeValue && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-xs text-slate-400 hover:text-slate-600"
                    onClick={() => {
                      setBarcodeValue("")
                      inputRef.current?.focus()
                    }}
                  >
                    Clear
                  </Button>
                )}
                <kbd className="hidden sm:inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                  <CornerDownLeft className="h-3 w-3" /> Enter
                </kbd>
              </div>
            </div>
          </div>

          {/* ════════ CONTENT AREA ════════ */}
          <div className="px-3 sm:px-6 pb-4 sm:pb-6">

            {/* ── IDLE STATE ────────────────────────────────────────── */}
            {scanState === "idle" && (
              <div className="flex flex-col items-center gap-3 py-8 sm:py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 border border-violet-100">
                  <ScanLine className="h-8 w-8 text-violet-300" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Ready to scan</p>
                  <p className="text-xs text-slate-400 mt-0.5">Point your scanner at a barcode — input captures automatically.</p>
                </div>
              </div>
            )}

            {/* ── SEARCHING ─────────────────────────────────────────── */}
            {scanState === "searching" && (
              <div className="flex items-center justify-center gap-3 py-12">
                <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                <p className="text-sm font-medium text-slate-600">Searching for barcode…</p>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                FOUND — Product Info
            ══════════════════════════════════════════════════════════ */}
            {scanState === "found" && foundItem && (
              <div className="grid gap-4 animate-in fade-in-0 slide-in-from-bottom-3 duration-300">

                {/* Match status banner */}
                <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-emerald-700">Barcode Matched</p>
                    <p className="text-xs text-emerald-600/70 font-mono">{lastScannedBarcode}</p>
                  </div>
                  {/* FIFO status indicator removed for Product Checker mode */}
                </div>

                {/* Product Info Card */}
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  {/* Product header */}
                  <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-bold text-slate-800 leading-tight">
                          {getProductName(foundItem)}
                        </p>
                        <p className="text-sm text-slate-400 font-mono mt-1">{foundItem.barcode}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Near Expiry badge */}
                        {expiryDays !== null && expiryDays <= 30 && expiryDays >= 0 && (
                          <Badge
                            className={cn(
                              "text-[10px] font-bold px-2 py-0.5 gap-1",
                              expiryDays <= 3
                                ? "bg-red-100 text-red-700 border-red-200"
                                : expiryDays <= 7
                                  ? "bg-amber-100 text-amber-700 border-amber-200"
                                  : "bg-orange-100 text-orange-700 border-orange-200"
                            )}
                            variant="outline"
                          >
                            <Clock className="h-3 w-3" />
                            {expiryDays <= 0 ? "Expired" : `${expiryDays}d left`}
                          </Badge>
                        )}
                        {expiryDays !== null && expiryDays < 0 && (
                          <Badge className="text-[10px] font-bold px-2 py-0.5 gap-1 bg-red-100 text-red-700 border-red-200" variant="outline">
                            <AlertTriangle className="h-3 w-3" />
                            Expired
                          </Badge>
                        )}
                        <Badge
                          className={cn(
                            "text-sm font-bold px-3 py-1 shrink-0",
                            stockLeft <= 0
                              ? "bg-red-100 text-red-700 border-red-200"
                              : stockLeft <= 125
                                ? "bg-amber-100 text-amber-700 border-amber-200"
                                : "bg-emerald-100 text-emerald-700 border-emerald-200"
                          )}
                          variant="outline"
                        >
                          {stockLeft.toFixed(1)} kg ({Math.floor(stockLeft / 25)} bx) left
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Info grid — 2 columns */}
                  <div className="p-3 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 sm:gap-y-4">
                    {/* Category */}
                    <div className="flex items-start gap-3">
                      <Package className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Category</p>
                        <p className="text-sm font-semibold text-slate-700 mt-0.5">{foundItem.category}</p>
                      </div>
                    </div>

                    {/* Subcategory */}
                    <div className="flex items-start gap-3">
                      <Package className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Subcategory</p>
                        <p className="text-sm font-semibold text-slate-700 mt-0.5">
                          {(foundItem as any).subcategory || "—"}
                        </p>
                      </div>
                    </div>

                    {/* Incoming */}
                    <div className="flex items-start gap-3">
                      <ArrowRightLeft className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Incoming</p>
                        <p className="text-sm font-semibold text-slate-700 mt-0.5">
                          {((foundItem as any).incoming_weight ?? (foundItem as any).production_weight ?? 0).toFixed(1)} kg
                        </p>
                        <p className="text-[10px] text-slate-400">≈ {Math.floor(((foundItem as any).incoming_weight ?? (foundItem as any).production_weight ?? 0) / 25)} boxes</p>
                      </div>
                    </div>

                    {/* Outgoing */}
                    <div className="flex items-start gap-3">
                      <ArrowRightLeft className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Outgoing</p>
                        <p className="text-sm font-semibold text-slate-700 mt-0.5">
                          {((foundItem as any).outgoing_weight ?? 0).toFixed(1)} kg
                        </p>
                        <p className="text-[10px] text-slate-400">≈ {Math.floor(((foundItem as any).outgoing_weight ?? 0) / 25)} boxes</p>
                      </div>
                    </div>

                    {/* Good Return */}
                    <div className="flex items-start gap-3">
                      <RotateCcw className="h-4 w-4 text-sky-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Good Return</p>
                        <p className="text-sm font-semibold text-slate-700 mt-0.5">
                          {((foundItem as any).good_return_weight ?? 0).toFixed(1)} kg
                        </p>
                      </div>
                    </div>

                    {/* Damage Return */}
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Damage Return</p>
                        <p className="text-sm font-semibold text-slate-700 mt-0.5">
                          {((foundItem as any).damage_return_weight ?? 0).toFixed(1)} kg
                        </p>
                      </div>
                    </div>

                    {/* Expiry Date */}
                    <div className="flex items-start gap-3">
                      <CalendarDays className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Expiry Date</p>
                        <p className="text-sm font-semibold text-slate-700 mt-0.5">
                          {formatDate((foundItem as any).expiryDate ?? (foundItem as any).expirationDate)}
                        </p>
                      </div>
                    </div>

                    {/* Production Weight */}
                    <div className="flex items-start gap-3">
                      <Scale className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Production Weight</p>
                        <p className="text-sm font-semibold text-slate-700 mt-0.5">
                          {weightTally?.productionWeight !== null && weightTally?.productionWeight !== undefined
                            ? `${Number(weightTally.productionWeight).toFixed(1)} kg`
                            : "N/A"}
                        </p>
                      </div>
                    </div>

                    {/* Packing Weight */}
                    <div className="flex items-start gap-3">
                      <Scale className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Packing Weight</p>
                        <p className="text-sm font-semibold text-slate-700 mt-0.5">
                          {weightTally?.packingWeight !== null && weightTally?.packingWeight !== undefined
                            ? `${Number(weightTally.packingWeight).toFixed(1)} kg`
                            : "N/A"}
                        </p>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Weight Tally Status Banner */}
                {weightTally && weightTally.status !== "no-data" && weightTally.difference !== null && (
                  <div
                    className={cn(
                      "rounded-xl border px-4 py-3 flex items-start gap-3 animate-in fade-in-0 duration-200",
                      weightTally.status === "tally"
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-red-50 border-red-200"
                    )}
                  >
                    {weightTally.status === "tally" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          "text-sm font-semibold",
                          weightTally.status === "tally" ? "text-emerald-700" : "text-red-700"
                        )}>
                          {weightTally.status === "tally" ? "Weight Tally ✅" : "Not Tally ⚠️"}
                        </p>
                        <span className={cn(
                          "text-[11px] font-bold px-2 py-0.5 rounded-full border",
                          weightTally.status === "tally"
                            ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                            : "bg-red-100 text-red-700 border-red-300"
                        )}>
                          {weightTally.difference.toFixed(1)} kg diff
                        </span>
                      </div>
                      <p className={cn(
                        "text-xs mt-0.5",
                        weightTally.status === "tally" ? "text-emerald-600/80" : "text-red-600/80"
                      )}>
                        Production: <b>{weightTally.productionWeight !== null ? `${Number(weightTally.productionWeight).toFixed(1)} kg` : "N/A"}</b>
                        {" · "}
                        Packing: <b>{weightTally.packingWeight !== null ? `${Number(weightTally.packingWeight).toFixed(1)} kg` : "N/A"}</b>
                      </p>
                    </div>
                  </div>
                )}

                {/* FIFO suggestion banner removed for Product Checker mode */}

                {/* ── OUT OF STOCK: Warning + View Older Stock ─────────────── */}
                {stockLeft <= 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 overflow-hidden animate-in fade-in-0 duration-200">
                    <div className="px-4 py-3 flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 border border-red-200 shrink-0">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-red-700">Scanned batch is out of stock</p>
                        <p className="text-xs text-red-600/80 mt-0.5">
                          This batch has no remaining stock.
                          {hasOlderStockAvailable
                            ? " You can view older available stock for this product."
                            : " No other batches are available for this product."}
                        </p>
                      </div>
                    </div>

                    {/* "View Older Stock" button removed for Product Checker mode */}
                  </div>
                )}

                {/* ── Action Buttons ── Return Item only ── */}
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReturnItem}
                    className="w-full h-12 gap-2 font-semibold text-sm rounded-xl border-2 border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400"
                  >
                    <RotateCcw className="h-5 w-5" />
                    Return Item
                  </Button>
                </div>

                {/* Scan again */}
                <div className="flex justify-center pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetScan}
                    className="gap-2 text-sm text-slate-400 hover:text-slate-600"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Scan Another Item
                  </Button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                NOT FOUND
            ══════════════════════════════════════════════════════════ */}
            {scanState === "not-found" && (
              <div className="grid gap-4 animate-in fade-in-0 slide-in-from-bottom-3 duration-300">
                {/* Warning banner */}
                <div className="flex items-center gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-amber-700">Barcode Not Found</p>
                    <p className="text-xs text-amber-600/70 font-mono">{lastScannedBarcode}</p>
                  </div>
                </div>

                {/* Empty state card */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col items-center gap-3 py-10">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 border border-amber-200">
                    <AlertTriangle className="h-7 w-7 text-amber-500" />
                  </div>
                  <p className="text-sm text-slate-500 max-w-[280px] text-center leading-relaxed">
                    No item in inventory matches this barcode. You can register it as a new item or try scanning again.
                  </p>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Button
                    type="button"
                    onClick={handleRegisterNew}
                    className="h-12 gap-2.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm rounded-xl"
                  >
                    <PackagePlus className="h-5 w-5" />
                    Register as New Item
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetScan}
                    className="h-12 gap-2.5 font-semibold text-sm rounded-xl border-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Scan Again
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── FIFO Warning Dialog (opens on top of scan dialog) — only for stock > 0 ── */}
      <FifoWarningDialog
        open={fifoDialogOpen}
        onOpenChange={setFifoDialogOpen}
        fifoResult={fifoResult}
        onProceedWithOldest={handleFifoProceedWithOldest}
        onProceedWithScanned={handleFifoProceedWithScanned}
        onCancel={() => setFifoDialogOpen(false)}
      />

      {/* ── Older Stock Selection Modal — for when scanned batch = 0 stock ── */}
      <OlderStockModal
        open={olderStockModalOpen}
        onOpenChange={setOlderStockModalOpen}
        productName={foundItem ? getProductName(foundItem) : ""}
        batches={olderStockBatches}
        onSelectBatch={handleSelectOlderBatch}
      />
    </>
  )
}
