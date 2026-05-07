"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, PackageOpen, AlertTriangle, CheckCircle2, RotateCcw, User, CalendarIcon, FileText, Lock, Loader2, ArrowRight, Package, MessageSquareWarning, Scale } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Textarea } from "@/components/ui/textarea"
import { InventoryService, TransactionService, StockMovementService } from "@/services/firebase-service"
import type { InventoryItem } from "@/lib/types"
import { CATEGORIES, getTypesForCategory } from "@/lib/product-data"

// ---
// Types
// ---

interface ReturnItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  inventoryItems: InventoryItem[]
  scannedItem?: InventoryItem | null
}

type Step = "select" | "form"

const EMPTY_FORM = {
  goodReturnWeight: "",
  badReturnWeight: "",
  badReturnReason: "",
  badReturnOtherReason: "",
  badReturnNotes: "",
  returnDate: new Date(),
}

const BAD_RETURN_REASONS = [
  "Damaged Packaging",
  "Spoiled / Expired",
  "Wrong Item Delivered",
  "Customer Complaint",
  "Quality Issue",
  "Temperature Issue",
  "Others",
]

// ---
// Helpers
// ---

function resolveStockLeft(item: InventoryItem): number {
  const incoming = (item as any).incoming_weight ?? (item as any).production_weight ?? 0
  const outgoing = (item as any).outgoing_weight ?? 0
  const goodReturn = (item as any).good_return_weight ?? 0
  return Math.max(0, incoming - outgoing + goodReturn)
}

function getProductName(item: InventoryItem): string {
  if (item.name) return item.name
  if (item.subcategory) return `${item.category} - ${item.subcategory}`
  return item.category
}

// ---
// Component
// ---

export function ReturnItemDialog({ open, onOpenChange, inventoryItems, scannedItem }: ReturnItemDialogProps) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [step, setStep] = useState<Step>("select")
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [unitLoading, setUnitLoading] = useState(false)
  const [detectedUnit, setDetectedUnit] = useState<"box" | "pack" | null>("box")

  // --- Items sorted alphabetically ---
  const sortedItems = useMemo(
    () => [...inventoryItems].sort((a, b) => getProductName(a).localeCompare(getProductName(b))),
    [inventoryItems],
  )

  // --- Filtered items ---
  const filteredItems = useMemo(() => {
    return sortedItems.filter((item) => {
      // Category filter
      if (filterCategory !== "all") {
        const cat = (item.category || "").trim().toLowerCase()
        if (cat !== filterCategory.toLowerCase()) return false
      }
      // Type filter
      if (filterType !== "all") {
        const t = ((item as any).productType || "").trim().toLowerCase()
        if (t !== filterType.toLowerCase()) return false
      }
      // Search filter
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matched =
          getProductName(item).toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.barcode || "").toLowerCase().includes(q)
        if (!matched) return false
      }
      return true
    })
  }, [sortedItems, filterCategory, filterType, search])

  // --- Available types based on selected category ---
  const availableTypes = useMemo(() => {
    if (filterCategory === "all") return []
    return getTypesForCategory(filterCategory) || []
  }, [filterCategory])

  // --- Computed values ---
  const currentStock = selectedItem ? resolveStockLeft(selectedItem) : 0
  const goodReturnNum = Math.max(0, Number(formData.goodReturnWeight) || 0)
  const badReturnNum = Math.max(0, Number(formData.badReturnWeight) || 0)
  const goodReturnBoxes = Math.floor(goodReturnNum / 25)
  const badReturnBoxes = Math.floor(badReturnNum / 25)
  const newStock = currentStock + goodReturnNum // Only good return adds to stock weight

  // --- Reset ---
  const reset = useCallback(() => {
    setStep("select")
    setSelectedItem(null)
    setFormData(EMPTY_FORM)
    setErrors({})
    setSearch("")
    setFilterCategory("all")
    setFilterType("all")
    setDetectedUnit("box")
    setUnitLoading(false)
  }, [])

  // --- Product select: detect unit ---
  const handleProductSelect = useCallback(async (item: InventoryItem) => {
    setSelectedItem(item)
    setFormData({ ...EMPTY_FORM, returnDate: new Date() })
    setErrors({})
    setDetectedUnit("box")
    setUnitLoading(false)
    setStep("form")
  }, [])

  // --- Handle scanned item ---
  useEffect(() => {
    if (!open) {
      reset()
    } else if (scannedItem) {
      handleProductSelect(scannedItem)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // --- Validation ---
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!goodReturnNum && !badReturnNum) {
      newErrors.goodReturnWeight = "Enter at least one return weight."
    }
    if (goodReturnNum < 0) newErrors.goodReturnWeight = "Cannot be negative."
    if (badReturnNum < 0) newErrors.badReturnWeight = "Cannot be negative."
    // Bad return reason validation
    if (badReturnNum > 0) {
      if (!formData.badReturnReason) newErrors.badReturnReason = "Reason is required for bad returns."
      if (formData.badReturnReason === "Others" && !formData.badReturnOtherReason.trim()) {
        newErrors.badReturnOtherReason = "Please specify the reason."
      }
    }
    if (!formData.returnDate) newErrors.returnDate = "Return date is required."
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // --- Submit ---
  const handleSubmit = async () => {
    if (!validate()) return
    if (!user || !selectedItem) return

    setLoading(true)
    try {
      const prevGoodReturn = (selectedItem as any).goodReturnStock ?? 0
      const prevDamageReturn = (selectedItem as any).damageReturnStock ?? 0

      // Build bad return details object
      const badReturnDetails = badReturnNum > 0 ? {
        reason: formData.badReturnReason === "Others"
          ? formData.badReturnOtherReason.trim()
          : formData.badReturnReason,
        notes: formData.badReturnNotes.trim() || null,
        weight: badReturnNum,
        boxes: badReturnBoxes,
      } : null

      // 1. Update inventory item — accumulate returns
      await InventoryService.updateItem(selectedItem.id, {
        good_return_weight: ((selectedItem as any).good_return_weight ?? 0) + goodReturnNum,
        good_return_boxes: ((selectedItem as any).good_return_boxes ?? 0) + goodReturnBoxes,
        damage_return_weight: ((selectedItem as any).damage_return_weight ?? 0) + badReturnNum,
        damage_return_boxes: ((selectedItem as any).damage_return_boxes ?? 0) + badReturnBoxes,
        ...(badReturnDetails && { badReturnDetails }),
        updatedAt: new Date(),
      } as any)

      // 2. APPEND-ONLY LEDGER: Always create a NEW transaction row for returns
      await TransactionService.addTransaction({
        transaction_date: new Date(),
        product_name: getProductName(selectedItem),
        barcode: selectedItem.barcode || "",
        category: selectedItem.category,
        type: (selectedItem as any).productType || (selectedItem as any).subcategory || "",
        unit_type: "BOX",
        good_return_weight: goodReturnNum,
        good_return_boxes: goodReturnBoxes,
        damage_return_weight: badReturnNum,
        damage_return_boxes: badReturnBoxes,
        stock_left_weight: newStock,
        reference_no: "",
        source: "inventory_return",
        ...(badReturnDetails && { bad_return_details: badReturnDetails }),
        return_date: formData.returnDate || null,
        created_at: new Date(),
      } as any)

      // 3. Log stock movement
      await StockMovementService.addMovement({
        inventoryItemId: selectedItem.id,
        barcode: selectedItem.barcode || "",
        category: selectedItem.category,
        subcategory: (selectedItem as any).subcategory || "",
        movementType: "INCOMING",
        quantity: goodReturnNum + badReturnNum,
        previousStock: currentStock,
        newStock: newStock,
        reason: `Returned to inventory (Good: ${goodReturnNum.toFixed(1)}kg, Damaged: ${badReturnNum.toFixed(1)}kg)`,
        transactionDocuments: {
          transaction_type: "incoming",
          source: "inventory_return",
          return_date: formData.returnDate || null,
          good_return_weight: goodReturnNum,
          damage_return_weight: badReturnNum,
          good_return_boxes: goodReturnBoxes,
          damage_return_boxes: badReturnBoxes,
          ...(badReturnDetails && { bad_return_details: badReturnDetails }),
        },
        createdBy: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      setShowConfirm(false)
      toast({
        title: "✅ Return successfully processed",
        description: `Stock updated for "${getProductName(selectedItem)}". +${goodReturnNum.toFixed(1)}kg good, +${badReturnNum.toFixed(1)}kg damaged.`,
      })

      reset()
      onOpenChange(false)
    } catch (error: any) {
      console.error("[ReturnItemDialog] Error:", error)
      setShowConfirm(false)
      toast({
        title: "❌ Failed to process return",
        description: error?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // --- Date formatting helper ---
  const fmtDate = (d: any): string => {
    if (!d) return "-"
    try {
      const date = d instanceof Date ? d : new Date(d)
      return isNaN(date.getTime()) ? "-" : format(date, "MMM dd, yyyy")
    } catch { return "-" }
  }

  const unitLabel = "Boxes"

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[98vw] sm:!w-[95vw] md:!w-[92vw] !max-w-[1100px] !max-h-[95vh] sm:!max-h-[none] !overflow-visible !p-0">
        {/* =============== HEADER =============== */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full font-bold text-sm shrink-0",
                step === "select" ? "bg-teal-100 text-teal-600" : "bg-teal-100 text-teal-600"
              )}>
                {step === "select" ? "1" : "2"}
              </div>
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <RotateCcw className="h-4 w-4 text-teal-500" />
                  Return Item — {step === "select" ? "Select Product" : "Return Details"}
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Step {step === "select" ? "1" : "2"} of 2 — Process a return for an existing inventory item
                </DialogDescription>
              </div>
            </div>
            <div className="mt-3 flex gap-1.5">
              <div className={cn("h-1.5 flex-1 rounded-full transition-colors", "bg-teal-500")} />
              <div className={cn("h-1.5 flex-1 rounded-full transition-colors", step === "form" ? "bg-teal-500" : "bg-slate-200")} />
            </div>
          </DialogHeader>
        </div>

        {/* =============== 2-COLUMN BODY =============== */}
        <div className="grid grid-cols-[1fr_340px] min-h-[480px]">

          {/* =============== LEFT COLUMN =============== */}
          <div className="p-6 border-r border-slate-100 overflow-y-auto max-h-[70vh]">

            {/* =========== STEP 1 - Select Item =========== */}
            {step === "select" && (
              <div className="grid gap-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Find Product to Return</p>

                {/* Search bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by product name or barcode..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-10"
                    autoFocus
                  />
                </div>

                {/* Filters */}
                <div className="flex gap-2">
                  <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setFilterType("all") }}>
                    <SelectTrigger className="h-9 w-[180px]">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {availableTypes.length > 0 && (
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="h-9 w-[160px]">
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {availableTypes.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Item list */}
                <div className="max-h-[380px] overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                      <PackageOpen className="h-8 w-8 opacity-40" />
                      <p className="text-sm">{inventoryItems.length === 0 ? "No inventory items found" : "No items match your search"}</p>
                    </div>
                  ) : (
                    filteredItems.map((item) => {
                      const stock = resolveStockLeft(item)
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleProductSelect(item)}
                          className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-teal-50"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-slate-800 truncate">{getProductName(item)}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {item.category}
                              {(item as any).productType ? ` | ${(item as any).productType}` : ""}
                              {item.barcode && ` | ${item.barcode}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              className={cn(
                                "text-xs font-semibold",
                                stock <= 5
                                  ? "bg-orange-100 text-orange-700 border-orange-200"
                                  : "bg-green-100 text-green-700 border-green-200"
                              )}
                              variant="outline"
                            >
                              {stock.toFixed(1)} kg ({Math.floor(stock / 25)} boxes) in stock
                            </Badge>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* =========== STEP 2 - Return Form =========== */}
            {step === "form" && selectedItem && (
              <div className="grid gap-5">
                {/* Selected item banner */}
                <div className="flex items-center gap-3 rounded-xl bg-teal-50 border border-teal-200 px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 shrink-0">
                    <Package className="h-4.5 w-4.5 text-teal-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-teal-700">{getProductName(selectedItem)}</p>
                    <p className="text-xs text-teal-600/80 truncate">{selectedItem.barcode} • {selectedItem.category}</p>
                  </div>
                  <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-[10px] shrink-0" variant="outline">
                    {currentStock.toFixed(1)} kg ({Math.floor(currentStock / 25)} boxes) in stock
                  </Badge>
                </div>

                  {/* Return Quantity */}
                  <div className="grid gap-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Return Quantity</p>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Good Return Column */}
                      <div className="grid gap-1.5">
                        <Label className="text-xs font-medium text-slate-600">
                          Good Return (kg) <span className="text-red-500">*</span>
                          <span className="ml-1 text-[10px] text-green-600 font-normal">↑ adds to stock</span>
                        </Label>
                        <div className="relative">
                          <Scale className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.goodReturnWeight}
                            onChange={(e) => {
                              setFormData((p) => ({ ...p, goodReturnWeight: e.target.value }))
                              setErrors((p) => ({ ...p, goodReturnWeight: "" }))
                            }}
                            placeholder="0.00"
                            className={cn("h-9 pl-8 bg-white", errors.goodReturnWeight ? "border-destructive" : "")}
                          />
                        </div>
                        {goodReturnNum > 0 && (
                          <p className="text-[10px] text-green-600 font-medium">≈ {goodReturnBoxes} boxes</p>
                        )}
                        {errors.goodReturnWeight && <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {errors.goodReturnWeight}</p>}
                      </div>

                      {/* Bad Return Column */}
                      <div className="grid gap-1.5">
                        <Label className="text-xs font-medium text-slate-600">
                          Bad Return (kg)
                          <span className="ml-1 text-[10px] text-red-500 font-normal">tracked only</span>
                        </Label>
                        <div className="relative">
                          <Scale className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.badReturnWeight}
                            onChange={(e) => {
                              setFormData((p) => ({ ...p, badReturnWeight: e.target.value }))
                              setErrors((p) => ({ ...p, badReturnWeight: "" }))
                            }}
                            placeholder="0.00"
                            className={cn("h-9 pl-8 bg-white", errors.badReturnWeight ? "border-destructive" : "")}
                          />
                        </div>
                        {badReturnNum > 0 && (
                          <p className="text-[10px] text-red-500 font-medium">≈ {badReturnBoxes} boxes</p>
                        )}
                        {errors.badReturnWeight && <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {errors.badReturnWeight}</p>}
                      </div>
                    </div>

                    <div className="grid gap-1">
                      <Label className="text-xs font-medium text-slate-600">Total Boxes Metadata</Label>
                      <div className="h-9 px-3 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 text-slate-600 text-sm font-medium">
                        <Package className="h-3.5 w-3.5 text-slate-400" />
                        <span>{goodReturnBoxes + badReturnBoxes} total boxes</span>
                        <span className="text-[10px] font-normal text-slate-400 ml-auto">1 Box = 25 kg</span>
                      </div>
                    </div>
                  </div>

                  {/* Bad Return Reason — conditional */}
                  {badReturnNum > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 grid gap-3">
                      <div className="flex items-center gap-2">
                        <MessageSquareWarning className="h-4 w-4 text-red-500" />
                        <p className="text-xs font-semibold uppercase tracking-widest text-red-600">Bad Return Details</p>
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-xs font-medium text-slate-600">
                          Reason for Bad Return <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={formData.badReturnReason}
                          onValueChange={(v) => {
                            setFormData((p) => ({ ...p, badReturnReason: v, badReturnOtherReason: v !== "Others" ? "" : p.badReturnOtherReason }))
                            setErrors((p) => ({ ...p, badReturnReason: "", badReturnOtherReason: "" }))
                          }}
                        >
                          <SelectTrigger className={cn("h-9 bg-white", errors.badReturnReason ? "border-destructive" : "")}>
                            <SelectValue placeholder="Select reason..." />
                          </SelectTrigger>
                          <SelectContent>
                            {BAD_RETURN_REASONS.map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.badReturnReason && <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {errors.badReturnReason}</p>}
                      </div>
                      {formData.badReturnReason === "Others" && (
                        <div className="grid gap-1.5">
                          <Label className="text-xs font-medium text-slate-600">
                            Specify Reason <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            value={formData.badReturnOtherReason}
                            onChange={(e) => {
                              setFormData((p) => ({ ...p, badReturnOtherReason: e.target.value }))
                              setErrors((p) => ({ ...p, badReturnOtherReason: "" }))
                            }}
                            placeholder="e.g. Mold found inside packaging"
                            className={cn("h-9 bg-white", errors.badReturnOtherReason ? "border-destructive" : "")}
                          />
                          {errors.badReturnOtherReason && <p className="text-xs text-destructive">{errors.badReturnOtherReason}</p>}
                        </div>
                      )}
                      <div className="grid gap-1.5">
                        <Label className="text-xs font-medium text-slate-600">
                          Additional Notes <span className="text-slate-400">(optional)</span>
                        </Label>
                        <Textarea
                          value={formData.badReturnNotes}
                          onChange={(e) => setFormData((p) => ({ ...p, badReturnNotes: e.target.value }))}
                          placeholder="e.g. Packaging was torn during delivery, 2 boxes severely dented"
                          className="min-h-[60px] text-sm bg-white resize-none"
                          rows={2}
                        />
                      </div>
                    </div>
                  )}



                {/* Return Date & Documents */}
                <div className="rounded-xl border border-teal-100 bg-teal-50/30 p-4 grid gap-3">
                  <div className="flex items-center gap-2">
                     <FileText className="h-4 w-4 text-teal-500" />
                     <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">Return Details</p>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium text-slate-600">
                      Return Date <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={formData.returnDate ? format(formData.returnDate, "yyyy-MM-dd") : ""}
                      onChange={(e) => {
                        const val = e.target.value
                        setFormData((p) => ({
                          ...p,
                          returnDate: val ? new Date(val + "T00:00:00") : new Date(),
                        }))
                        setErrors((p) => ({ ...p, returnDate: "" }))
                      }}
                      className={cn("h-9 w-[200px]", errors.returnDate ? "border-destructive" : "")}
                    />
                    {errors.returnDate && <p className="text-xs text-destructive">{errors.returnDate}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* =============== RIGHT COLUMN (Summary) =============== */}
          <div className="bg-slate-50/60 p-5 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Return Summary</p>

            {selectedItem ? (
              <>
                {/* Product info */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 grid gap-2">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-teal-500" />
                    <p className="text-sm font-semibold text-slate-700 truncate">{getProductName(selectedItem)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-500">
                    <span>Barcode</span>
                    <span className="font-mono text-slate-700 truncate">{selectedItem.barcode || "—"}</span>
                    <span>Category</span>
                    <span className="text-slate-700">{selectedItem.category}</span>
                    <span>Type</span>
                    <span className="text-slate-700">{(selectedItem as any).productType || "—"}</span>
                    <span>Unit</span>
                    <span className="text-slate-700">{unitLoading ? "Detecting…" : unitLabel}</span>
                  </div>
                </div>

                {/* Stock preview */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 grid gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Weight Summary (kg)</p>
                  <div className="grid grid-cols-[1fr_auto] gap-1 text-sm">
                    <span className="text-slate-600">Current Weight</span>
                    <span className="font-bold text-right">{currentStock.toFixed(1)}</span>
                    <span className="text-green-600">+ Good Return</span>
                    <span className="font-bold text-green-600 text-right">+{goodReturnNum.toFixed(1)}</span>
                    {badReturnNum > 0 && (
                      <>
                        <span className="text-red-500">Damaged (tracked)</span>
                        <span className="font-bold text-red-500 text-right">{badReturnNum.toFixed(1)}</span>
                      </>
                    )}
                  </div>
                  <div className="border-t border-slate-100 pt-2 mt-1 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">New Total Weight</span>
                    <span className="text-xl font-bold text-teal-600">{newStock.toFixed(1)}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 text-right italic">
                    ≈ {Math.floor(newStock / 25)} boxes total
                  </p>
                </div>

                {/* Return info summary */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 grid gap-1 text-[11px]">
                  <p className="font-semibold uppercase tracking-widest text-slate-500">Return Info</p>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date</span>
                    <span className="text-slate-700">{fmtDate(formData.returnDate)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
                <RotateCcw className="h-8 w-8 opacity-30" />
                <p className="text-sm text-center">Select a product from the list to begin the return process</p>
              </div>
            )}
          </div>
        </div>

        {/* =============== FOOTER =============== */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-between">
          <div>
            {step === "form" && !scannedItem && (
              <Button type="button" variant="outline" onClick={() => setStep("select")} disabled={loading}>
                ← Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            {step === "form" && (
              <Button
                onClick={() => {
                  if (validate()) setShowConfirm(true)
                }}
                disabled={loading || unitLoading || (!goodReturnNum && !badReturnNum)}
                className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
                ) : (
                  <><RotateCcw className="h-4 w-4" /> Process Return</>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* =============== CONFIRMATION DIALOG =============== */}
    <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-teal-500" />
            Confirm Return
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>You are about to process the following return:</p>
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 grid gap-1 text-[13px]">
                <div className="flex justify-between"><span className="text-slate-500">Product</span><span className="font-medium text-slate-800">{selectedItem ? getProductName(selectedItem) : ""}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Good Return</span><span className="font-semibold text-green-600">+{goodReturnNum.toFixed(1)} kg ({goodReturnBoxes} bx)</span></div>
                {badReturnNum > 0 && (
                  <>
                    <div className="flex justify-between"><span className="text-slate-500">Bad Return</span><span className="font-semibold text-red-500">{badReturnNum.toFixed(1)} kg ({badReturnBoxes} bx)</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Reason</span><span className="font-medium text-red-600 text-right max-w-[160px] truncate">{formData.badReturnReason === "Others" ? formData.badReturnOtherReason.trim() : formData.badReturnReason}</span></div>
                    {formData.badReturnNotes.trim() && <div className="flex justify-between"><span className="text-slate-500">Notes</span><span className="text-slate-700 text-right max-w-[160px] truncate">{formData.badReturnNotes.trim()}</span></div>}
                  </>
                )}
                <div className="border-t border-slate-200 pt-1 mt-1 flex justify-between"><span className="text-slate-500">New Total Weight</span><span className="font-bold text-teal-600">{newStock.toFixed(1)} kg</span></div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</> : <><CheckCircle2 className="h-4 w-4" /> Confirm Return</>}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
