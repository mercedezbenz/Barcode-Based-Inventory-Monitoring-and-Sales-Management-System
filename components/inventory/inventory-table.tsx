"use client"

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { useState, useEffect, useRef, useMemo, useCallback, ReactNode, Fragment } from "react"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { InventoryItem, InventoryTransaction, Category } from "@/lib/types"
import { formatTimestamp, formatExpirationDate } from "@/lib/utils"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, ChevronUp, Pencil, Trash2, Loader2, Barcode, MessageSquareWarning, Package, History, Printer, SearchX, Archive, RotateCcw } from "lucide-react"
import { getItemStatus } from "./inventory-dashboard"
import { buildProductDisplayName } from "@/lib/product-data"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { TransactionService } from "@/services/firebase-service"
import { FirebaseService } from "@/services/firebase-service"
import { BarcodeModal } from "./barcode-modal"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getFirebaseDb } from "@/lib/firebase-live"
import { collection, getDocs, serverTimestamp } from "firebase/firestore"

interface InventoryTableProps {
  items: InventoryItem[]
  transactions?: InventoryTransaction[]
  categories: Category[]
  loading: boolean
  scrollToItemId?: string | null
  onItemScrolled?: () => void
  /** Set of item IDs that were just added — used to trigger highlight animation */
  newItemIds?: Set<string>
  /** Sort mode passed from dashboard filters */
  sortMode?: string
  /** Rows per page passed from dashboard */
  rowsPerPage?: number
  /** Debounced search query from dashboard — used for text highlighting */
  searchQuery?: string
  /** The original parameter filter from URL, e.g. low-stock, out-of-stock, expiring */
  highlightFilter?: string
  /** If true, hide edit/delete action buttons (view-only mode for owner role) */
  readOnly?: boolean
  /** If true, shows archive specific columns and badges */
  isArchiveView?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a Date or Firestore Timestamp to "MMM DD, YYYY" */
function formatTxnDate(d: any): string {
  if (!d) return "\u2014"
  try {
    let date: Date
    if (d instanceof Date) {
      date = d
    } else if (d?.toDate && typeof d.toDate === "function") {
      // Firestore Timestamp object
      date = d.toDate()
    } else if (d?.seconds != null) {
      // Firestore Timestamp serialized as { seconds, nanoseconds }
      date = new Date(d.seconds * 1000)
    } else if (typeof d === "string" || typeof d === "number") {
      date = new Date(d)
    } else {
      return "\u2014"
    }
    if (isNaN(date.getTime())) return "\u2014"
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return `${months[date.getMonth()]} ${String(date.getDate()).padStart(2, "0")}, ${date.getFullYear()}`
  } catch { return "\u2014" }
}

/** Format a Date to "MM/DD/YYYY" */
function formatDateFull(d: any): string {
  if (!d) return "\u2014"
  try {
    const date = d instanceof Date ? d : d?.toDate ? d.toDate() : new Date(d)
    if (isNaN(date.getTime())) return "\u2014"
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    const year = date.getFullYear()
    return `${month}/${day}/${year}`
  } catch { return "\u2014" }
}

/** Parse a date to a timestamp number for sorting */
function parseDateToMs(d: any): number {
  if (!d) return 0
  try {
    let date: Date
    if (d instanceof Date) {
      date = d
    } else if (d?.toDate && typeof d.toDate === "function") {
      date = d.toDate()
    } else if (d?.seconds != null) {
      date = new Date(d.seconds * 1000)
    } else {
      date = new Date(d)
    }
    return isNaN(date.getTime()) ? 0 : date.getTime()
  } catch { return 0 }
}

/** Derive a readable Movement Type from source */
function getMovementType(txn: any): string {
  if (txn.movement_type) return txn.movement_type
  const src = (txn.source || "").toLowerCase()
  if (src === "supplier") return "From Supplier"
  if (src === "production") return "From Production"
  if (src === "customer_return") return "Return"
  if (src === "delivery") return "Outgoing"
  if (src === "packing") return "From Packing"
  return txn.source || "-"
}

/** Movement type badge color */
function getMovementBadgeStyle(type: string): string {
  const t = type.toLowerCase()
  if (t.includes("supplier")) return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800"
  if (t.includes("production")) return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800"
  if (t.includes("packing")) return "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-800"
  if (t.includes("outgoing")) return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800"
  if (t.includes("return")) return "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-800"
  return "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
}

/** Derive the unit type for a transaction row */
function deriveUnitType(txn: any): string {
  if (txn.unit_type) return txn.unit_type.toUpperCase()
  return "BOX" // default
}
const storage = getStorage()
// ─── Grouped Product type ────────────────────────────────────────────────────
interface GroupedProduct {
  barcode: string
  product_id: string            // Product document key for image lookup (e.g. "beef-hotdog-beef")
  imageUrl: string              // Fallback image URL from inventory item or transaction
  productName: string
  isArchived: boolean
  archivedReason: string
  archivedAt: any
  category: string
  movementOrigin: string       // How item ENTERED system (Supplier/Production) — NOT latest action
  latestDate: any
  unitType: string
  totalIncoming: number
  totalOutgoing: number
  totalGoodReturn: number
  totalDamageReturn: number
  stockLeft: number

  transactions: any[]
  latestBadReturnDetails: any
  // Incoming context fields (from first incoming transaction)
  dateAdded: any
  expiryDate: any
  productionDate: any
  supplierName: string
  // Weight tracking
  production_weight: number | null
  packing_weight: number | null
  weight_difference: number | null
  // Incoming weight tracking
  incoming_weight: number | null
  // Transaction references
  sales_invoice_no: string | null
  delivery_receipt_no: string | null
  
  // NEW: Support for batches (multiple barcodes per product name)
  totalQty?: number
  totalWeight?: number
  batches?: any[]
}



function formatNumber(value: number | undefined | null): string {
  const num = value || 0
  return Math.max(0, num).toLocaleString()
}

function formatWeight(value: number | undefined | null): string {
  const num = value || 0
  if (num === 0) return "0"
  return num.toFixed(2)
}

// ─── Search highlight helper ────────────────────────────────────────────────
/** Wraps matching substrings in a <mark> tag for visual highlighting */
function highlightMatch(text: string, query: string): ReactNode {
  if (!query || !text) return text
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const idx = lowerText.indexOf(lowerQuery)
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// ─── Pagination page number generator ───────────────────────────────────────
function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | 'ellipsis')[] = []
  // Always show first page
  pages.push(1)
  if (current > 3) pages.push('ellipsis')
  // Show range around current
  const rangeStart = Math.max(2, current - 1)
  const rangeEnd = Math.min(total - 1, current + 1)
  for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i)
  if (current < total - 2) pages.push('ellipsis')
  // Always show last page
  if (total > 1) pages.push(total)
  return pages
}

// ─── Transaction History List Component ───
function TransactionHistoryList({ transactions, setCancellingItem, readOnly = false }: { transactions: any[], setCancellingItem: (txn: any) => void, readOnly?: boolean }) {
  const expandedTxns = useMemo(() => {
    return transactions.flatMap((txn: any) => {
      const parts = []
      const mt = getMovementType(txn).toLowerCase()
      const isOutgoing = mt.includes("outgoing") || txn.type === "OUT"
      const isReturn = mt.includes("return")
      const isIncoming = mt.includes("supplier") || mt.includes("production") || mt.includes("packing") || ((txn.source || "").toLowerCase() === "incoming") || mt.includes("incoming") || txn.type === "IN"
      const dateStr = formatTxnDate(txn.transaction_date || txn.created_at || new Date())
      const unit = "kg"
      const rem = txn.weight_left ?? txn.stock_left ?? "\u2014"


      if (isOutgoing) {
          parts.push({ txn, id: `${txn.id}-out`, type: 'OUT', qty: txn.outgoing_weight ?? txn.outgoing_qty ?? 0, rem, date: dateStr, unit })
      } else if (isReturn) {
          if ((txn.good_return_weight ?? txn.good_return ?? 0) > 0) {
              parts.push({ txn, id: `${txn.id}-good`, type: 'GOOD_RETURN', qty: txn.good_return_weight ?? txn.good_return, rem, date: dateStr, unit })
          }
          if ((txn.damage_return_weight ?? txn.damage_return ?? 0) > 0) {
              parts.push({ txn, id: `${txn.id}-bad`, type: 'BAD_RETURN', qty: txn.damage_return_weight ?? txn.damage_return, reason: txn.bad_return_details?.reason || "Damaged", rem: null, date: dateStr, unit })
          }
      } else if (isIncoming) {
          const inWeight = txn.incoming_weight ?? txn.production_weight ?? null
          const inQty = txn.incoming_qty ?? txn.incoming_packs ?? txn.quantity ?? 0
          parts.push({ txn, id: `${txn.id}-in`, type: 'IN', qty: inWeight ?? inQty, rem, date: dateStr, unit })
      } else {
          parts.push({ txn, id: `${txn.id}-other`, type: 'OTHER', qty: 0, rem, date: dateStr, unit })
      }
      return parts
    }).filter(part => part.qty > 0 || part.type === 'OTHER')
  }, [transactions])

  return (
    <div className="divide-y divide-border/40">
      {expandedTxns.map(part => {
          let colorClass = ""
          let label = ""
          let qtyStr = ""
          if (part.type === "IN") {
              colorClass = "border-l-green-500 bg-green-50/20"
              label = "IN"
              qtyStr = `+${formatNumber(part.qty)}`
          } else if (part.type === "OUT") {
              colorClass = "border-l-red-500 bg-red-50/20"
              label = "OUT"
              qtyStr = `-${formatNumber(part.qty)}`
          } else if (part.type === "GOOD_RETURN") {
              colorClass = "border-l-blue-500 bg-blue-50/20"
              label = "GOOD RETURN"
              qtyStr = `+${formatNumber(part.qty)}`
          } else if (part.type === "BAD_RETURN") {
              colorClass = "border-l-slate-400 bg-slate-50/20"
              label = "BAD RETURN"
              qtyStr = `${formatNumber(part.qty)}`
          }

          return (
              <div key={part.id} className={`px-5 py-3 border-l-[3px] flex items-center justify-between gap-4 ${colorClass}`}>
                  {/* Left Side: Date, Label, Qty, Details */}
                  <div className="flex flex-col gap-1">
                     <div className="flex items-center gap-2">
                         <span className="text-xs text-muted-foreground font-medium">{part.date}</span>
                         <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider border ${
                             part.type === 'IN' ? 'bg-green-100 text-green-700 border-green-200' :
                             part.type === 'OUT' ? 'bg-red-100 text-red-700 border-red-200' :
                             part.type === 'GOOD_RETURN' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                             'bg-slate-100 text-slate-700 border-slate-200'
                         }`}>
                             {label}
                         </span>
                     </div>
                     <div className="flex items-center gap-2 mt-0.5 text-sm">
                         <span className={`font-bold ${
                             part.type === 'IN' || part.type === 'GOOD_RETURN' ? 'text-green-600' :
                             part.type === 'OUT' ? 'text-red-600' : 'text-slate-600'
                         }`}>
                             {qtyStr} {part.unit}
                         </span>
                         {part.reason && (
                             <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground ml-2 items-center">
                                 <span className="font-medium">| Reason: <span className="text-red-500">{part.reason}</span></span>
                             </div>
                         )}
                     </div>
                  </div>

                  {/* Right Side: Remaining Stock & Actions */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                      {!readOnly && (
                      <div className="flex gap-1 shrink-0 mb-1">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); setCancellingItem(part.txn) }}>
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-600" />
                          </Button>
                      </div>
                      )}
                      {part.rem !== null && part.rem !== "\u2014" ? (
                          <span className="text-xs font-semibold text-slate-700 bg-white shadow-sm px-2 py-0.5 rounded-md border border-slate-200">
                              Remaining: {formatNumber(Number(part.rem))} {part.unit}
                          </span>
                      ) : part.rem === "\u2014" ? (
                          <span className="text-xs font-semibold text-slate-700 bg-white shadow-sm px-2 py-0.5 rounded-md border border-slate-200">
                              Remaining: {"\u2014"} {part.unit}
                          </span>
                      ) : (
                          <span className="text-[10px] text-muted-foreground italic font-medium pt-1">
                              (Does not affect stock)
                          </span>
                      )}
                  </div>
              </div>
          )
      })}
    </div>
  )
}

export function InventoryTable({
  items,
  transactions = [],
  categories,
  loading,
  scrollToItemId,
  onItemScrolled,
  newItemIds,
  sortMode = "date-desc",
  rowsPerPage: rowsPerPageProp = 10,
  searchQuery = "",
  highlightFilter,
  readOnly = false,
  isArchiveView = false,
}: InventoryTableProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [cancellingItem, setCancellingItem] = useState<InventoryTransaction | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [archivingItem, setArchivingItem] = useState<{ id: string; barcode: string; productName: string; isRestore?: boolean } | null>(null)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [expandedBarcodes, setExpandedBarcodes] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [barcodeViewItem, setBarcodeViewItem] = useState<{ barcode: string; productName: string; productionDate?: string; expiryDate?: string } | null>(null)
  const [badReturnDetailsView, setBadReturnDetailsView] = useState<{ productName: string; details: any; quantity: number } | null>(null)
  const [txnDialogProduct, setTxnDialogProduct] = useState<GroupedProduct | null>(null)

  // ─── Product Images ───────────────────────────────────────────────────────
  // Primary map: product doc id → imageUrl  (e.g. "beef-hotdog-beef" → "https://...")
  // Secondary map: lowercase product name → imageUrl  (fuzzy fallback)
  const [productImageMap, setProductImageMap] = useState<Record<string, string>>({})
  const [productNameImageMap, setProductNameImageMap] = useState<Record<string, string>>({})
  useEffect(() => {
    async function loadProductImages() {
      try {
        const db = getFirebaseDb()
        if (!db) return
        const snap = await getDocs(collection(db, "products"))
        const idMap: Record<string, string> = {}
        const nameMap: Record<string, string> = {}
        snap.forEach(doc => {
          const data = doc.data()
          const url = data.imageUrl || ""
          if (url) {
            idMap[doc.id] = url
            // Also index by product name (lowercase) for fallback matching
            const name = (data.name || "").toLowerCase().trim()
            if (name) nameMap[name] = url
          }
        })
        setProductImageMap(idMap)
        setProductNameImageMap(nameMap)
      } catch (err) {
        console.error("Error loading product images", err)
      }
    }
    loadProductImages()
  }, [])

  // Build a barcode → imageUrl map from the items prop (inventory collection fallback)
  const itemImageMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const item of items) {
      const url = (item as any).imageUrl || (item as any).product_image || (item as any).photo || ""
      if (url && item.barcode) {
        map[item.barcode] = url
      }
    }
    return map
  }, [items])

  // ─── Scroll-aware indicators ────────────────────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showBottomIndicator, setShowBottomIndicator] = useState(false)
  const [showScrollHint, setShowScrollHint] = useState(false)
  const hasScrolledOnce = useRef(false)
  const itemRowRefs = useRef<Map<string, HTMLElement>>(new Map())

  const itemsPerPage = rowsPerPageProp

  // ─── Group transactions by product_name ──────────────────────────────────────
  const groupedProducts: GroupedProduct[] = useMemo(() => {
    // STEP 1: Sort ALL transactions chronologically (oldest first) BEFORE grouping
    // This ensures movementOrigin detection is reliable regardless of Firestore document order
    const sortedTransactions = [...transactions].sort((a: any, b: any) => {
      return parseDateToMs(a.transaction_date) - parseDateToMs(b.transaction_date)
    })

    const barcodeMap = new Map<string, GroupedProduct>()

    for (const txn of sortedTransactions) {
      const bc = (txn as any).barcode || txn.id
      if (!bc) continue

      if (!barcodeMap.has(bc)) {
        barcodeMap.set(bc, {
          barcode: bc,
          product_id: (txn as any).product_id || "",
          imageUrl: "",
          productName: (txn as any).product_name || "Unknown Product",
          isArchived: false,
          archivedReason: "manual",
          archivedAt: null,
          category: (txn as any).category || "",
          movementOrigin: "",  // Will be set from the EARLIEST incoming transaction
          latestDate: (txn as any).transaction_date,
          unitType: deriveUnitType(txn),
          totalIncoming: 0,
          totalOutgoing: 0,
          totalGoodReturn: 0,
          totalDamageReturn: 0,
          stockLeft: 0,

          transactions: [],
          latestBadReturnDetails: null,
          dateAdded: null,
          expiryDate: null,
          productionDate: null,
          supplierName: "",
          // Weight tracking
          production_weight: null,
          packing_weight: null,
          weight_difference: null,
          // Incoming weight tracking
          incoming_weight: null,
          // Transaction references
          sales_invoice_no: null,
          delivery_receipt_no: null,
        })
      }

      const group = barcodeMap.get(bc)!
      group.transactions.push(txn)

      // Accumulate totals — prioritize weight fields
      const incomingW = (txn as any).incoming_weight ?? (txn as any).production_weight ?? 0
      const outgoingW = (txn as any).outgoing_weight ?? 0
      const goodReturnW = (txn as any).good_return_weight ?? 0
      const damageReturnW = (txn as any).damage_return_weight ?? 0

      group.totalIncoming += incomingW
      group.totalOutgoing += outgoingW
      group.totalGoodReturn += goodReturnW
      group.totalDamageReturn += damageReturnW

      if (incomingW > 0) {
        group.incoming_weight = (group.incoming_weight || 0) + incomingW
      }

      // Track latest transaction date
      const txnDateMs = parseDateToMs((txn as any).transaction_date)
      const currentLatestMs = parseDateToMs(group.latestDate)
      if (txnDateMs > currentLatestMs) {
        group.latestDate = (txn as any).transaction_date
        group.product_id = (txn as any).product_id || group.product_id
        group.productName = (txn as any).product_name || group.productName
        // Capture any imageUrl from the transaction itself
        if (!group.imageUrl) {
          group.imageUrl = (txn as any).imageUrl || (txn as any).product_image || ""
        }
      }

      // Track bad return details
      if ((txn as any).bad_return_details) {
        group.latestBadReturnDetails = (txn as any).bad_return_details
      }
    }

    // STEP 2: Process each barcode group
    for (const group of barcodeMap.values()) {
      const earliestIncoming = group.transactions.find((txn: any) => {
        const mt = getMovementType(txn).toLowerCase()
        const src = ((txn as any).source || "").toLowerCase()
        return mt.includes("supplier") || mt.includes("production") || mt.includes("packing") || src === "incoming"
      })
      if (earliestIncoming) {
        group.movementOrigin = getMovementType(earliestIncoming)
        group.dateAdded = (earliestIncoming as any).created_at || (earliestIncoming as any).transaction_date || null
        group.expiryDate = (earliestIncoming as any).expiry_date || null
        group.productionDate = (earliestIncoming as any).production_date || null
        group.supplierName = (earliestIncoming as any).supplier_name || ""
        group.production_weight = (earliestIncoming as any).production_weight ?? null
        group.packing_weight = (earliestIncoming as any).packing_weight ?? null
        group.weight_difference = (earliestIncoming as any).weight_difference ?? null
        group.incoming_weight = (earliestIncoming as any).incoming_weight ?? null
        group.sales_invoice_no = (earliestIncoming as any).sales_invoice_no ?? null
        group.delivery_receipt_no = (earliestIncoming as any).delivery_receipt_no ?? null
      }

      if (!group.dateAdded && group.transactions.length > 0) {
        const first = group.transactions[group.transactions.length - 1] 
        group.dateAdded = (first as any).created_at || (first as any).transaction_date || null
        group.expiryDate = group.expiryDate || (first as any).expiry_date || null
      }
      group.stockLeft = Math.max(0, group.totalIncoming - group.totalOutgoing + group.totalGoodReturn)
    }

    const itemsByBarcode = new Map<string, any>()
    for (const item of items) {
      if (item.barcode) itemsByBarcode.set(item.barcode, item)
    }

    const barcodeGroups = Array.from(barcodeMap.values())
    for (const group of barcodeGroups) {
      const item = itemsByBarcode.get(group.barcode)
      if (item) {
        group.isArchived = Boolean(item.isArchived)
        group.archivedReason = item.archivedReason || item.archived_reason || "manual"
        group.archivedAt = item.archivedAt || item.archived_at || item.updatedAt
      }
    }

    // STEP 3: Group by product_name (case-insensitive) and aggregate batches
    const productMap = new Map<string, GroupedProduct>()
    for (const bg of barcodeGroups) {
      const pName = (bg.productName || "Unknown Product").trim()
      const pNameLower = pName.toLowerCase()
      
      if (!productMap.has(pNameLower)) {
        productMap.set(pNameLower, {
          productName: pName,
          product_id: bg.product_id,
          imageUrl: bg.imageUrl,
          category: bg.category,
          latestDate: bg.latestDate,
          unitType: bg.unitType,
          totalIncoming: 0,
          totalOutgoing: 0,
          totalGoodReturn: 0,
          totalDamageReturn: 0,
          stockLeft: 0,
          production_weight: null,
          packing_weight: null,
          weight_difference: null,
          incoming_weight: null,
          batches: [],
          transactions: [],
          barcode: bg.barcode,
          isArchived: bg.isArchived,
          archivedReason: bg.archivedReason,
          archivedAt: bg.archivedAt,
          movementOrigin: bg.movementOrigin,
          latestBadReturnDetails: bg.latestBadReturnDetails,
          dateAdded: bg.dateAdded,
          expiryDate: bg.expiryDate,
          productionDate: bg.productionDate,
          supplierName: bg.supplierName,
          sales_invoice_no: bg.sales_invoice_no,
          delivery_receipt_no: bg.delivery_receipt_no,
          totalQty: 0,
          totalWeight: 0
        })
      }
      
      const pg = productMap.get(pNameLower)!
      
      // Accumulate totals
      pg.totalIncoming += bg.totalIncoming
      pg.totalOutgoing += bg.totalOutgoing
      pg.totalGoodReturn += bg.totalGoodReturn
      pg.totalDamageReturn += bg.totalDamageReturn
      pg.stockLeft += bg.stockLeft
      pg.totalQty! += bg.stockLeft
      pg.totalWeight! += (bg.packing_weight ?? bg.production_weight ?? 0)
      
      if (bg.production_weight != null) pg.production_weight = (pg.production_weight || 0) + bg.production_weight
      if (bg.packing_weight != null) pg.packing_weight = (pg.packing_weight || 0) + bg.packing_weight
      if (bg.weight_difference != null) pg.weight_difference = (pg.weight_difference || 0) + bg.weight_difference
      if (bg.incoming_weight != null) pg.incoming_weight = (pg.incoming_weight || 0) + bg.incoming_weight
      
      if (parseDateToMs(bg.latestDate) > parseDateToMs(pg.latestDate)) {
        pg.latestDate = bg.latestDate
        if (!pg.imageUrl && bg.imageUrl) pg.imageUrl = bg.imageUrl
      }
      
      pg.transactions.push(...bg.transactions)
      
      pg.batches!.push({
        id: bg.barcode,
        qty: bg.stockLeft,
        weight: bg.packing_weight ?? bg.production_weight ?? 0,
        expiry: bg.expiryDate,
        ...bg
      })
    }
    
    const result = Array.from(productMap.values())
    
    // Process batches and transactions inside each product
    for (const pg of result) {
      pg.batches!.sort((a: any, b: any) => {
        // Move zero stock to bottom
        const aStock = a.qty || 0
        const bStock = b.qty || 0
        if (aStock <= 0 && bStock > 0) return 1
        if (aStock > 0 && bStock <= 0) return -1
        
        // FIFO (Oldest first) for active batches
        return parseDateToMs(a.dateAdded) - parseDateToMs(b.dateAdded)
      })
      pg.transactions.sort((a: any, b: any) => parseDateToMs(b.transaction_date) - parseDateToMs(a.transaction_date))
      
      const first = pg.batches![0]
      if (first) {
        pg.barcode = first.barcode
        pg.dateAdded = first.dateAdded
        pg.expiryDate = first.expiryDate
        pg.productionDate = first.productionDate
        pg.supplierName = first.supplierName
        pg.isArchived = pg.batches!.every((b: any) => b.isArchived)
        pg.archivedReason = first.archivedReason
        pg.archivedAt = first.archivedAt
        pg.latestBadReturnDetails = first.latestBadReturnDetails
      }
    }

    return result.sort((a, b) => parseDateToMs(b.latestDate) - parseDateToMs(a.latestDate))
  }, [transactions, items])

  // ─── Apply sort mode from dashboard ────────────────────────────────────
  const sortedProducts = useMemo(() => {
    const sorted = [...groupedProducts]
    switch (sortMode) {
      case "date-asc":
        sorted.sort((a, b) => parseDateToMs(a.dateAdded) - parseDateToMs(b.dateAdded))
        break
      case "date-desc":
        sorted.sort((a, b) => parseDateToMs(b.dateAdded) - parseDateToMs(a.dateAdded))
        break
      case "expiry-asc":
        sorted.sort((a, b) => {
          const aMs = parseDateToMs(a.expiryDate)
          const bMs = parseDateToMs(b.expiryDate)
          if (aMs === 0 && bMs === 0) return 0
          if (aMs === 0) return 1  // no expiry goes last
          if (bMs === 0) return -1
          return aMs - bMs
        })
        break
      case "expiry-desc":
        sorted.sort((a, b) => {
          const aMs = parseDateToMs(a.expiryDate)
          const bMs = parseDateToMs(b.expiryDate)
          if (aMs === 0 && bMs === 0) return 0
          if (aMs === 0) return 1
          if (bMs === 0) return -1
          return bMs - aMs
        })
        break
      case "stock-asc":
        sorted.sort((a, b) => a.stockLeft - b.stockLeft)
        break
      case "stock-desc":
        sorted.sort((a, b) => b.stockLeft - a.stockLeft)
        break
      default:
        // Keep default sort (newest first)
        break
    }
    return sorted
  }, [groupedProducts, sortMode])
  
const filteredProducts = sortedProducts.filter(group => group.stockLeft > 0)
  const dataLength = filteredProducts.length
  const totalPages = Math.max(1, Math.ceil(dataLength / itemsPerPage))
  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredProducts.slice(start, start + itemsPerPage)
  }, [filteredProducts, currentPage, itemsPerPage])

  // ─── Expand/Collapse ───────────────────────────────────────────────────
  const toggleExpand = useCallback((barcode: string) => {
    setExpandedBarcodes(prev => {
      const next = new Set(prev)
      if (next.has(barcode)) {
        next.delete(barcode)
      } else {
        next.add(barcode)
      }
      return next
    })
  }, [])

  // ─── Scroll detection ────────────────────────────────────────────────────
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      if (!hasScrolledOnce.current) {
        hasScrolledOnce.current = true
        setShowScrollHint(false)
      }
    }

    const checkOverflow = () => {
      const hasOverflow = container.scrollHeight > container.clientHeight + 4
      setShowBottomIndicator(hasOverflow)
      setShowScrollHint(hasOverflow)
      hasScrolledOnce.current = false
    }
    checkOverflow()

    container.addEventListener("scroll", handleScroll, { passive: true })
    const resizeObserver = new ResizeObserver(checkOverflow)
    resizeObserver.observe(container)

    return () => {
      container.removeEventListener("scroll", handleScroll)
      resizeObserver.disconnect()
    }
  }, [paginatedGroups])

  // Reset to page 1 when data changes or rows per page changes
  useEffect(() => {
    setCurrentPage(1)
  }, [dataLength, itemsPerPage, sortMode])

  // Handle jump-to-page and auto-expand for scrollToItemId
  useEffect(() => {
    if (!scrollToItemId) return
    
    // Find the product containing this barcode (either as main barcode or in batches)
    const productIndex = filteredProducts.findIndex(p => 
      p.barcode === scrollToItemId || 
      (p.batches && p.batches.some((b: any) => b.barcode === scrollToItemId))
    )

    if (productIndex !== -1) {
      const pageOfItem = Math.floor(productIndex / itemsPerPage) + 1
      if (pageOfItem !== currentPage) {
        setCurrentPage(pageOfItem)
      }
      
      const product = filteredProducts[productIndex]
      // If it's a batch barcode, expand the product to show the row
      if (product.batches && product.batches.some((b: any) => b.barcode === scrollToItemId)) {
        setExpandedBarcodes(prev => {
          if (prev.has(product.barcode)) return prev
          const next = new Set(prev)
          next.add(product.barcode)
          return next
        })
      }
    }
  }, [scrollToItemId, filteredProducts, itemsPerPage, currentPage])

  // Scroll to item
  useEffect(() => {
    if (!scrollToItemId) return
    const scrollToItem = () => {
      const rowElement = itemRowRefs.current.get(scrollToItemId)
      if (rowElement) {
        rowElement.scrollIntoView({ behavior: "smooth", block: "center" })
        if (onItemScrolled) onItemScrolled()
        return true
      }
      return false
    }
    if (scrollToItem()) return
    const timeoutId = setTimeout(() => {
      if (scrollToItem()) return
      const fallbackElement = document.getElementById(`inventory-item-${scrollToItemId}`)
      if (fallbackElement) {
        fallbackElement.scrollIntoView({ behavior: "smooth", block: "center" })
        if (onItemScrolled) onItemScrolled()
      }
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [scrollToItemId, onItemScrolled, items])

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded" />
        ))}
      </div>
    )
  }

  if (dataLength === 0) {
    return (
      <div className="text-center py-16 px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 mb-4 shadow-inner">
          {searchQuery ? (
            <SearchX className="w-7 h-7 text-gray-400" />
          ) : (
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          )}
        </div>
        <p className="text-foreground text-lg font-semibold mb-2">
          {searchQuery ? "No items found matching your search or filters" : "No Products Found"}
        </p>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          {searchQuery
            ? `No results for "${searchQuery}". Try a different search term or adjust your filters.`
            : "No products match your current filters. Try adding inventory items or changing filter settings."
          }
        </p>
      </div>
    )
  }

  // ─── Summary table columns (inventory tracking layout) ────
  // width:  fixed px class applied to <th>   (controls min column width)
  // Extra flag `weightGroup` marks the weight columns for the subtle group divider
  const SUMMARY_COLUMNS = [
    { key: "expand",            label: "",                   align: "center" as const, width: "w-10 min-w-[40px]" },
    { key: "dateAdded",         label: "Date Added",          align: "center" as const, width: "min-w-[110px] w-[110px]" },
    { key: "product",           label: "Product Name",        align: "left"   as const, width: "min-w-[200px]" },
    { key: "barcode",           label: "Barcode",             align: "left"   as const, width: "min-w-[150px]" },
    { key: "expiryDate",        label: "Expiry Date",         align: "center" as const, width: "min-w-[110px] w-[110px]" },
    { key: "incoming",          label: "Incoming",            align: "right"  as const, width: "min-w-[100px] w-[100px]" },
    { key: "outgoing",          label: "Outgoing",            align: "right"  as const, width: "min-w-[100px] w-[100px]" },
    { key: "goodReturn",        label: "Good Rtn",            align: "right"  as const, width: "min-w-[100px] w-[100px]" },
    { key: "badReturn",         label: "Bad Rtn",             align: "right"  as const, width: "min-w-[100px] w-[100px]" },
    { key: "remainingStock",    label: "Remaining",           align: "right"  as const, width: "min-w-[120px] w-[120px]" },
    ...(isArchiveView ? [{ key: "archiveInfo", label: "Archive Info", align: "center" as const, width: "min-w-[120px] w-[120px]" }] : []),
    { key: "status",            label: "Status",              align: "center" as const, width: "min-w-[110px] w-[110px]", ownerOnly: true },
    { key: "reorderNeeded",     label: "Reorder Needed",      align: "center" as const, width: "min-w-[130px] w-[130px]", ownerOnly: true },
    // ── Weight group: subtle left-border on first column ──
    { key: "productionWeight",  label: "Prod. Weight",        align: "right"  as const, width: "min-w-[110px] w-[110px]", weightGroup: true },
    { key: "packingWeight",     label: "Pack. Weight",        align: "right"  as const, width: "min-w-[110px] w-[110px]" },
    { key: "weightDifference",  label: "Wt. Diff.",           align: "right"  as const, width: "min-w-[100px] w-[100px]" },
    { key: "actions",           label: "Actions",             align: "center" as const, width: "min-w-[218px] w-[218px]" },
  ].filter(col => {
    if (readOnly) {
      return ["product", "expiryDate", "remainingStock", "status", "reorderNeeded"].includes(col.key)
    }
    return !(col as any).ownerOnly
  }).map(col => {
    if (readOnly) {
      if (col.key === "product") return { ...col, width: "w-[50%]", align: "left" }
      if (col.key === "expiryDate") return { ...col, width: "w-[15%]", align: "center" }
      if (col.key === "remainingStock") return { ...col, width: "w-[10%]", align: "center" }
      if (col.key === "status") return { ...col, width: "w-[12%]", align: "center" }
      if (col.key === "reorderNeeded") return { ...col, width: "w-[13%]", align: "center" }
    }
    return col
  });



  return (
    <>
      <div className="space-y-3 sm:space-y-4">
        {/* ─── INFO BANNER ──────────────────────────────────────────────────── */}
        <div className="text-[10px] sm:text-xs text-muted-foreground px-1">
          Showing <span className="font-medium text-foreground">{((currentPage - 1) * itemsPerPage) + 1}</span>–<span className="font-medium text-foreground">{Math.min(currentPage * itemsPerPage, dataLength)}</span> of{" "}
          <span className="font-medium text-foreground">{dataLength}</span> products
          <span className="hidden sm:inline">{" "}({transactions.length} transactions)</span>
          {totalPages > 1 && <> · Page {currentPage} of {totalPages}</>}
        </div>

        {/* ─── DESKTOP TABLE ───────────────────────────────────────────────── */}
        <div className="hidden lg:block relative rounded-xl border border-border/40 bg-card overflow-hidden shadow-sm">
          <div
            ref={scrollContainerRef}
            className="overflow-x-auto overflow-y-auto max-h-[65vh] inventory-scroll-container"
          >
            <table className={`w-full text-left ${readOnly ? "table-fixed" : ""}`} style={!readOnly ? { minWidth: "max-content" } : {}}>
              <thead className="sticky top-0 z-20 bg-gray-50/95 dark:bg-muted/60 border-b-2 border-border/50 backdrop-blur-sm">
                <tr>
                  {SUMMARY_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={[
                        readOnly ? "px-2.5 py-1.5" : "h-11 px-4 py-2.5",
                        "text-[11px] font-bold text-muted-foreground/80 uppercase tracking-wider whitespace-nowrap select-none",
                        col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "left",
                        col.width || "",
                        (col as any).weightGroup ? "border-l-2 border-border/50" : "",
                        col.key === "actions" ? "" : "",
                      ].filter(Boolean).join(" ")}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedGroups.map((originalGroup, groupIndex) => {
                  const isExpanded = expandedBarcodes.has(originalGroup.productName)

                  const historyTransactions = originalGroup.transactions
                  const hasHistory = historyTransactions.length > 0
                  
                  const batches = originalGroup.batches && originalGroup.batches.length > 0
                    ? originalGroup.batches
                    : [originalGroup]
                  const mainBatch = batches[0]
                  const hasMultipleBatches = batches.length > 1
                  
                  const rowsToRender = isExpanded && hasMultipleBatches
                    ? batches
                    : [mainBatch];

                  return (
                    <Fragment key={originalGroup.productName}>
                      {rowsToRender.map((rowData: any, rowIndex: number) => {
                        const isMainRow = rowIndex === 0;
                        // For main row: use originalGroup totals but batch-specific fields (barcode, expiry, dateAdded)
                        // For child rows: use batch data directly
                        const batchBarcode = rowData.barcode || rowData.id || ""
                        const group = isMainRow
                          ? { ...originalGroup, barcode: batchBarcode, expiryDate: rowData.expiryDate, dateAdded: rowData.dateAdded, productionDate: rowData.productionDate, supplierName: rowData.supplierName, production_weight: rowData.production_weight, packing_weight: rowData.packing_weight, weight_difference: rowData.weight_difference, incoming_weight: rowData.incoming_weight ?? originalGroup.incoming_weight, totalIncoming: rowData.totalIncoming ?? originalGroup.totalIncoming, totalOutgoing: rowData.totalOutgoing ?? originalGroup.totalOutgoing, totalGoodReturn: rowData.totalGoodReturn ?? originalGroup.totalGoodReturn, totalDamageReturn: rowData.totalDamageReturn ?? originalGroup.totalDamageReturn, stockLeft: isExpanded ? (rowData.stockLeft ?? originalGroup.stockLeft) : originalGroup.stockLeft }
                          : { ...rowData, productName: originalGroup.productName, barcode: batchBarcode, stockLeft: rowData.stockLeft ?? rowData.qty }

                        // Check if item should be highlighted based on the filter
                        let isHighlighted = false
                        if (highlightFilter === "low-stock" && group.stockLeft > 0 && group.stockLeft < 10) {
                          isHighlighted = true
                        } else if (highlightFilter === "out-of-stock" && group.stockLeft <= 0) {
                          isHighlighted = true
                        } else if ((highlightFilter === "expiring" || highlightFilter === "expiring-soon") && group.expiryDate) {
                          const todayUrl = new Date()
                          todayUrl.setHours(0, 0, 0, 0)
                          const expDUrl = new Date(group.expiryDate instanceof Date ? group.expiryDate : group.expiryDate?.toDate ? group.expiryDate.toDate() : new Date(group.expiryDate))
                          if (!isNaN(expDUrl.getTime())) {
                            const sevenDaysUrl = new Date(todayUrl)
                            sevenDaysUrl.setDate(todayUrl.getDate() + 7)
                            if (expDUrl <= sevenDaysUrl) {
                              isHighlighted = true
                            }
                          }
                        }

                        let highlightRing = ""
                        if (isHighlighted) {
                          if (highlightFilter === "low-stock") highlightRing = "bg-amber-50/60 dark:bg-amber-950/20 ring-1 ring-amber-400 ring-inset border-transparent relative z-10"
                          else if (highlightFilter === "out-of-stock") highlightRing = "bg-red-50/60 dark:bg-red-950/20 ring-1 ring-red-400 ring-inset border-transparent relative z-10"
                          else if (highlightFilter === "expiring" || highlightFilter === "expiring-soon") highlightRing = "bg-orange-50/60 dark:bg-orange-950/20 ring-1 ring-orange-400 ring-inset border-transparent relative z-10"
                        }
                        // Weight discrepancy indicator — secondary highlight (only when no filter highlight active)
                        const hasWeightDiscrepancy = group.weight_difference != null && group.weight_difference > 5
                        if (!isHighlighted && hasWeightDiscrepancy) {
                          highlightRing = "ring-1 ring-orange-300 ring-inset border-transparent relative z-10"
                        }

                        return (
                          <tr
                            key={isMainRow ? originalGroup.productName : `${originalGroup.productName}-batch-${group.barcode}`}
                            id={`inventory-${batchBarcode}`}
                            ref={(el) => { 
                              if (el) {
                                if (isMainRow) itemRowRefs.current.set(originalGroup.productName, el)
                                itemRowRefs.current.set(batchBarcode, el)
                              }
                            }}
                            className={[
                              "group border-b border-border/25 transition-colors duration-150",
                              hasMultipleBatches && isMainRow ? "cursor-pointer" : "",
                              !isMainRow
                                ? "bg-slate-50/40 dark:bg-slate-900/10"
                                : isExpanded
                                  ? "bg-blue-50/70 dark:bg-blue-950/20"
                                  : groupIndex % 2 === 0
                                    ? "bg-white dark:bg-card"
                                    : "bg-gray-50/50 dark:bg-muted/10",
                              isMainRow ? "hover:bg-blue-50/40 dark:hover:bg-muted/25" : "hover:bg-slate-100/50 dark:hover:bg-slate-800/20",
                              highlightRing,
                            ].filter(Boolean).join(" ")}
                            onClick={() => hasMultipleBatches && isMainRow && toggleExpand(originalGroup.productName)}
                            title={hasMultipleBatches && isMainRow ? "Click to view batches" : ""}
                          >
                        {/* Expand Icon */}
                        {!readOnly && (
                        <td className="h-14 px-3 py-2 align-middle text-center w-10">
                          {hasMultipleBatches && isMainRow ? (
                            <div className="flex items-center gap-1">
                              <div className={`inline-flex items-center justify-center w-6 h-6 rounded-md transition-all duration-200 ${
                                isExpanded
                                  ? "bg-blue-500 text-white shadow-sm"
                                  : "bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600"
                              }`}>
                                {isExpanded
                                  ? <ChevronUp className="h-3.5 w-3.5" />
                                  : <ChevronDown className="h-3.5 w-3.5" />
                                }
                              </div>
                              {!isExpanded && <span className="text-[10px] font-bold text-slate-400">+{batches.length - 1}</span>}
                            </div>
                          ) : (
                            <div className="w-6 h-6" />
                          )}
                        </td>
                        )}

                        {/* Date Added — center aligned, narrow */}
                        {!readOnly && (
                        <td className="h-14 px-4 py-2 text-xs text-foreground/65 align-middle whitespace-nowrap text-center">
                          {formatTxnDate(group.dateAdded) !== "\u2014"
                            ? formatTxnDate(group.dateAdded)
                            : <span className="text-muted-foreground">—</span>
                          }
                        </td>
                        )}

                        {/* Product Name — left aligned, wide */}
                        <td className={`${readOnly ? "px-2.5 py-1.5" : "h-14 pl-6 pr-4 py-2"} font-medium text-sm text-foreground align-middle`}>
                          <div className="flex items-center gap-3 min-w-0 group/product hover:scale-[1.02] transition-transform">
                            <Image
                              src={
                                productImageMap[group.product_id] ||
                                productNameImageMap[(group.productName || "").toLowerCase().trim()] ||
                                itemImageMap[batchBarcode] ||
                                group.imageUrl ||
                                "/placeholder.png"
                              }
                              alt={group.productName}
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-lg object-cover border bg-gray-50/50 shadow-sm shrink-0"
                              onError={(e: any) => { e.currentTarget.src = "/placeholder.png" }}
                            />
                            <span className="line-clamp-2 min-w-0" title={group.productName}>
                              {highlightMatch(group.productName, searchQuery)}
                            </span>
                          </div>
                        </td>

                        {/* Barcode — left aligned, wide, mono */}
                        {!readOnly && (
                        <td className="h-14 px-4 py-2 align-middle">
                          <div className="font-mono text-[12px] text-foreground/80 truncate" title={batchBarcode}>
                            {batchBarcode
                              ? highlightMatch(batchBarcode, searchQuery)
                              : <span className="text-muted-foreground">—</span>
                            }
                          </div>
                        </td>
                        )}

                        {/* Expiry Date — centered, narrow */}
                        <td className={`${readOnly ? "px-2.5 py-1.5" : "h-14 px-4 py-2"} text-xs align-middle whitespace-nowrap text-center`}>
                          {formatTxnDate(group.expiryDate) !== "\u2014" ? (
                            <span className="text-foreground/70">{formatTxnDate(group.expiryDate)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Incoming Stock — right aligned, show weight in kg */}
                        {!readOnly && (
                        <td className="h-14 px-4 py-2 align-middle text-right">
                          {(() => {
                            const inWeight = group.incoming_weight ?? (group.production_weight ?? null)
                            return (
                              <span className={`text-sm font-semibold ${
                                group.totalIncoming > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground font-normal"
                              }`}>
                                {inWeight != null ? (
                                  <>{formatWeight(inWeight)}<span className="text-[10px] font-normal opacity-70 ml-1">kg</span></>
                                ) : (
                                  <>{formatNumber(group.totalIncoming)}<span className="text-[10px] font-normal opacity-70 ml-1">kg</span></>
                                )}
                              </span>
                            )
                          })()}
                        </td>
                        )}

                        {/* Outgoing Stock — right aligned */}
                        {!readOnly && (
                        <td className="h-14 px-4 py-2 align-middle text-right">
                          <span className={`text-sm font-semibold ${
                            group.totalOutgoing > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground font-normal"
                          }`}>
                            {formatNumber(group.totalOutgoing)}
                            <span className="text-[10px] font-normal opacity-70 ml-1">kg</span>
                          </span>
                        </td>
                        )}

                        {/* Good Return — right aligned */}
                        {!readOnly && (
                        <td className="h-14 px-4 py-2 align-middle text-right">
                          <span className={`text-sm font-semibold ${
                            group.totalGoodReturn > 0 ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground font-normal"
                          }`}>
                            {group.totalGoodReturn > 0 ? "+" : ""}{formatNumber(group.totalGoodReturn)}
                            <span className="text-[10px] font-normal opacity-70 ml-1">kg</span>
                          </span>
                        </td>
                        )}

                        {/* Bad Return — right aligned */}
                        {!readOnly && (
                        <td className="h-14 px-4 py-2 align-middle text-right">
                          <span className={`text-sm font-semibold ${
                            group.totalDamageReturn > 0 ? "text-slate-500 dark:text-slate-400" : "text-muted-foreground font-normal"
                          }`}>
                            {formatNumber(group.totalDamageReturn)}
                            <span className="text-[10px] font-normal opacity-70 ml-1">kg</span>
                          </span>
                        </td>
                        )}

                        {/* Remaining Stock — right aligned, weight-based display */}
                        <td className={`${readOnly ? "px-2.5 py-1.5 text-center" : "h-14 px-4 py-2 text-right"} align-middle`}>
                          {(() => {
                            const stock = group.stockLeft;
                            const remainingWeight = stock;
                            const totalBoxes = Math.floor(remainingWeight / 25);
                            let colorClass = "text-green-700 dark:text-green-400";
                            let bgClass = "bg-green-50 dark:bg-green-950/20";
                            let dotClass = "bg-green-500";
                            if (stock <= 0) {
                              colorClass = "text-red-700 dark:text-red-400";
                              bgClass = "bg-red-50 dark:bg-red-950/20";
                              dotClass = "bg-red-500";
                            } else if (stock <= 5) {
                              colorClass = "text-amber-700 dark:text-amber-400";
                              bgClass = "bg-amber-50 dark:bg-amber-950/20";
                              dotClass = "bg-amber-500";
                            }
                            return (
                              <span className={`inline-flex items-center gap-1.5 font-bold text-sm px-2 py-0.5 rounded-md ${colorClass} ${bgClass}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${dotClass} shrink-0`} />
                                {formatWeight(remainingWeight)} kg
                                {stock <= 0 && <span className="ml-1 text-[10px] uppercase tracking-wider font-black">(OUT OF STOCK)</span>}
                                {remainingWeight >= 25 && <span className="text-[10px] font-normal opacity-75">({totalBoxes} boxes)</span>}
                              </span>
                            );
                          })()}
                        </td>

                        {/* Archive Info — ONLY shown when isArchiveView is true */}
                        {isArchiveView && (
                          <td className="h-14 px-4 py-2 align-middle text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                group.archivedReason === "no_remaining_stock" ? "bg-red-50 text-red-700 border-red-200" :
                                group.archivedReason === "expired" ? "bg-orange-50 text-orange-700 border-orange-200" :
                                "bg-slate-50 text-slate-700 border-slate-200"
                              }`}>
                                {group.archivedReason === "no_remaining_stock" ? "No Stock" :
                                 group.archivedReason === "expired" ? "Expired" : "Manual"}
                              </span>
                              <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                                {formatTxnDate(group.archivedAt) !== "\u2014" ? formatTxnDate(group.archivedAt) : ""}
                              </span>
                            </div>
                          </td>
                        )}

                        {/* Status — ONLY shown when readOnly is true */}
                        {readOnly && (
                          <td className="px-2.5 py-1.5 align-middle text-center">
                            {(() => {
                              const stock = group.stockLeft;
                              if (stock <= 0) {
                                return <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-xs font-bold border border-red-200 shadow-sm">❌ Out</span>
                              } else if (stock <= 5) {
                                return <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200 shadow-sm">⚠ Low</span>
                              } else {
                                return <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-green-100 text-green-700 text-xs font-bold border border-green-200 shadow-sm">✅ OK</span>
                              }
                            })()}
                          </td>
                        )}

                        {/* Reorder Needed — ONLY shown when readOnly is true */}
                        {readOnly && (
                          <td className="px-2.5 py-1.5 align-middle text-center">
                            {group.stockLeft <= 5 ? (
                              <span className="text-amber-600 font-bold text-xs tracking-wide">⚠ Yes</span>
                            ) : (
                              <span className="text-muted-foreground font-bold text-lg">—</span>
                            )}
                          </td>
                        )}

                        {/* Production Weight — weight-group left border, right aligned */}
                        {!readOnly && (
                        <td className="h-14 px-4 py-2 align-middle text-right border-l-2 border-border/40">
                          {group.production_weight != null ? (
                            <span className="text-sm font-medium text-foreground/80">
                              {formatWeight(group.production_weight)}
                              <span className="text-[10px] text-muted-foreground ml-0.5">kg</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">N/A</span>
                          )}
                        </td>
                        )}

                        {/* Packing Weight — right aligned */}
                        {!readOnly && (
                        <td className="h-14 px-4 py-2 align-middle text-right">
                          {group.packing_weight != null ? (
                            <span className="text-sm font-medium text-foreground/80">
                              {formatWeight(group.packing_weight)}
                              <span className="text-[10px] text-muted-foreground ml-0.5">kg</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">N/A</span>
                          )}
                        </td>
                        )}

                        {/* Weight Difference — right aligned, badge */}
                        {!readOnly && (
                        <td className="h-14 px-4 py-2 align-middle text-right">
                          {group.weight_difference != null ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold ${
                              group.weight_difference > 5
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            }`}>
                              {group.weight_difference > 5 && <span aria-label="warning">⚠</span>}
                              {formatWeight(group.weight_difference)} kg
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">N/A</span>
                          )}
                        </td>
                        )}



                        {/* Actions — sticky right, equal-gap buttons */}
                        {!readOnly && (
                        <td className="h-14 px-4 py-2 align-middle text-center whitespace-nowrap bg-inherit">
                          <div
                            className="flex items-center justify-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {hasHistory && isMainRow && (
                              <Button
                                size="sm"
                                className="h-8 px-2.5 gap-1.5 text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors shrink-0 shadow-sm"
                                onClick={() => setTxnDialogProduct(originalGroup)}
                                title="View Transaction History"
                              >
                                <History className="h-3.5 w-3.5 shrink-0" />
                                Transactions
                              </Button>
                            )}
                            {batchBarcode && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2.5 gap-1.5 text-xs font-medium text-blue-700 border-blue-200 hover:text-blue-800 hover:bg-blue-50 hover:border-blue-300 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950/30 transition-colors shrink-0"
                                  onClick={() => {
                                    setBarcodeViewItem({ barcode: batchBarcode, productName: group.productName, productionDate: formatTxnDate(group.productionDate) !== "\u2014" ? formatTxnDate(group.productionDate) : undefined, expiryDate: formatTxnDate(group.expiryDate) !== "\u2014" ? formatTxnDate(group.expiryDate) : undefined })
                                    setTimeout(() => {
                                      const printBtn = document.querySelector('[data-barcode-print]') as HTMLButtonElement
                                      if (printBtn) printBtn.click()
                                    }, 500)
                                  }}
                                  title="Print Barcode"
                                >
                                  <Printer className="h-3.5 w-3.5 shrink-0" />
                                  Print
                                </Button>
                                {!group.isArchived ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2.5 gap-1.5 text-xs font-medium text-amber-700 border-amber-200 hover:text-amber-800 hover:bg-amber-50 hover:border-amber-300 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-950/30 transition-colors shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const item = items.find((i: any) => i.barcode === batchBarcode);
                                      if (item) {
                                        setArchivingItem({ id: item.id, barcode: batchBarcode, productName: group.productName, isRestore: false });
                                      } else {
                                        toast({ title: "Error", description: "Item not found in inventory.", variant: "destructive" });
                                      }
                                    }}
                                    title="Archive Item"
                                  >
                                    <Archive className="h-3.5 w-3.5 shrink-0" />
                                    Archive
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2.5 gap-1.5 text-xs font-medium text-emerald-700 border-emerald-200 hover:text-emerald-800 hover:bg-emerald-50 hover:border-emerald-300 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30 transition-colors shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const item = items.find((i: any) => i.barcode === batchBarcode);
                                      if (item) {
                                        setArchivingItem({ id: item.id, barcode: batchBarcode, productName: group.productName, isRestore: true });
                                      } else {
                                        toast({ title: "Error", description: "Item not found in inventory.", variant: "destructive" });
                                      }
                                    }}
                                    title="Restore Item"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                                    Restore
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                        )}
                      </tr>
                      )})}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dynamic bottom gradient overlay */}
        {showBottomIndicator && (
          <div
            className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none rounded-b-xl transition-opacity duration-300"
            style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.5) 50%, transparent 100%)' }}
          />
        )}

        {/* "Scroll for more" hint */}
        {showScrollHint && paginatedGroups.length > 0 && (
          <div
            className={`absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full bg-white/90 dark:bg-gray-800/90 border border-border/60 shadow-md text-xs text-muted-foreground backdrop-blur-sm z-20 transition-opacity ${!showScrollHint ? 'scroll-hint-hidden' : ''}`}
          >
            <span>Scroll for more</span>
            <ChevronDown className="h-3 w-3 scroll-hint-chevron" />
          </div>
        )}

        {/* ─── MOBILE / TABLET CARD VIEW ─────────────────────────────────── */}
        <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {paginatedGroups.map((originalGroup) => {
            const isExpanded = expandedBarcodes.has(originalGroup.productName)
            const historyTransactions = originalGroup.transactions
            const hasHistory = historyTransactions.length > 0

            const batches = originalGroup.batches && originalGroup.batches.length > 0
              ? originalGroup.batches
              : [originalGroup]
            const mainBatch = batches[0]
            const hasMultipleBatches = batches.length > 1

            const rowsToRender = isExpanded && hasMultipleBatches
              ? batches
              : [mainBatch];

            return (
              <Fragment key={originalGroup.productName}>
                {rowsToRender.map((rowData: any, rowIndex: number) => {
                  const isMainRow = rowIndex === 0;
                  const batchBarcode = rowData.barcode || rowData.id || ""
                  const group = isMainRow
                    ? { ...originalGroup, barcode: batchBarcode, expiryDate: rowData.expiryDate, dateAdded: rowData.dateAdded, productionDate: rowData.productionDate, supplierName: rowData.supplierName, production_weight: rowData.production_weight, packing_weight: rowData.packing_weight, weight_difference: rowData.weight_difference, incoming_weight: rowData.incoming_weight ?? originalGroup.incoming_weight, totalIncoming: rowData.totalIncoming ?? originalGroup.totalIncoming, totalOutgoing: rowData.totalOutgoing ?? originalGroup.totalOutgoing, stockLeft: isExpanded ? (rowData.stockLeft ?? originalGroup.stockLeft) : originalGroup.stockLeft }
                    : { ...rowData, productName: originalGroup.productName, barcode: batchBarcode, stockLeft: rowData.stockLeft ?? rowData.qty }

                  // Remaining stock status
            const stock = group.stockLeft
            const mobileWeight = stock
            const mobileBoxes = Math.floor(mobileWeight / 25)
            let stockColorClass = "text-green-700 dark:text-green-400"
            let stockBgClass = "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
            let stockDotClass = "bg-green-500"
            if (stock <= 0) {
              stockColorClass = "text-red-700 dark:text-red-400"
              stockBgClass = "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
              stockDotClass = "bg-red-500"
            } else if (stock < 10) {
              stockColorClass = "text-amber-700 dark:text-amber-400"
              stockBgClass = "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
              stockDotClass = "bg-amber-500"
            }

            return (
              <div
                key={isMainRow ? originalGroup.productName : `${originalGroup.productName}-batch-${group.barcode}`}
                id={isMainRow ? `inventory-item-mobile-${originalGroup.productName.replace(/\\s+/g, '-')}` : `inventory-item-mobile-${group.barcode}`}
                ref={(el) => { if (el && isMainRow) itemRowRefs.current.set(originalGroup.productName, el) }}
                className={[
                  "inventory-mobile-card relative rounded-xl overflow-hidden transition-all duration-300 border",
                  !isMainRow
                    ? "border-slate-300 dark:border-slate-700 md:col-span-2 bg-slate-50/40 dark:bg-slate-900/10"
                    : isExpanded
                      ? "border-blue-300 dark:border-blue-700 shadow-lg shadow-blue-500/10 ring-1 ring-blue-200/50 dark:ring-blue-800/30 md:col-span-2"
                      : "border-border/60 shadow-sm hover:shadow-md hover:border-blue-200/80 dark:hover:border-blue-800/60",
                  isMainRow ? "bg-white dark:bg-card" : "",
                ].join(" ")}
              >
                {/* Accent stripe — top indicator */}
                <div className={`h-0.5 sm:h-1 w-full ${
                  stock <= 0 ? "bg-gradient-to-r from-red-400 via-red-500 to-red-400" :
                  stock < 10 ? "bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400" :
                  "bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400"
                }`} />

                {/* ═══ CARD HEADER — Product Name + Barcode ═══ */}
                <div
                  className={[
                    "px-3 pt-3 pb-2 transition-colors",
                    hasMultipleBatches && isMainRow ? "cursor-pointer active:bg-blue-50/40 dark:active:bg-blue-950/30" : "",
                  ].join(" ")}
                  onClick={() => hasMultipleBatches && isMainRow && toggleExpand(originalGroup.productName)}
                >
                  <div className="flex items-start justify-between gap-2">
                    {/* Left: Info */}
                    <div className="flex-1 min-w-0">
                      {/* Product Name — Bold, top */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-base shrink-0" aria-hidden="true">
                          {(() => {
                            const name = (group.productName || "").toLowerCase();
                            if (name.includes("chicken")) return "🐔";
                            if (name.includes("pork") || name.includes("belly") || name.includes("back fat")) return "🥩";
                            if (name.includes("beef")) return "🐄";
                            return "📦";
                          })()}
                        </span>
                        <h3 className="font-bold text-[13px] sm:text-[15px] leading-tight text-foreground line-clamp-2">
                          {highlightMatch(group.productName, searchQuery)}
                        </h3>
                      </div>

                      {/* Barcode — small mono text */}
                      {!readOnly && (
                      <p className="text-[10px] sm:text-[11px] text-muted-foreground font-mono mt-1 ml-7 tracking-wide">
                        {highlightMatch(batchBarcode, searchQuery)}
                      </p>
                      )}
                    </div>

                    {/* Right: Expand toggle */}
                    {hasMultipleBatches && isMainRow && (
                      <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                          isExpanded
                            ? "bg-blue-500 text-white shadow-md shadow-blue-500/25"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                        }`}>
                          {isExpanded
                            ? <ChevronUp className="h-3.5 w-3.5" />
                            : <ChevronDown className="h-3.5 w-3.5" />
                          }
                        </div>
                        {!isExpanded && <span className="text-[9px] font-bold text-slate-400">+{batches.length - 1}</span>}
                      </div>
                    )}
                  </div>
                </div>

                {/* ═══ STATS GRID — Incoming / Outgoing / Remaining ═══ */}
                <div className="px-3 pb-2.5">
                  <div className={`grid gap-1.5 ${readOnly ? 'grid-cols-1' : 'grid-cols-3'}`}>
                    {/* Incoming — Green */}
                    {!readOnly && (
                    <div className="relative flex flex-col items-center justify-center rounded-lg border border-green-200/80 dark:border-green-800/40 bg-green-50/60 dark:bg-green-950/20 py-1.5 sm:py-2 px-1.5">
                      <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-green-600/80 dark:text-green-400/70 mb-0.5">In</span>
                      <span className="text-sm sm:text-base font-bold text-green-700 dark:text-green-400 leading-tight">
                        {(() => {
                          const inW = group.incoming_weight ?? group.production_weight ?? null
                          return inW != null ? formatWeight(inW) : (group.totalIncoming > 0 ? formatNumber(group.totalIncoming) : "0")
                        })()}
                      </span>
                      <span className="text-[8px] sm:text-[9px] text-green-600/60 dark:text-green-400/50 font-medium">kg</span>
                    </div>
                    )}

                    {/* Outgoing — Red */}
                    {!readOnly && (
                    <div className="relative flex flex-col items-center justify-center rounded-lg border border-red-200/80 dark:border-red-800/40 bg-red-50/60 dark:bg-red-950/20 py-1.5 sm:py-2 px-1.5">
                      <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-red-600/80 dark:text-red-400/70 mb-0.5">Out</span>
                      <span className="text-sm sm:text-base font-bold text-red-700 dark:text-red-400 leading-tight">
                        {group.totalOutgoing > 0 ? formatNumber(group.totalOutgoing) : "0"}
                      </span>
                      <span className="text-[8px] sm:text-[9px] text-red-600/60 dark:text-red-400/50 font-medium">kg</span>
                    </div>
                    )}

                    {/* Remaining — Dynamic badge, weight-based */}
                    <div className={`relative flex flex-col items-center justify-center rounded-lg border py-1.5 sm:py-2 px-1.5 ${stockBgClass}`}>
                      <span className={`text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                        stock <= 0 ? "text-red-600/80 dark:text-red-400/70" :
                        stock < 10 ? "text-amber-600/80 dark:text-amber-400/70" :
                        "text-green-600/80 dark:text-green-400/70"
                      }`}>Left</span>
                      <div className="flex items-center gap-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${stockDotClass} shrink-0`} />
                        <span className={`text-sm sm:text-base font-bold leading-tight ${stockColorClass}`}>
                          {formatWeight(mobileWeight)} kg
                          {stock <= 0 && <span className="block text-[8px] uppercase tracking-wider font-black">(OUT OF STOCK)</span>}
                        </span>
                      </div>
                      <span className={`text-[8px] sm:text-[9px] font-medium ${
                        stock <= 0 ? "text-red-600/60 dark:text-red-400/50" :
                        stock < 10 ? "text-amber-600/60 dark:text-amber-400/50" :
                        "text-green-600/60 dark:text-green-400/50"
                      }`}>{mobileWeight >= 25 ? `(${mobileBoxes} boxes)` : ""}</span>
                    </div>
                  </div>

                  {/* ═══ ADDITIONAL DETAILS — Expiry & Archive ═══ */}
                  <div className="grid grid-cols-1 gap-1.5 mt-1.5">
                    {isArchiveView && (
                      <div className="flex items-center gap-1.5 rounded-lg bg-red-50/80 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40 px-2 py-1.5">
                        <Archive className="h-3 w-3 text-red-500 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-red-600/80 font-semibold block leading-none mb-0.5">Archive Reason</span>
                          <span className="text-[11px] sm:text-xs font-semibold text-red-700">
                            {group.archivedReason === "no_remaining_stock" ? "No Stock" :
                             group.archivedReason === "expired" ? "Expired" : "Manual"}
                             <span className="text-[9px] ml-1 font-normal text-red-600/70">
                               ({formatTxnDate(group.archivedAt) !== "\u2014" ? formatTxnDate(group.archivedAt) : ""})
                             </span>
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 rounded-lg bg-slate-50/80 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-700/40 px-2 py-1.5">
                      <svg className="h-3 w-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div className="min-w-0">
                        <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-muted-foreground font-semibold block leading-none mb-0.5">Expiry</span>
                        <span className="text-[11px] sm:text-xs font-semibold text-foreground/80">
                          {formatTxnDate(group.expiryDate) !== "\u2014" ? formatTxnDate(group.expiryDate) : "\u2014"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ═══ WEIGHT TRACKING — Prod. / Pack. / Diff ═══ */}
                  {!readOnly && (group.production_weight != null || group.packing_weight != null) && (
                    <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                      <div className="flex flex-col rounded-lg bg-slate-50/80 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-700/40 px-2 py-1.5">
                        <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-muted-foreground font-semibold block leading-none mb-0.5">Prod. Wt</span>
                        <span className="text-[11px] sm:text-xs font-semibold text-foreground/80">
                          {group.production_weight != null ? `${formatWeight(group.production_weight)} kg` : "N/A"}
                        </span>
                      </div>
                      <div className="flex flex-col rounded-lg bg-slate-50/80 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-700/40 px-2 py-1.5">
                        <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-muted-foreground font-semibold block leading-none mb-0.5">Pack. Wt</span>
                        <span className="text-[11px] sm:text-xs font-semibold text-foreground/80">
                          {group.packing_weight != null ? `${formatWeight(group.packing_weight)} kg` : "N/A"}
                        </span>
                      </div>
                      <div className="flex flex-col rounded-lg border px-2 py-1.5 items-start justify-center">
                        <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-muted-foreground font-semibold block leading-none mb-0.5">Wt. Diff</span>
                        {group.weight_difference != null ? (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            group.weight_difference > 5
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          }`}>
                            {group.weight_difference > 5 ? "⚠ " : ""}{formatWeight(group.weight_difference)} kg
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-muted-foreground">N/A</span>
                        )}
                      </div>
                    </div>
                  )}


                </div>

                  {/* ═══ ACTIONS — Show Barcode + Print (touch-friendly) ═══ */}
                  {!readOnly && (batchBarcode || hasHistory) && isMainRow && (
                    <div className="px-3 pb-3 pt-0.5">
                      <div className="flex flex-col gap-1.5">
                        {hasHistory && (
                          <Button
                            size="sm"
                            className="w-full h-9 sm:h-10 rounded-lg gap-1.5 text-[11px] sm:text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 shadow-md transition-all active:scale-[0.98]"
                            onClick={(e) => { e.stopPropagation(); setTxnDialogProduct(originalGroup) }}
                            title="View Transactions"
                          >
                            <History className="h-3.5 w-3.5" />
                            Transactions
                          </Button>
                        )}
                        {batchBarcode && (
                        <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-9 sm:h-10 rounded-lg gap-1.5 text-[11px] sm:text-sm font-semibold text-blue-700 border-blue-200/80 bg-blue-50/40 hover:bg-blue-100/60 hover:text-blue-800 hover:border-blue-300 dark:text-blue-400 dark:border-blue-800 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 transition-all active:scale-[0.98]"
                          onClick={(e) => {
                            e.stopPropagation()
                            setBarcodeViewItem({ barcode: batchBarcode, productName: group.productName, productionDate: formatTxnDate(group.productionDate) !== "\u2014" ? formatTxnDate(group.productionDate) : undefined, expiryDate: formatTxnDate(group.expiryDate) !== "\u2014" ? formatTxnDate(group.expiryDate) : undefined })
                            setTimeout(() => {
                              const printBtn = document.querySelector('[data-barcode-print]') as HTMLButtonElement
                              if (printBtn) printBtn.click()
                            }, 500)
                          }}
                          title="Print Barcode"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Print
                        </Button>
                        {!group.isArchived ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-9 sm:h-10 rounded-lg gap-1.5 text-[11px] sm:text-sm font-semibold text-amber-700 border-amber-200/80 bg-amber-50/40 hover:bg-amber-100/60 hover:text-amber-800 hover:border-amber-300 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 transition-all active:scale-[0.98]"
                            onClick={(e) => {
                              e.stopPropagation();
                              const item = items.find(i => i.barcode === batchBarcode);
                              if (item) {
                                setArchivingItem({ id: item.id, barcode: batchBarcode, productName: group.productName, isRestore: false });
                              } else {
                                toast({ title: "Error", description: "Item not found in inventory.", variant: "destructive" });
                              }
                            }}
                            title="Archive Item"
                          >
                            <Archive className="h-3.5 w-3.5" />
                            Archive
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-9 sm:h-10 rounded-lg gap-1.5 text-[11px] sm:text-sm font-semibold text-emerald-700 border-emerald-200/80 bg-emerald-50/40 hover:bg-emerald-100/60 hover:text-emerald-800 hover:border-emerald-300 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 transition-all active:scale-[0.98]"
                            onClick={(e) => {
                              e.stopPropagation();
                              const item = items.find(i => i.barcode === batchBarcode);
                              if (item) {
                                setArchivingItem({ id: item.id, barcode: batchBarcode, productName: group.productName, isRestore: true });
                              } else {
                                toast({ title: "Error", description: "Item not found in inventory.", variant: "destructive" });
                              }
                            }}
                            title="Restore Item"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Restore
                          </Button>
                        )}
                        </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              )
            })}
              </Fragment>
            )
          })}
        </div>

        {/* ─── PAGINATION CONTROLS ──────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="pagination-bar flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-4 border-t border-border/40 bg-gradient-to-r from-gray-50/80 via-white to-gray-50/80 dark:from-muted/20 dark:via-card dark:to-muted/20 rounded-b-xl mt-[-1px]">
            {/* Left: Showing X–Y of Z */}
            <div className="text-xs sm:text-sm text-muted-foreground select-none">
              Showing{" "}
              <span className="font-semibold text-foreground">{((currentPage - 1) * itemsPerPage) + 1}</span>
              <span className="mx-0.5">–</span>
              <span className="font-semibold text-foreground">{Math.min(currentPage * itemsPerPage, dataLength)}</span>
              {" "}of{" "}
              <span className="font-semibold text-foreground">{dataLength}</span> products
              <span className="hidden sm:inline text-muted-foreground/60 ml-1.5">·</span>
              <span className="hidden sm:inline text-muted-foreground/60 ml-1">{itemsPerPage} per page</span>
            </div>

            {/* Right: Pagination buttons */}
            <div className="flex items-center gap-1">
              {/* First page */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="h-10 w-10 sm:h-9 sm:w-9 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-muted/40 disabled:opacity-30 transition-all"
                title="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>

              {/* Previous */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-10 w-10 sm:h-9 sm:w-9 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-muted/40 disabled:opacity-30 transition-all"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {/* Page numbers */}
              <div className="hidden sm:flex items-center gap-0.5 mx-1">
                {getPageNumbers(currentPage, totalPages).map((page, i) => (
                  page === 'ellipsis' ? (
                    <span key={`ellipsis-${i}`} className="w-9 h-9 flex items-center justify-center text-muted-foreground/50 text-sm select-none">…</span>
                  ) : (
                    <Button
                      key={page}
                      variant={page === currentPage ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setCurrentPage(page as number)}
                      className={`h-9 w-9 p-0 rounded-lg text-sm font-medium transition-all ${
                        page === currentPage
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 scale-105"
                          : "text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-muted/40"
                      }`}
                    >
                      {page}
                    </Button>
                  )
                ))}
              </div>

              {/* Mobile: simple page indicator */}
              <span className="sm:hidden text-xs font-medium text-muted-foreground mx-2 select-none">
                {currentPage} / {totalPages}
              </span>

              {/* Next */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-10 w-10 sm:h-9 sm:w-9 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-muted/40 disabled:opacity-30 transition-all"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              {/* Last page */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="h-10 w-10 sm:h-9 sm:w-9 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-muted/40 disabled:opacity-30 transition-all"
                title="Last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmationDialog
        open={!!cancellingItem}
        onOpenChange={(open) => { if (!open) setCancellingItem(null) }}
        title="Cancel Transaction"
        description="Are you sure you want to cancel this transaction? This action cannot be undone."
        confirmLabel="Yes, Cancel Transaction"
        cancelLabel="No"
        variant="danger"
        loading={cancelLoading}
        onConfirm={async () => {
          if (!cancellingItem) return
          setCancelLoading(true)
          try {
            await FirebaseService.deleteDocument("transactions", cancellingItem.id)
            toast({
              title: "✅ Transaction Cancelled",
              description: `Transaction for "${(cancellingItem as any).product_name || 'Unknown'}" has been removed.`,
            })
            setCancellingItem(null)
          } catch (error: any) {
            console.error("[InventoryTable] Cancel transaction error:", error)
            toast({
              title: "❌ Failed to Cancel",
              description: error?.message || "Something went wrong. Please try again.",
              variant: "destructive",
            })
          } finally {
            setCancelLoading(false)
          }
        }}
      >
        {cancellingItem && (
          <div className="rounded-lg border border-red-200 bg-red-50/60 dark:bg-red-950/20 dark:border-red-800 p-3 text-sm space-y-1.5">
            <div className="flex gap-2">
              <span className="text-muted-foreground text-xs font-semibold uppercase w-16 shrink-0">Product</span>
              <span className="font-medium text-foreground">{(cancellingItem as any).product_name || '—'}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground text-xs font-semibold uppercase w-16 shrink-0">Barcode</span>
              <span className="font-mono text-xs text-foreground">{(cancellingItem as any).barcode || '—'}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground text-xs font-semibold uppercase w-16 shrink-0">Type</span>
              <span className="font-medium text-foreground">{getMovementType(cancellingItem)}</span>
            </div>
          </div>
        )}
      </ConfirmationDialog>

      <ConfirmationDialog
        open={!!archivingItem}
        onOpenChange={(open) => { if (!open) setArchivingItem(null) }}
        title={archivingItem?.isRestore ? "Restore Item" : "Archive Item"}
        description={archivingItem?.isRestore 
          ? "Are you sure you want to restore this item to the active inventory?"
          : "Are you sure you want to archive this item? It will be hidden from the main list but its history will remain intact. You can view archived items using the Status filter."}
        confirmLabel={archivingItem?.isRestore ? "Yes, Restore Item" : "Yes, Archive Item"}
        cancelLabel="Cancel"
        variant={archivingItem?.isRestore ? "default" : "danger"}
        loading={archiveLoading}
        onConfirm={async () => {
          if (!archivingItem) return
          setArchiveLoading(true)
          try {
            if (archivingItem.isRestore) {
              await FirebaseService.updateDocument("inventory", archivingItem.id, {
                isArchived: false,
                archivedAt: null,
                archivedReason: null,
                status: "active"
              })
              toast({
                title: "✅ Item Restored",
                description: `"${archivingItem.productName}" has been restored to active inventory.`,
              })
            } else {
              await FirebaseService.updateDocument("inventory", archivingItem.id, {
                isArchived: true,
                archivedAt: serverTimestamp(),
                archivedReason: "manual",
                status: "archived"
              })
              toast({
                title: "✅ Item Archived",
                description: `"${archivingItem.productName}" has been archived.`,
              })
            }
            setArchivingItem(null)
          } catch (error: any) {
            console.error("[InventoryTable] Archive/Restore item error:", error)
            toast({
              title: archivingItem.isRestore ? "❌ Failed to Restore" : "❌ Failed to Archive",
              description: error?.message || "Something went wrong. Please try again.",
              variant: "destructive",
            })
          } finally {
            setArchiveLoading(false)
          }
        }}
      >
        {archivingItem && !archivingItem.isRestore && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-sm space-y-1.5 mt-2">
            <div className="flex gap-2">
              <span className="text-muted-foreground text-xs font-semibold uppercase w-16 shrink-0">Product</span>
              <span className="font-medium text-foreground">{archivingItem.productName || '—'}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground text-xs font-semibold uppercase w-16 shrink-0">Barcode</span>
              <span className="font-mono text-xs text-foreground">{archivingItem.barcode || '—'}</span>
            </div>
          </div>
        )}
      </ConfirmationDialog>

      {/* ─── TRANSACTION HISTORY DIALOG ──────────────────────────────────────── */}
      <Dialog open={!!txnDialogProduct} onOpenChange={(open) => { if (!open) setTxnDialogProduct(null) }}>
        <DialogContent className="!w-[95vw] sm:!w-auto max-w-[680px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b border-border/40 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-violet-500" />
              <span>Transaction History</span>
              {txnDialogProduct && (
                <span className="text-muted-foreground font-normal text-sm ml-1">— {txnDialogProduct.productName}</span>
              )}
            </DialogTitle>
            {txnDialogProduct && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {txnDialogProduct.transactions.length} {txnDialogProduct.transactions.length === 1 ? "record" : "records"} found
              </p>
            )}
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            {txnDialogProduct && txnDialogProduct.transactions.length > 0 ? (
              <TransactionHistoryList
                transactions={txnDialogProduct.transactions}
                setCancellingItem={(txn) => { setCancellingItem(txn); setTxnDialogProduct(null) }}
                readOnly={readOnly}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <History className="h-8 w-8 mb-3 opacity-30" />
                <p className="text-sm">No transactions found.</p>
              </div>
            )}
          </div>
          <div className="px-5 py-3 border-t border-border/40 shrink-0 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setTxnDialogProduct(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      <BarcodeModal
        open={!!barcodeViewItem}
        onOpenChange={(open) => { if (!open) setBarcodeViewItem(null) }}
        barcode={barcodeViewItem?.barcode || ""}
        productName={barcodeViewItem?.productName || ""}
        productionDate={barcodeViewItem?.productionDate}
        expiryDate={barcodeViewItem?.expiryDate}
      />

      {/* Bad Return Details Modal */}
      <Dialog open={!!badReturnDetailsView} onOpenChange={(open) => { if (!open) setBadReturnDetailsView(null) }}>
        <DialogContent className="!w-[95vw] sm:!w-auto max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <MessageSquareWarning className="h-5 w-5 text-red-500" />
              Bad Return Details
            </DialogTitle>
          </DialogHeader>
          {badReturnDetailsView && (
            <div className="space-y-3 pt-1">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Product</span>
                  <span className="font-medium text-slate-800 text-right max-w-[200px] truncate">{badReturnDetailsView.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Weight</span>
                  <span className="font-bold text-red-600">{badReturnDetailsView.quantity} kg</span>
                </div>
              </div>
              {badReturnDetailsView.details ? (
                <div className="rounded-lg border border-red-200 bg-red-50/60 p-3 grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Reason</span>
                    <span className="font-semibold text-red-700 text-right max-w-[200px]">{badReturnDetailsView.details.reason || "—"}</span>
                  </div>
                  {badReturnDetailsView.details.notes && (
                    <div className="grid gap-1">
                      <span className="text-slate-500 text-xs">Notes</span>
                      <p className="text-slate-700 text-sm bg-white rounded-md border border-red-100 px-3 py-2">{badReturnDetailsView.details.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center text-sm text-slate-400">
                  No reason recorded for this bad return.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
