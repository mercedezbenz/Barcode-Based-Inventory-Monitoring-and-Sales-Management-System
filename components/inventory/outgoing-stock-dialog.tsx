"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  PackageOpen,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  PackageMinus,
  Loader2,
  Lock,
  Package,
  Scale,
  ShieldCheck,
  ChevronRight,
  Layers,
  Clock,
  CalendarDays,
  Truck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"
import {
  InventoryService,
  TransactionService,
} from "@/services/firebase-service"
import type { InventoryItem } from "@/lib/types"
import { performFifoCheck } from "./fifo-warning-dialog"

// ---
// Types
// ---

interface OutgoingStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  inventoryItems: InventoryItem[]
  scannedItem?: InventoryItem | null
}

// ---
// Helpers
// ---

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

function getExpiryDateObj(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function getCreatedAtObj(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function isDateNearExpiry(val: any): boolean {
  const expiry = getExpiryDateObj(val);
  if (!expiry) return false;
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays <= 90;
}

// ---
// Batch / FIFO helpers
// ---

/**
 * Returns all batches for the same product (by name) that have stock > 0,
 * sorted oldest-first (FIFO order — by expiry date, then createdAt).
 */
function getAvailableBatchesFifo(
  referenceItem: InventoryItem,
  allItems: InventoryItem[]
): InventoryItem[] {
  const refName = getProductName(referenceItem).toLowerCase().trim()
  const same = allItems.filter((item) => {
    const name = getProductName(item).toLowerCase().trim()
    return name === refName && resolveStockLeft(item) > 0
  })
  return [...same].sort((a, b) => {
    const aExpiry = getExpiryDateObj((a as any).expiryDate ?? (a as any).expirationDate)
    const bExpiry = getExpiryDateObj((b as any).expiryDate ?? (b as any).expirationDate)
    if (aExpiry && bExpiry) {
      const diff = aExpiry.getTime() - bExpiry.getTime()
      if (diff !== 0) return diff
    } else if (aExpiry && !bExpiry) {
      return -1
    } else if (!aExpiry && bExpiry) {
      return 1
    }
    const aCreated = getCreatedAtObj(a.createdAt)?.getTime() ?? Infinity
    const bCreated = getCreatedAtObj(b.createdAt)?.getTime() ?? Infinity
    return aCreated - bCreated
  })
}

function formatDateShort(val: any): string {
  const d = getExpiryDateObj(val)
  if (!d) return "—"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function getDaysUntilExpiry(val: any): number | null {
  const d = getExpiryDateObj(val)
  if (!d) return null
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function getExpiryBadgeInfo(val: any): { label: string; className: string } | null {
  const days = getDaysUntilExpiry(val)
  if (days === null) return null
  if (days < 0) return { label: "Expired", className: "bg-red-100 text-red-700 border-red-200" }
  if (days <= 3) return { label: `${days}d left`, className: "bg-red-100 text-red-700 border-red-200" }
  if (days <= 7) return { label: `${days}d left`, className: "bg-amber-100 text-amber-700 border-amber-200" }
  if (days <= 90) return { label: `${days}d left`, className: "bg-orange-100 text-orange-700 border-orange-200" }
  return null
}

// ---
// Older Stock Modal (mirrors scan-item-dialog OlderStockModal)
// ---

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
              const expiryBadge = getExpiryBadgeInfo(expiry)
              const createdAt = getCreatedAtObj(item.createdAt)
              const isOldest = idx === 0
              const tally = getWeightTally(item)

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
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
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
                      {tally.status === "tally" && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-bold px-2 py-0.5 gap-1" variant="outline">
                          <CheckCircle2 className="h-3 w-3" /> Tally
                        </Badge>
                      )}
                      {tally.status === "not-tally" && (
                        <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] font-bold px-2 py-0.5 gap-1" variant="outline">
                          <AlertTriangle className="h-3 w-3" /> Not Tally
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
                        {stockLeft.toFixed(1)} kg ({Math.floor(stockLeft / 25)} boxes) left
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
                          {formatDateShort(expiry)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Oldest recommendation label */}
                  {isOldest && (
                    <p className="text-[11px] text-emerald-700 font-medium mb-2">
                      ✅ Oldest stock — FIFO Suggested (Recommended)
                    </p>
                  )}

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

// ---
// Weight tally helpers
// ---

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

// Inline reusable weight tally display block
function WeightTallyBlock({ item, compact = false }: { item: InventoryItem; compact?: boolean }) {
  const { productionWeight, packingWeight, difference, status } = getWeightTally(item)

  if (status === "no-data" && productionWeight === null && packingWeight === null) return null

  return (
    <div
      className={cn(
        "rounded-xl border p-4 flex flex-col gap-2",
        status === "not-tally"
          ? "bg-red-50 border-red-200"
          : status === "tally"
            ? "bg-emerald-50 border-emerald-200"
            : "bg-slate-50 border-slate-200"
      )}
    >
      {/* Weight rows */}
      <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
        <div className="flex items-center justify-between gap-2 bg-white/60 rounded-lg px-3 py-2 border border-white/80">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Production Wt.</span>
          <span className="text-sm font-bold text-slate-800">
            {productionWeight !== null ? `${Number(productionWeight).toFixed(1)} kg` : "N/A"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 bg-white/60 rounded-lg px-3 py-2 border border-white/80">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Packing Wt.</span>
          <span className="text-sm font-bold text-slate-800">
            {packingWeight !== null ? `${Number(packingWeight).toFixed(1)} kg` : "N/A"}
          </span>
        </div>
      </div>

      {/* Tally status */}
      {status !== "no-data" && difference !== null && (
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-current/10">
          <span className="text-xs font-medium text-slate-500">Difference: {difference.toFixed(1)} kg</span>
          <div className="flex items-center gap-1.5">
            {status === "tally" ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">
                <CheckCircle2 className="h-3 w-3" /> Tally ✅
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold bg-red-100 text-red-700 border border-red-300">
                <AlertTriangle className="h-3 w-3" /> Not Tally ⚠️
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---
// Component
// ---

export function OutgoingStockDialog({
  open,
  onOpenChange,
  inventoryItems,
  scannedItem,
}: OutgoingStockDialogProps) {
  const { user } = useAuth()

  // State
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [weight, setWeight] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [filterType, setFilterType] = useState<"all" | "near_expiry" | "pork" | "chicken" | "beef">("all")
  const [sortBy, setSortBy] = useState<"added_desc" | "added_asc" | "expiry_asc" | "expiry_desc">("added_desc")
  const [showWeightWarning, setShowWeightWarning] = useState(false)

  // "See Older Stock" modal state
  const [olderStockModalOpen, setOlderStockModalOpen] = useState(false)
  const [olderStockBatches, setOlderStockBatches] = useState<InventoryItem[]>([])
  const [olderStockRefItem, setOlderStockRefItem] = useState<InventoryItem | null>(null)

  // FIFO status is computed automatically from selectedItem — no manual state needed

  // Items with stock > 0
  const availableItems = useMemo(
    () =>
      inventoryItems
        .filter((item) => resolveStockLeft(item) > 0)
        .sort((a, b) => getProductName(a).localeCompare(getProductName(b))),
    [inventoryItems]
  )

  // Search, Filter, and Sort
  const filteredItems = useMemo(() => {
    let result = availableItems;

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (item) =>
          getProductName(item).toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.subcategory || "").toLowerCase().includes(q) ||
          (item.barcode || "").toLowerCase().includes(q)
      )
    }

    if (filterType === "near_expiry") {
      result = result.filter(item => {
         const val = (item as any).expiryDate || (item as any).expirationDate;
         return isDateNearExpiry(val);
      })
    } else if (filterType !== "all") {
      result = result.filter(item => {
        const typeStr = [
          (item as any).productType,
          item.category,
          item.subcategory,
          getProductName(item)
        ].join(" ").toLowerCase();
        return typeStr.includes(filterType);
      })
    }

    result = [...result].sort((a, b) => {
       if (sortBy === "added_desc" || sortBy === "added_asc") {
         const aTime = getCreatedAtObj(a.createdAt)?.getTime() || 0;
         const bTime = getCreatedAtObj(b.createdAt)?.getTime() || 0;
         return sortBy === "added_desc" ? bTime - aTime : aTime - bTime;
       }
       if (sortBy === "expiry_asc" || sortBy === "expiry_desc") {
         const aExp = getExpiryDateObj((a as any).expiryDate || (a as any).expirationDate)?.getTime() || Infinity;
         const bExp = getExpiryDateObj((b as any).expiryDate || (b as any).expirationDate)?.getTime() || Infinity;
         return sortBy === "expiry_asc" ? aExp - bExp : bExp - aExp;
       }
       return 0;
    })

    return result;
  }, [availableItems, search, filterType, sortBy])

  const stockLeft = selectedItem ? resolveStockLeft(selectedItem) : 0
  const weightNum = Math.max(0, Number(weight) || 0)
  const computedBoxes = Math.floor(weightNum / 25)

  // Reset
  const reset = useCallback(() => {
    setSelectedItem(null)
    setWeight("")
    setSearch("")
    setFilterType("all")
    setSortBy("added_desc")
    setErrors({})
    setShowWeightWarning(false)
    setOlderStockModalOpen(false)
    setOlderStockBatches([])
    setOlderStockRefItem(null)
  }, [])

  // Product select — detect unit from transactions
  const handleProductSelect = useCallback(
    (item: InventoryItem) => {
      setSelectedItem(item)
      setWeight("")
      setErrors({})
    },
    []
  )

  // Compute FIFO status automatically whenever selectedItem changes
  const fifoStatus = selectedItem
    ? performFifoCheck(selectedItem, inventoryItems)
    : null

  // "See Older Stock" handler — opens batch selection modal for a product
  const handleSeeOlderStock = useCallback(
    (item: InventoryItem, e: React.MouseEvent) => {
      e.stopPropagation()
      const batches = getAvailableBatchesFifo(item, availableItems)
      setOlderStockRefItem(item)
      setOlderStockBatches(batches)
      setOlderStockModalOpen(true)
    },
    [availableItems]
  )

  // When user picks a batch from the modal → move to Step 2 with that batch
  const handleSelectOlderBatch = useCallback(
    async (item: InventoryItem) => {
      setOlderStockModalOpen(false)
      setOlderStockBatches([])
      setOlderStockRefItem(null)
      await handleProductSelect(item)
    },
    [handleProductSelect]
  )

  // Open/close effects
  useEffect(() => {
    if (!open) {
      reset()
    } else if (scannedItem) {
      handleProductSelect(scannedItem)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Quantity change handler
  const handleWeightChange = (rawValue: string) => {
    if (rawValue === "") {
      setWeight("")
      setErrors((p) => ({ ...p, weight: "" }))
      return
    }
    const num = parseFloat(rawValue)
    if (isNaN(num) || num < 0) return
    setWeight(rawValue)
    if (num > stockLeft) {
      setErrors((p) => ({
        ...p,
        weight: `Cannot exceed available stock (${stockLeft.toFixed(1)} kg).`,
      }))
    } else {
      setErrors((p) => ({ ...p, weight: "" }))
    }
  }

  // Submit — simple stock deduction
  const handleConfirm = async () => {
    // Validate
    const newErrors: Record<string, string> = {}
    if (!selectedItem) {
      newErrors.product = "Please select a product."
    }
    if (!weightNum || weightNum <= 0) {
      newErrors.weight = "Weight must be greater than 0."
    } else if (weightNum > stockLeft) {
      newErrors.weight = `Cannot exceed available stock (${stockLeft.toFixed(1)} kg).`
    }

    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return
    if (!user || !selectedItem) return

    // Weight tally check — show warning before proceeding
    if (!showWeightWarning && selectedItem) {
      const tally = getWeightTally(selectedItem)
      if (tally.status === "not-tally") {
        setShowWeightWarning(true)
        return
      }
    }
    setShowWeightWarning(false)

    setLoading(true)
    try {
      const newWeightLeft = stockLeft - weightNum

      // 1. Update inventory item
      await InventoryService.updateItem(selectedItem.id, {
        outgoing_weight: ((selectedItem as any).outgoing_weight ?? 0) + weightNum,
        outgoing_boxes: ((selectedItem as any).outgoing_boxes ?? 0) + computedBoxes,
      } as any)

      // 2. Create transaction ledger entry (append-only)
      const txnProductName = getProductName(selectedItem)
      console.log("[ProductOut] TRANSACTION SAVED:", { product_name: txnProductName, barcode: selectedItem.barcode, weight: weightNum })

      await TransactionService.addTransaction({
        transaction_date: new Date(),
        movement_type: "Outgoing",
        product_name: txnProductName,
        product_id: (selectedItem as any).product_id || null,
        barcode: selectedItem.barcode || "",
        barcode_base: (selectedItem as any).barcode_base || null,
        category: selectedItem.category,
        type:
          (selectedItem as any).productType ||
          (selectedItem as any).subcategory ||
          "",
        unit_type: "BOX",
        outgoing_weight: weightNum,
        outgoing_boxes: computedBoxes,
        outgoing_unit: "box",
        stock_left_weight: newWeightLeft,
        expiry_date:
          (selectedItem as any).expiryDate ||
          (selectedItem as any).expirationDate ||
          null,
        reference_no: "",
        source: "delivery",
        created_at: new Date(),
      } as any)

      toast.success("Success", {
        description: "Product successfully released (stock out).",
      })

      reset()
      onOpenChange(false)
    } catch (error: any) {
      console.error("[ProductOut] Error:", error)
      toast.error("Error", {
        description: "Something went wrong. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  const unitLabel = "Boxes"

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* ── WIDER MODAL: max-w-3xl ── */}
      <DialogContent className="!w-[98vw] sm:!w-[95vw] !max-w-3xl !p-0 !overflow-hidden flex flex-col max-h-[90vh]">

        {/* ── HEADER (sticky) ── */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600 shrink-0">
                <PackageMinus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-800">Product Out</DialogTitle>
                <DialogDescription className="text-xs mt-0.5 text-slate-500">
                  {selectedItem
                    ? "Enter weight to deduct from stock"
                    : "Select a product with available stock to proceed"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* ── BODY (scrollable) ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5">
            {!selectedItem ? (
              /* ═══ STEP 1: Product Selection ═══ */
              <div className="grid gap-4">

                {/* ── Search + Filters Row ── */}
                <div className="flex flex-col sm:flex-row gap-2">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search by name, category, or barcode..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 h-10 w-full"
                      autoFocus
                    />
                  </div>

                  {/* Filter + Sort */}
                  <div className="flex gap-2 shrink-0">
                    <Select value={filterType} onValueChange={(val: any) => setFilterType(val)}>
                      <SelectTrigger className="w-[140px] h-10 text-xs">
                        <SelectValue placeholder="Show..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">All Products</SelectItem>
                        <SelectItem value="pork" className="text-xs">Pork</SelectItem>
                        <SelectItem value="chicken" className="text-xs">Chicken</SelectItem>
                        <SelectItem value="beef" className="text-xs">Beef</SelectItem>
                        <SelectItem value="near_expiry" className="text-xs border-t mt-1">Near Expiry</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                      <SelectTrigger className="w-[160px] h-10 text-xs">
                        <SelectValue placeholder="Sort by..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="added_desc" className="text-xs">Date Added (Newest)</SelectItem>
                        <SelectItem value="added_asc" className="text-xs">Date Added (Oldest)</SelectItem>
                        <SelectItem value="expiry_asc" className="text-xs">Expiry (Soonest)</SelectItem>
                        <SelectItem value="expiry_desc" className="text-xs">Expiry (Farthest)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Result count */}
                {search.trim() && (
                  <p className="text-xs text-slate-400 -mt-1">
                    {filteredItems.length} result{filteredItems.length !== 1 ? "s" : ""} found
                  </p>
                )}

                {/* ── Product List ── */}
                <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                  {filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-14 text-slate-400">
                      <PackageOpen className="h-10 w-10 opacity-30" />
                      <p className="text-sm font-medium">
                        {availableItems.length === 0
                          ? "No items with available stock"
                          : "No items match your search"}
                      </p>
                    </div>
                  ) : (
                    filteredItems.map((item) => {
                      const stock = resolveStockLeft(item)
                      const tally = getWeightTally(item)
                      const isNotTally = tally.status === "not-tally"
                      const nearExpiry = isDateNearExpiry((item as any).expiryDate || (item as any).expirationDate)
                      // FIFO badge
                      const fifoCheck = performFifoCheck(item, availableItems)
                      const isFifoOldest = fifoCheck.isFifoCompliant && fifoCheck.availableBatches.length > 1
                      const hasOlderStock = !fifoCheck.isFifoCompliant
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleProductSelect(item)}
                          className={cn(
                            // ── Two-column flex layout ──
                            "w-full flex items-center justify-between gap-4 px-5 py-4 text-left",
                            "transition-colors hover:bg-slate-50 active:bg-slate-100",
                            isNotTally && "bg-red-50/40 border-l-[3px] border-l-red-400",
                            hasOlderStock && !isNotTally && "border-l-[3px] border-l-amber-300"
                          )}
                        >
                          {/* ── LEFT: Product Info ── */}
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            {/* Icon */}
                            <div className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-lg shrink-0 mt-0.5",
                              isNotTally ? "bg-red-100" : nearExpiry ? "bg-orange-100" : "bg-slate-100"
                            )}>
                              <Package className={cn(
                                "h-4 w-4",
                                isNotTally ? "text-red-500" : nearExpiry ? "text-orange-500" : "text-slate-500"
                              )} />
                            </div>

                            {/* Text block */}
                            <div className="min-w-0 flex-1">
                              {/* Product name */}
                              <p className="font-semibold text-sm text-slate-800 truncate max-w-[240px] sm:max-w-none" title={getProductName(item)}>
                                {getProductName(item)}
                              </p>
                              {/* Barcode / Category */}
                              <p className="text-xs text-slate-400 mt-0.5 truncate">
                                {item.category}
                                {item.barcode && (
                                  <span className="font-mono"> · {item.barcode}</span>
                                )}
                              </p>
                              {/* Weight info */}
                              {(tally.productionWeight !== null || tally.packingWeight !== null) && (
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                                    <Scale className="h-3 w-3 text-slate-400" />
                                    <span className="font-medium">Prod:</span>
                                    {tally.productionWeight !== null ? ` ${Number(tally.productionWeight).toFixed(1)} kg` : " N/A"}
                                  </span>
                                  <span className="text-slate-300">·</span>
                                  <span className="text-[11px] text-slate-500">
                                    <span className="font-medium">Pack:</span>
                                    {tally.packingWeight !== null ? ` ${Number(tally.packingWeight).toFixed(1)} kg` : " N/A"}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* ── RIGHT: Badges + Stock ── */}
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            {/* Status badges row */}
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              {nearExpiry && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                                  <AlertTriangle className="h-3 w-3" /> Near Expiry
                                </span>
                              )}
                              {tally.status === "tally" && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                                  <CheckCircle2 className="h-3 w-3" /> Tally
                                </span>
                              )}
                              {isNotTally && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                                  <AlertTriangle className="h-3 w-3" /> Not Tally
                                </span>
                              )}
                              {isFifoOldest && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                                  <ShieldCheck className="h-3 w-3" /> FIFO
                                </span>
                              )}
                              {hasOlderStock && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                                  <AlertTriangle className="h-3 w-3" /> Older Stock
                                </span>
                              )}
                            </div>

                            {/* ── See Older Stock button ── */}
                            {fifoCheck.availableBatches.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => handleSeeOlderStock(item, e)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline mt-1 transition-colors"
                              >
                                <Layers className="h-3 w-3" />
                                See Older Stock ({fifoCheck.availableBatches.length} batches)
                              </button>
                            )}
                            {/* Stock remaining badge */}
                            <Badge
                              className={cn(
                                "text-xs font-bold px-3 py-1",
                                stock <= 5
                                  ? "bg-orange-100 text-orange-700 border-orange-200"
                                  : "bg-emerald-100 text-emerald-700 border-emerald-200"
                              )}
                              variant="outline"
                            >
                              {stock} left
                            </Badge>
                          </div>

                          {/* Chevron */}
                          <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 ml-1" />
                        </button>
                      )
                    })
                  )}
                </div>

                {errors.product && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {errors.product}
                  </p>
                )}
              </div>
            ) : (
              /* ═══ STEP 2: Quantity Input ═══ */
              <div className="grid gap-5">

                {/* ── Back + Selected Product Card ── */}
                <div className="flex items-start gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (!scannedItem) {
                        setSelectedItem(null)
                        setWeight("")
                        setErrors({})
                        setShowWeightWarning(false)
                      }
                    }}
                    className={cn(
                      "h-9 w-9 shrink-0 mt-0.5",
                      scannedItem && "opacity-30 cursor-not-allowed"
                    )}
                    disabled={!!scannedItem}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0 flex-1 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                    <p className="font-bold text-base text-slate-900 truncate">
                      {getProductName(selectedItem)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedItem.category}
                      {selectedItem.barcode && (
                        <span className="font-mono"> · {selectedItem.barcode}</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* ── Weight Tally Card ── */}
                <WeightTallyBlock item={selectedItem} />

                {/* ── Stock Info Card (3-column) ── */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="grid grid-cols-3 gap-4 text-center divide-x divide-slate-200">
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Current Stock
                      </p>
                      <p className="text-xl sm:text-2xl font-bold text-slate-800">
                        {stockLeft.toFixed(1)} <span className="text-[10px] text-slate-400">kg</span>
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {Math.floor(stockLeft / 25)} boxes
                      </p>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        To Deduct
                      </p>
                      <p
                        className={cn(
                          "text-xl sm:text-2xl font-bold",
                          weightNum > stockLeft
                            ? "text-red-600"
                            : weightNum > 0
                              ? "text-orange-600"
                              : "text-slate-300"
                        )}
                      >
                        {weightNum > 0 ? `-${weightNum.toFixed(1)}` : "0"} <span className="text-[10px]">kg</span>
                      </p>
                      {weightNum > 0 && (
                         <p className="text-[10px] text-orange-400 font-medium">
                           -{computedBoxes} boxes
                         </p>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Remaining
                      </p>
                      <p
                        className={cn(
                          "text-xl sm:text-2xl font-bold",
                          stockLeft - weightNum <= 0
                            ? "text-red-600"
                            : stockLeft - weightNum <= 125
                              ? "text-orange-600"
                              : "text-emerald-600"
                        )}
                      >
                        {Math.max(0, stockLeft - weightNum).toFixed(1)} <span className="text-[10px]">kg</span>
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {Math.max(0, Math.floor((stockLeft - weightNum) / 25))} boxes
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── Quantity + Unit ── */}
                <div className="grid gap-3">
                  <div className="grid grid-cols-[1fr_130px] gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-sm font-semibold text-slate-700">
                        Weight to Deduct (kg) <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Scale className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="number"
                          step="0.01"
                          min="0.1"
                          max={stockLeft}
                          value={weight}
                          onChange={(e) => handleWeightChange(e.target.value)}
                          placeholder={`0.1 – ${stockLeft.toFixed(1)}`}
                          className={cn(
                            "h-12 pl-9 text-xl font-bold",
                            errors.weight ? "border-destructive focus-visible:ring-destructive/20" : "border-slate-200 focus-visible:ring-orange-200 focus-visible:border-orange-400"
                          )}
                          autoFocus
                        />
                      </div>
                      {errors.weight && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {errors.weight}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                        Boxes
                        <Lock className="h-3 w-3 text-amber-500" />
                      </Label>
                      <div className="h-12 px-3 flex flex-col items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-800 cursor-not-allowed">
                        <span className="text-[10px] font-bold text-amber-600/70 uppercase leading-none mb-0.5">Auto-Computed</span>
                        <span className="text-lg font-black leading-none">{computedBoxes}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Business Rule: <span className="font-semibold text-slate-600">1 Box = 25 kg</span>. Boxes are computed using <code>Math.floor(weight / 25)</code>.
                  </p>
                </div>

                {/* ── Auto FIFO status indicator (replaces button) ── */}
                {fifoStatus && (
                  fifoStatus.isFifoCompliant ? (
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 flex items-start gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                      <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-emerald-800">Using oldest stock (FIFO)</p>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded-full">
                            <ShieldCheck className="h-3 w-3" /> FIFO Active
                          </span>
                        </div>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          This is the oldest available batch. FIFO is automatically applied.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-amber-800">Older stocks available</p>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="h-3 w-3" /> Older Stock Available
                          </span>
                        </div>
                        <p className="text-xs text-amber-700 mt-0.5">
                          There{" "}
                          {fifoStatus.availableBatches.length - 1 === 1 ? "is" : "are"}{" "}
                          {fifoStatus.availableBatches.length - 1} older batch(es) for this product. You can manually select one below.
                        </p>
                      </div>
                    </div>
                  )
                )}

                {/* ── View Older Stock button (Step 2) — matches Scan Item blue button design ── */}
                {fifoStatus && fifoStatus.availableBatches.length > 1 && (
                  <Button
                    type="button"
                    onClick={(e) => handleSeeOlderStock(selectedItem, e as any)}
                    className={cn(
                      "w-full h-10 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl",
                      "shadow-md shadow-blue-200 transition-all hover:scale-[1.01]",
                      "animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
                    )}
                  >
                    <Layers className="h-4 w-4 shrink-0" />
                    View Older Stock
                    <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold bg-blue-500/50 text-white border border-blue-400/50 px-2 py-0.5 rounded-full">
                      {fifoStatus.availableBatches.length} batches
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  </Button>
                )}

                {/* ── Weight warning banner ── */}
                {showWeightWarning && (() => {
                  const tally = getWeightTally(selectedItem)
                  return (
                    <div className="rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 flex items-start gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                      <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-orange-800">Weight Difference Exceeds 5 kg</p>
                        <p className="text-xs text-orange-700 mt-0.5">
                          Production: <b>{tally.productionWeight !== null ? `${Number(tally.productionWeight).toFixed(1)} kg` : "N/A"}</b>
                          {" · "}
                          Packing: <b>{tally.packingWeight !== null ? `${Number(tally.packingWeight).toFixed(1)} kg` : "N/A"}</b>
                          {" · "}
                          Difference: <b>{tally.difference !== null ? `${tally.difference.toFixed(1)} kg` : "N/A"}</b>
                        </p>
                        <p className="text-xs text-orange-600 mt-1">Do you still want to proceed with the product out?</p>
                      </div>
                    </div>
                  )
                })()}

                {/* ── Scanned item badge ── */}
                {scannedItem && (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <p className="text-[11px] text-emerald-700">
                      Product auto-selected from barcode scan
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── FOOTER (sticky) ── */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50/50 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="min-w-[90px]"
          >
            Cancel
          </Button>
          {selectedItem && (
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={
                loading || !weightNum || weightNum > stockLeft
              }
              className={cn(
                "gap-2 min-w-[160px] font-semibold",
                showWeightWarning
                  ? "bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-200"
                  : weightNum > 0 && weightNum <= stockLeft
                    ? "bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-200"
                    : ""
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing…
                </>
              ) : showWeightWarning ? (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  Proceed Anyway
                </>
              ) : (
                <>
                  <PackageMinus className="h-4 w-4" />
                  Confirm Product Out
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* ── Older Stock Modal ── */}
    <OlderStockModal
      open={olderStockModalOpen}
      onOpenChange={setOlderStockModalOpen}
      productName={olderStockRefItem ? getProductName(olderStockRefItem) : ""}
      batches={olderStockBatches}
      onSelectBatch={handleSelectOlderBatch}
    />
  </>
  )
}
