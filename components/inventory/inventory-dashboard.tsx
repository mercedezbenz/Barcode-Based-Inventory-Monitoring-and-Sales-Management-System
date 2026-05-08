"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Package, TrendingUp, TrendingDown, AlertTriangle, Search, X, Plus, ArrowDownUp, Clock, PackageMinus, ScanLine, Tag, RotateCcw, Filter, CalendarClock, Layers, Archive } from "lucide-react"
import { TodaysMovementIcon, StockOverviewIcon, ReturnsSummaryIcon, FastMovingIcon, ExpiryAlertIcon, LowStockAlertIcon } from "./inventory-icons"
import { Button } from "@/components/ui/button"
import { InventoryTable } from "./inventory-table"
import { AddItemDialog } from "./add-item-dialog"
import { OutgoingStockDialog } from "./outgoing-stock-dialog"
import { ReturnItemDialog } from "./return-item-dialog"
import { ScanItemDialog } from "./scan-item-dialog"
import { ArchivedItemsDialog } from "./archived-items-dialog"
import { InventoryService, CategoryService, TransactionService } from "@/services/firebase-service"
import type { InventoryItem, InventoryTransaction, Category } from "@/lib/types"
import { CATEGORIES, TYPES, getTypesForCategory } from "@/lib/product-data"
import { calculateWeeklyChange, calculateWeeklyCountChange, formatWeeklyChange, parseFirestoreDate } from "@/lib/weekly-change-utils"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner"
import { InventoryDashboardSkeleton } from "@/components/skeletons/dashboard-skeleton"
import { ToastAction } from "@/components/ui/toast"

// ——— Recently Added filter options ———————————————————————————————————————————

const RECENTLY_ADDED_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
]

// ——— Stock Status filter options ———————————————————————————————————————————
const STOCK_STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "in-stock", label: "In Stock" },
  { value: "low-stock", label: "Low Stock" },
  { value: "returns-summary", label: "Returns Summary" },
  { value: "archived", label: "Archived" },
]

// ——— Expiration filter options ———————————————————————————————————————————
const EXPIRATION_OPTIONS = [
  { value: "all", label: "All" },
  { value: "expiring-soon", label: "Expiring Soon" },
  { value: "expired", label: "Expired" },
]

// ——— Sort options ———————————————————————————————————————————
const SORT_OPTIONS = [
  { value: "date-desc", label: "Newest First" },
  { value: "date-asc", label: "Oldest First" },
  { value: "expiry-asc", label: "Expiry: Soonest" },
  { value: "expiry-desc", label: "Expiry: Latest" },
  { value: "stock-asc", label: "Stock: Low → High" },
  { value: "stock-desc", label: "Stock: High → Low" },
]

/** Returns the cutoff Date for a given recently-added filter value. */
function getRecentlyCutoff(filter: string): Date | null {
  const now = new Date()
  switch (filter) {
    case "today": {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      return start
    }
    case "week": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case "month": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    default: return null
  }
}

// ——— Status helpers (kept for summary cards, not for filtering) ——————————————

export type ItemStatus = "all" | "in-stock" | "low-stock" | "out-of-stock" | "expiring-soon" | "expired"

/** Derives the computed status of an inventory item from stockLeft and expirationDate. */
export function getItemStatus(item: any): Exclude<ItemStatus, "all"> {
  const incoming = item.incoming_weight ?? item.production_weight ?? 0
  const outgoing = item.outgoing_weight ?? 0
  const goodReturn = item.good_return_weight ?? 0
  const damageReturn = item.damage_return_weight ?? 0
  const weightLeft = Math.max(0, incoming - outgoing + goodReturn - damageReturn)

  // Check expiration first — these states take priority over stock level
  const expiryDate = item.expiryDate ?? item.expirationDate ?? null
  if (expiryDate) {
    try {
      const d = expiryDate instanceof Date ? expiryDate
        : expiryDate?.toDate ? expiryDate.toDate()
          : new Date(expiryDate)
      if (!isNaN(d.getTime())) {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const expiry = new Date(d); expiry.setHours(0, 0, 0, 0)
        if (expiry < today) return "expired"
        const sevenDays = new Date(today); sevenDays.setDate(today.getDate() + 7)
        if (expiry <= sevenDays) return "expiring-soon"
      }
    } catch { /* ignore */ }
  }

  if (weightLeft <= 0) return "out-of-stock"
  if (weightLeft <= 50) return "low-stock"
  return "in-stock"
}

export function InventoryDashboard({ isArchiveView = false }: { isArchiveView?: boolean }) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const { isReadOnly, canEditInventory } = useAuth()

  // ——— Filter state ————————————————————————————————————————————————————————
  const [selectedProductFilter, setSelectedProductFilter] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [recentlyAddedFilter, setRecentlyAddedFilter] = useState<string>("all")
  const [stockStatusFilter, setStockStatusFilter] = useState<string>(isArchiveView ? "archived" : "all")
  const [expirationFilter, setExpirationFilter] = useState<string>("all")
  // Search: real-time debounced
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [debouncedSearch, setDebouncedSearch] = useState<string>("")
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sort mode
  const [sortMode, setSortMode] = useState<string>("date-desc")
  // Rows per page
  const [rowsPerPage, setRowsPerPage] = useState<number>(10)
  const [loading, setLoading] = useState(true)
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false)
  const [outgoingDialogOpen, setOutgoingDialogOpen] = useState(false)
  const [returnDialogOpen, setReturnDialogOpen] = useState(false)
  const [scanDialogOpen, setScanDialogOpen] = useState(false)
  const [archivedDialogOpen, setArchivedDialogOpen] = useState(false)
  // Scanned item passed from ScanItemDialog to outgoing/add-item dialogs
  const [scannedItem, setScannedItem] = useState<InventoryItem | null>(null)
  // Barcode captured by USB scanner — passed into ScanItemDialog as initialBarcode
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null)
  // Track newly added item IDs for animation & auto-scroll
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set())
  const [activeCardFilter, setActiveCardFilter] = useState<string | null>(null)
  const inventoryTableRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { toast } = useToast()
  const previousItemsRef = useRef<Set<string>>(new Set())
  const scrollToItemIdRef = useRef<string | null>(null)
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialize filters from query param
  useEffect(() => {
    const initialFilter = searchParams.get("filter")
    if (initialFilter) {
      if (initialFilter === "low-stock" || initialFilter === "out-of-stock") {
        setStockStatusFilter(initialFilter)
      } else if (initialFilter === "expiring" || initialFilter === "expiring-soon") {
        setExpirationFilter("expiring-soon")
      }
    }
    
    // Check for product filter in URL
    const productParam = searchParams.get("product")
    if (productParam) {
      setSelectedProductFilter(productParam)
    } else {
      setSelectedProductFilter(null)
    }
  }, [searchParams])

  const handleNavigateToItem = useCallback((barcode: string) => {
    const el = document.getElementById(`inventory-${barcode}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      el.classList.add("highlight-row")
      setTimeout(() => {
        el.classList.remove("highlight-row")
      }, 2000)
    }
  }, [])

  // Listen for barcode in URL
  useEffect(() => {
    const barcodeToHighlight = searchParams.get("barcode")
    if (barcodeToHighlight && !loading) {
      // Small delay to ensure table is rendered
      const timer = setTimeout(() => {
        handleNavigateToItem(barcodeToHighlight)
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [searchParams, loading, handleNavigateToItem])

  // Clear query param whenever a filter is removed manually
  const clearQueryParam = useCallback(() => {
    if (searchParams.toString()) {
      router.replace(window.location.pathname, { scroll: false })
    }
  }, [router, searchParams])

  // ── Global USB barcode scanner listener ────────────────────────────────
  // Disabled when any dialog is already open so it doesn't interfere with
  // barcode input fields inside dialogs.
  const anyDialogOpen = scanDialogOpen || addItemDialogOpen || outgoingDialogOpen || returnDialogOpen

  useBarcodeScanner({
    onScan: useCallback((barcode: string) => {
      console.log("[Global Scanner] Barcode detected:", barcode)
      setPendingBarcode(barcode)
      setScanDialogOpen(true)
    }, []),
    minLength: 5,
    maxKeystrokeDelay: 80,
    bufferTimeout: 400,
    enabled: !anyDialogOpen && canEditInventory,
  })

  // When Category changes, reset Type
  const handleCategoryChange = useCallback((value: string) => {
    setSelectedCategory(value)
    setSelectedType("all")
  }, [])

  // Real-time debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(value)
    }, 300)
  }, [])

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [])

  // Reset all filters
  const resetAllFilters = useCallback(() => {
    setSelectedCategory("all")
    setSelectedType("all")
    setRecentlyAddedFilter("all")
    setStockStatusFilter("all")
    setExpirationFilter("all")
    setSearchQuery("")
    setDebouncedSearch("")
    setSortMode("date-desc")
    setSelectedProductFilter(null)
    setActiveCardFilter(null)
    clearQueryParam()
  }, [clearQueryParam])

  // Smooth scroll to inventory table with highlight flash
  const scrollToInventoryTable = useCallback(() => {
    setTimeout(() => {
      inventoryTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Brief highlight flash on the table card
      setTimeout(() => {
        const el = inventoryTableRef.current
        if (el) {
          el.style.transition = 'box-shadow 0.4s ease'
          el.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.35), 0 4px 24px rgba(59,130,246,0.13)'
          setTimeout(() => {
            el.style.boxShadow = ''
          }, 1200)
        }
      }, 600)
    }, 100)
  }, [])

  // Card click handler — applies filter + scrolls to table
  const handleCardClick = useCallback((cardType: string) => {
    // Reset base filters
    setSelectedCategory("all")
    setSelectedType("all")
    setSearchQuery("")
    setDebouncedSearch("")
    setSelectedProductFilter(null)
    setStockStatusFilter("all")
    setExpirationFilter("all")
    setRecentlyAddedFilter("all")
    clearQueryParam()

    setActiveCardFilter(cardType === "total-items" ? null : cardType)
    
    // Smooth scroll to table section
    setTimeout(() => {
      document.getElementById("inventory-table-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      })
    }, 100)
  }, [clearQueryParam])

  // Filter label for active card
  const getFilterLabel = useCallback((filter: string) => {
    switch (filter) {
      case "total-items": return "All Inventory Items"
      case "low-stock": return "Low Stock Items (< 50 kg)"
      case "expiring-soon": return "Expiring Soon Items"
      case "today-transactions": return "Today's Transactions"
      case "returns-summary": return "Today's Returns"
      default: return "Filtered View"
    }
  }, [])

  // Check if any filter is active
  const hasActiveFilters = selectedCategory !== "all" || selectedType !== "all" || recentlyAddedFilter !== "all" || stockStatusFilter !== "all" || expirationFilter !== "all" || debouncedSearch !== "" || selectedProductFilter !== null

  // Available types based on selected category
  const availableTypes = useMemo(() => {
    if (selectedCategory === "all") {
      // Show all base types when no category is selected
      return [...TYPES] as string[]
    }
    return getTypesForCategory(selectedCategory)
  }, [selectedCategory])

  useEffect(() => {
    console.log("[Inventory Dashboard] Subscribing to inventory items...")
    console.log("[Inventory Dashboard] Using LIVE Firebase (not mock-firestore)")

    // Subscribe to real-time inventory updates from Firebase
    const unsubscribeItems = InventoryService.subscribeToItems(
      (updatedItems) => {
        console.log("[Inventory Dashboard] Received items from Firebase:", updatedItems.length)
        console.log("[Inventory Dashboard] Sample item (first):", updatedItems[0])

        if (updatedItems.length === 0) {
          console.warn("[Inventory Dashboard] No items received! Check Firebase connection and permissions.")
          setItems([])
          setLoading(false)
          return
        }

        // Normalize legacy field names so data from existing Firestore shows correctly
        const normalized = updatedItems.map((it: any) => {
          const incoming = it.incoming_weight ?? it.production_weight ?? 0
          const outgoing = it.outgoing_weight ?? 0
          const weightLeft = it.stock_left_weight ?? (incoming - outgoing + (it.good_return_weight ?? 0) - (it.damage_return_weight ?? 0))
          const goodReturnWeight = it.good_return_weight ?? 0
          const damageReturnWeight = it.damage_return_weight ?? 0
          // Extract expiryDate - prefer expiryDate over expirationDate, preserve original Firestore Timestamp object
          const expiry = it.expiryDate ?? it.expirationDate ?? null
          // Parse createdAt - handle both Date objects and Firestore Timestamps
          const createdAt = it.createdAt
            ? (it.createdAt instanceof Date ? it.createdAt : it.createdAt.toDate ? it.createdAt.toDate() : new Date(it.createdAt))
            : new Date()

          // Preserve all Firebase fields including name, stability, qualityStatus, etc.
          return {
            ...it, // Preserve ALL original fields from Firebase
            incoming,
            outgoing,
            stock: weightLeft,
            ongoingStock: weightLeft, // Keep ongoingStock for display
            goodReturnStock: goodReturnWeight,
            damageReturnStock: damageReturnWeight,
            // Ensure expiryDate is always set (even if null) for consistent access
            expirationDate: expiry,
            expiryDate: expiry ?? it.expiryDate, // Prefer normalized value, fallback to original
            name: it.name ?? it.itemName ?? "", // Support various name field names
            stability: it.stability ?? "", // Include stability field
            qualityStatus: it.qualityStatus ?? it.quality ?? "GOOD", // Include quality status
            updatedAt: it.updatedAt ?? it.lastUpdated ?? it.createdAt ?? new Date(), // Last updated timestamp
            createdAt, // Ensure createdAt is always a Date object
          }
        })

        // Sort by createdAt descending (newest first) — always maintain base order
        const sorted = normalized.sort((a: any, b: any) => {
          const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime()
          const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime()
          return bTime - aTime // Descending order (newest first)
        })

        // Detect new items (items that weren't in previousItemsRef)
        const currentItemIds = new Set(sorted.map((item: any) => item.id))
        const newItems = sorted.filter((item: any) => !previousItemsRef.current.has(item.id))

        // Initialize previousItemsRef on first load (to avoid showing toast for existing items)
        const isFirstLoad = previousItemsRef.current.size === 0

        // Mark new items for animation and trigger auto-scroll
        if (newItems.length > 0 && !isFirstLoad) {
          const ids = new Set(newItems.map((i: any) => i.id))

          // Clear any previous animation timer
          if (animationTimerRef.current) {
            clearTimeout(animationTimerRef.current)
          }

          setNewItemIds(ids)
          // Auto-scroll to the newest item
          scrollToItemIdRef.current = newItems[0].id

          // Clear animation highlight after 4.5 s
          animationTimerRef.current = setTimeout(() => {
            setNewItemIds(new Set())
          }, 4500)

          // Show toast notification for newly added items
          const newestItem = newItems[0] // Already sorted by createdAt descending
          const itemName = newestItem.name || newestItem.category || "New item"

          toast({
            title: "✅ Item successfully added",
            description: `${itemName} has been added to inventory.`,
            action: (
              <ToastAction
                altText="View Item"
                onClick={() => {
                  // Set scroll target
                  scrollToItemIdRef.current = newestItem.id

                  // Check if we're already on inventory page
                  if (typeof window !== "undefined" && window.location.pathname === "/inventory") {
                    // Already on inventory page, trigger scroll immediately
                    setTimeout(() => {
                      const rowElement = document.getElementById(`inventory-item-${newestItem.id}`)
                      if (rowElement) {
                        rowElement.scrollIntoView({ behavior: "smooth", block: "center" })
                        scrollToItemIdRef.current = null
                      }
                    }, 300)
                  } else {
                    // Navigate to inventory page - scroll will happen via scrollToItemId prop
                    router.push("/inventory")
                  }
                }}
              >
                View Item
              </ToastAction>
            ),
          })
        }

        // Update previous items ref
        previousItemsRef.current = currentItemIds

        console.log("[Inventory Dashboard] Normalized items count:", sorted.length)
        console.log("[Inventory Dashboard] Sample normalized item:", sorted[0])
        setItems(sorted as InventoryItem[])
        setLoading(false)
      },
      (error) => {
        console.error("[Inventory Dashboard] Error subscribing to items:", error)
        setLoading(false)
        // Don't clear items on error, keep existing data
      }
    )

    // Load categories (for filtering only)
    const loadCategories = async () => {
      try {
        const categoriesData = await CategoryService.getCategories()
        setCategories(categoriesData)
      } catch (error) {
        console.error("Error loading categories:", error)
      }
    }

    loadCategories()

    // Subscribe to transactions collection for the table
    const unsubscribeTransactions = TransactionService.subscribeToTransactions(
      (txns) => {
        console.log("[Inventory Dashboard] Received transactions from Firebase:", txns.length)
        // Normalize created_at to Date objects for sorting
        const normalized = txns.map((t: any) => ({
          ...t,
          created_at: t.created_at instanceof Date ? t.created_at
            : t.created_at?.toDate ? t.created_at.toDate()
              : new Date(t.created_at || 0),
          transaction_date: t.transaction_date instanceof Date ? t.transaction_date
            : t.transaction_date?.toDate ? t.transaction_date.toDate()
              : t.transaction_date ? new Date(t.transaction_date) : new Date(),
        }))
        // Sort by created_at descending (newest first)
        normalized.sort((a: any, b: any) => {
          const aTime = a.created_at instanceof Date ? a.created_at.getTime() : 0
          const bTime = b.created_at instanceof Date ? b.created_at.getTime() : 0
          return bTime - aTime
        })

        // IMPORTANT: Pass ALL transactions to the table — do NOT dedup by barcode.
        // The inventory-table groups transactions by barcode and needs ALL records
        // (incoming, outgoing, return) to compute correct totals and Movement Origin.
        setTransactions(normalized as InventoryTransaction[])
      },
      (error) => {
        console.error("[Inventory Dashboard] Error subscribing to transactions:", error)
      }
    )

    return () => {
      unsubscribeItems()
      unsubscribeTransactions()
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current)
    }
  }, [router, toast])

  // Filter items by category, type, search query, stock status, expiration, and recently added
  const filteredItems = useMemo(() => {
    const recentlyCutoff = getRecentlyCutoff(recentlyAddedFilter)

    const filtered = items.filter((item) => {
      // --- Active Card Filters ---
      if (activeCardFilter) {
        const incomingWeight = (item as any).incoming_weight ?? (item as any).production_weight ?? 0;
        const outgoingWeight = (item as any).outgoing_weight ?? 0;
        const goodReturnWeight = (item as any).good_return_weight ?? 0;
        const damageReturnWeight = (item as any).damage_return_weight ?? 0;
        const weightLeft = incomingWeight - outgoingWeight + goodReturnWeight - damageReturnWeight;

        if (activeCardFilter === "low-stock") {
          if (weightLeft <= 0 || weightLeft > 50) return false;
        } else if (activeCardFilter === "expiring-soon") {
          if (!item.expirationDate) return false;
          const expiryDate = new Date(item.expirationDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          expiryDate.setHours(0, 0, 0, 0);
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry > 30 || daysUntilExpiry < 0) return false;
        } else if (activeCardFilter === "returns-summary") {
          if (goodReturnWeight <= 0 && damageReturnWeight <= 0) return false;
        } else if (activeCardFilter === "today-transactions") {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date();
          todayEnd.setHours(23, 59, 59, 999);
          
          // Check if this item's barcode exists in today's transactions
          const hasTransactionToday = transactions.some(txn => {
            if (txn.barcode !== item.barcode) return false;
            const txDate = txn.transaction_date instanceof Date
              ? txn.transaction_date
              : (txn.transaction_date as any)?.toDate ? (txn.transaction_date as any).toDate()
                : new Date(txn.transaction_date || 0);
            if (isNaN(txDate.getTime()) || txDate < todayStart || txDate > todayEnd) return false;
            
            const incoming = txn.incoming_weight ?? txn.production_weight ?? 0;
            const outgoing = txn.outgoing_weight ?? 0;
            return incoming > 0 || outgoing > 0;
          });
          
          if (!hasTransactionToday) return false;
        }
      }

      // Category filter — match item.category against selected category
      if (selectedCategory !== "all") {
        const itemCategory = (item.category || "").trim()
        if (itemCategory.toLowerCase() !== selectedCategory.toLowerCase()) return false
      }

      // Type filter — match item.productType against selected type
      if (selectedType !== "all") {
        const itemType = ((item as any).productType || "").trim()
        if (itemType.toLowerCase() !== selectedType.toLowerCase()) return false
      }

      // Search filter - real-time debounced search by name, barcode
      if (debouncedSearch.trim()) {
        const query = debouncedSearch.toLowerCase().trim()
        const itemName = (item.name || "").toLowerCase()
        const itemBarcode = (item.barcode || "").toLowerCase()
        const itemProductName = ((item as any).productName || "").toLowerCase()
        const itemId = (item.id || "").toLowerCase()

        const matchesSearch =
          itemName.includes(query) ||
          itemBarcode.includes(query) ||
          itemProductName.includes(query) ||
          itemId.includes(query)

        if (!matchesSearch) return false
      }

      // Archive / Status filter
      const isArchived = Boolean((item as any).isArchived)
      if (stockStatusFilter === "archived") {
        if (!isArchived) return false
      } else {
        if (isArchived) return false // Hide archived items unless specifically requested
        
        if (stockStatusFilter !== "all") {
          const status = getItemStatus(item)
          if (stockStatusFilter === "in-stock" && status !== "in-stock") return false
          if (stockStatusFilter === "low-stock" && status !== "low-stock") return false
          if (stockStatusFilter === "out-of-stock" && status !== "out-of-stock") return false
        }
      }

      // Expiration filter
      if (expirationFilter !== "all") {
        const status = getItemStatus(item)
        if (expirationFilter === "expiring-soon" && status !== "expiring-soon") return false
        if (expirationFilter === "expired" && status !== "expired") return false
      }

      // Recently Added filter
      if (recentlyCutoff) {
        let createdAt: Date
        if (item.createdAt instanceof Date) {
          createdAt = item.createdAt
        } else if ((item.createdAt as any)?.toDate) {
          createdAt = (item.createdAt as any).toDate()
        } else {
          createdAt = new Date(item.createdAt as any)
        }
        if (isNaN(createdAt.getTime())) return false
        if (createdAt < recentlyCutoff) return false
      }

      // Product Name filter (from notification click)
      if (selectedProductFilter) {
        const itemProductName = (item.name || item.productName || item.category || "").toLowerCase()
        const filterName = selectedProductFilter.toLowerCase()
        
        // Match either the full product name or the category-subcategory combination
        const categorySubcategory = item.subcategory 
          ? `${item.category} - ${item.subcategory}`.toLowerCase()
          : item.category.toLowerCase()
          
        if (!itemProductName.includes(filterName) && !categorySubcategory.includes(filterName)) {
          return false
        }
      }

      return true
    })

    return filtered // Sorting is now handled by sortMode
  }, [items, selectedCategory, selectedType, debouncedSearch, stockStatusFilter, expirationFilter, recentlyAddedFilter, selectedProductFilter, activeCardFilter, transactions])

  // Filter transactions for the table display (one row per transaction)
  const filteredTransactions = useMemo(() => {
    // Determine the barcodes of items that passed the item-level filters
    // This correctly propagates the active card filter (e.g. Low Stock, Out of Stock) to the table
    const validBarcodes = new Set(filteredItems.map(i => i.barcode).filter(Boolean));

    const recentlyCutoff = getRecentlyCutoff(recentlyAddedFilter)

    const filtered = transactions.filter((txn) => {
      // Synchronize transactions with filtered items
      if (txn.barcode && !validBarcodes.has(txn.barcode)) return false;

      // Ensure that if "today-transactions" is active, we ONLY show transactions from today
      if (activeCardFilter === "today-transactions") {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        const txDate = txn.transaction_date instanceof Date
          ? txn.transaction_date
          : (txn.transaction_date as any)?.toDate ? (txn.transaction_date as any).toDate()
            : new Date(txn.transaction_date || 0);
        if (isNaN(txDate.getTime()) || txDate < todayStart || txDate > todayEnd) return false;
      }

      // Category filter
      if (selectedCategory !== "all") {
        if ((txn.category || "").trim().toLowerCase() !== selectedCategory.toLowerCase()) return false
      }
      // Type filter
      if (selectedType !== "all") {
        if ((txn.type || "").trim().toLowerCase() !== selectedType.toLowerCase()) return false
      }
      // Search filter (real-time debounced)
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim()
        const matches =
          (txn.product_name || "").toLowerCase().includes(q) ||
          (txn.barcode || "").toLowerCase().includes(q) ||
          (txn.reference_no || "").toLowerCase().includes(q)
        if (!matches) return false
      }
      
      // Archive filter
      // Get the inventory item by barcode to check if it's archived
      const inventoryItem = items.find(i => i.barcode === txn.barcode)
      const isArchived = Boolean(inventoryItem && (inventoryItem as any).isArchived)
      
      if (stockStatusFilter === "archived") {
        if (!isArchived) return false
      } else {
        if (isArchived) return false
      }

      // Recently Added filter
      if (recentlyCutoff) {
        const createdAt = txn.created_at instanceof Date ? txn.created_at : new Date(txn.created_at || 0)
        if (isNaN(createdAt.getTime()) || createdAt < recentlyCutoff) return false
      }
      return true
    })

    return filtered // Sorting handled by sortMode in the table
  }, [transactions, filteredItems, selectedCategory, selectedType, debouncedSearch, recentlyAddedFilter, stockStatusFilter])

  console.log("[Inventory Dashboard] Total items:", items.length, "Filtered items:", filteredItems.length, "Category:", selectedCategory, "Type:", selectedType, "Search:", debouncedSearch)

  const totalStockWeight = items.reduce((sum, item) => {
    const incomingWeight = (item as any).incoming_weight ?? (item as any).production_weight ?? 0
    const outgoingWeight = (item as any).outgoing_weight ?? 0
    const goodReturnWeight = (item as any).good_return_weight ?? 0
    const damageReturnWeight = (item as any).damage_return_weight ?? 0
    const weightLeft = incomingWeight - outgoingWeight + goodReturnWeight - damageReturnWeight
    return sum + Math.max(0, Number.isFinite(weightLeft) ? weightLeft : 0)
  }, 0)
  console.log("TOTAL KG:", totalStockWeight)

  const totalItems = items.length
  // totalStockWeight is calculated above and used for the main KPI display

  // Filter low stock items count
  const lowStockItems = items.filter((item) => {
    const isArchived = Boolean((item as any).isArchived)
    if (isArchived) return false
    const incomingWeight = (item as any).incoming_weight ?? (item as any).production_weight ?? 0
    const outgoingWeight = (item as any).outgoing_weight ?? 0
    const goodReturnWeight = (item as any).good_return_weight ?? 0
    const damageReturnWeight = (item as any).damage_return_weight ?? 0
    const weightLeft = incomingWeight - outgoingWeight + goodReturnWeight - damageReturnWeight
    return weightLeft > 0 && weightLeft <= 50 // Below or equal 50kg threshold
  }).length

  const nearExpiryItems = filteredItems.filter((item) => {
    if (!item.expirationDate) return false
    
    const incomingWeight = (item as any).incoming_weight ?? (item as any).production_weight ?? 0
    const outgoingWeight = (item as any).outgoing_weight ?? 0
    const goodReturnWeight = (item as any).good_return_weight ?? 0
    const damageReturnWeight = (item as any).damage_return_weight ?? 0
    const weightLeft = incomingWeight - outgoingWeight + goodReturnWeight - damageReturnWeight
    
    if (weightLeft <= 0) return false // No weight left, no need to alert for expiry

    const expiryDate = new Date(item.expirationDate)
    const today = new Date()
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 7 && daysUntilExpiry >= 0
  }).length

  // Count out-of-stock items is removed

  // Count expiring-soon items (within 30 days, for card display)
  const expiringSoonItems = items.filter((item) => {
    const isArchived = Boolean((item as any).isArchived)
    if (isArchived) return false
    if (!item.expirationDate) return false
    const incomingWeight = (item as any).incoming_weight ?? (item as any).production_weight ?? 0
    const outgoingWeight = (item as any).outgoing_weight ?? 0
    const goodReturnWeight = (item as any).good_return_weight ?? 0
    const damageReturnWeight = (item as any).damage_return_weight ?? 0
    const weightLeft = incomingWeight - outgoingWeight + goodReturnWeight - damageReturnWeight
    if (weightLeft <= 0) return false
    const expiryDate = new Date(item.expirationDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    expiryDate.setHours(0, 0, 0, 0)
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0
  }).length

  // Compute today's returns from transactions
  const todayReturns = useMemo(() => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    let goodReturns = 0
    let damagedReturns = 0
    transactions.forEach((txn) => {
      const txDate = txn.transaction_date instanceof Date
        ? txn.transaction_date
        : txn.transaction_date?.toDate ? txn.transaction_date.toDate()
          : new Date(txn.transaction_date || 0)
      if (isNaN(txDate.getTime()) || txDate < todayStart) return
      goodReturns += (txn.good_return_weight ?? 0)
      damagedReturns += (txn.damage_return_weight ?? 0)
    })
    return { good: goodReturns, damaged: damagedReturns, total: goodReturns + damagedReturns }
  }, [transactions])

  // Compute today's transactions (incoming, outgoing, and returns)
  const todayTransactions = useMemo(() => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    let incoming = 0
    let outgoing = 0
    let returns = 0
    transactions.forEach((txn) => {
      const txDate = txn.transaction_date instanceof Date
        ? txn.transaction_date
        : txn.transaction_date?.toDate ? txn.transaction_date.toDate()
          : new Date(txn.transaction_date || 0)
      if (isNaN(txDate.getTime()) || txDate < todayStart) return
      incoming += (txn.incoming_weight ?? txn.production_weight ?? 0)
      outgoing += (txn.outgoing_weight ?? 0)
      returns += (txn.good_return_weight ?? 0) + (txn.damage_return_weight ?? 0)
    })
    return { incoming, outgoing, returns, total: incoming + outgoing + returns }
  }, [transactions])

  // Compute Low Stock Alert (aggregated per product)
  const lowStockAlertList = useMemo(() => {
    const productAggregation = new Map<string, { name: string; weight: number; barcode: string; createdAt: any }>()

    filteredItems.forEach((item: any) => {
      const incomingWeight = item.incoming_weight ?? item.production_weight ?? 0
      const outgoingWeight = item.outgoing_weight ?? 0
      const goodReturnWeight = item.good_return_weight ?? 0
      const damageReturnWeight = item.damage_return_weight ?? 0
      const weightLeft = incomingWeight - outgoingWeight + goodReturnWeight - damageReturnWeight

      const name = item.subcategory 
        ? `${item.category} - ${item.subcategory}`
        : item.category || "Unknown Product"

      const existing = productAggregation.get(name) || { name, weight: 0, barcode: item.barcode, createdAt: item.createdAt }
      existing.weight += weightLeft
      
      // Keep oldest batch's barcode for reference (FIFO)
      const itemDate = item.createdAt instanceof Date ? item.createdAt : (item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt || 0))
      const existingDate = existing.createdAt instanceof Date ? existing.createdAt : (existing.createdAt?.toDate ? existing.createdAt.toDate() : new Date(existing.createdAt || 0))
      
      if (itemDate < existingDate) {
        existing.barcode = item.barcode
        existing.createdAt = item.createdAt
      }

      productAggregation.set(name, existing)
    })

    return Array.from(productAggregation.values())
      .filter(p => p.weight > 0 && p.weight <= 50)
      .sort((a, b) => a.weight - b.weight)
      .slice(0, 3)
  }, [filteredItems])

  // Calculate weekly changes using correct stock formula
  const totalStockWeeklyChange = useMemo(() => {
    return calculateWeeklyChange({
      items: filteredItems,
      getValue: (item) => {
        const incomingWeight = (item as any).incoming_weight ?? (item as any).production_weight ?? 0
        const outgoingWeight = (item as any).outgoing_weight ?? 0
        const goodReturnWeight = (item as any).good_return_weight ?? 0
        const damageReturnWeight = (item as any).damage_return_weight ?? 0
        return incomingWeight - outgoingWeight + goodReturnWeight - damageReturnWeight
      },
      getDate: (item) => parseFirestoreDate((item as any).updatedAt || (item as any).createdAt),
    })
  }, [filteredItems])

  const lowStockWeeklyChange = useMemo(() => {
    return calculateWeeklyCountChange({
      items: filteredItems,
      getDate: (item) => parseFirestoreDate((item as any).updatedAt || (item as any).createdAt),
      currentWeekCount: lowStockItems,
      filter: (item) => {
        const incomingWeight = (item as any).incoming_weight ?? (item as any).production_weight ?? 0
        const outgoingWeight = (item as any).outgoing_weight ?? 0
        const goodReturnWeight = (item as any).good_return_weight ?? 0
        const damageReturnWeight = (item as any).damage_return_weight ?? 0
        const weightLeft = incomingWeight - outgoingWeight + goodReturnWeight - damageReturnWeight
        return weightLeft > 0 && weightLeft < 50
      },
    })
  }, [filteredItems, lowStockItems])

  // Build active filter tags
  const activeFilterTags = useMemo(() => {
    const tags: { key: string; label: string; onRemove: () => void }[] = []
    if (selectedCategory !== "all") {
      tags.push({ key: "category", label: selectedCategory, onRemove: () => { setSelectedCategory("all"); setSelectedType("all") } })
    }
    if (selectedType !== "all") {
      tags.push({ key: "type", label: selectedType, onRemove: () => setSelectedType("all") })
    }
    if (stockStatusFilter !== "all") {
      const label = STOCK_STATUS_OPTIONS.find(o => o.value === stockStatusFilter)?.label || stockStatusFilter
      tags.push({ key: "stock", label, onRemove: () => { setStockStatusFilter("all"); clearQueryParam(); } })
    }
    if (expirationFilter !== "all") {
      const label = EXPIRATION_OPTIONS.find(o => o.value === expirationFilter)?.label || expirationFilter
      tags.push({ key: "expiry", label, onRemove: () => { setExpirationFilter("all"); clearQueryParam(); } })
    }
    if (recentlyAddedFilter !== "all") {
      const label = RECENTLY_ADDED_OPTIONS.find(o => o.value === recentlyAddedFilter)?.label || recentlyAddedFilter
      tags.push({ key: "recent", label, onRemove: () => setRecentlyAddedFilter("all") })
    }
    if (debouncedSearch) {
      tags.push({ key: "search", label: `"${debouncedSearch}"`, onRemove: () => { setSearchQuery(""); setDebouncedSearch("") } })
    }
    if (selectedProductFilter) {
      tags.push({ 
        key: "product", 
        label: `Product: ${selectedProductFilter}`, 
        onRemove: () => {
          setSelectedProductFilter(null)
          // Also clear from URL
          const params = new URLSearchParams(window.location.search)
          params.delete("product")
          router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        } 
      })
    }
    return tags
  }, [selectedCategory, selectedType, stockStatusFilter, expirationFilter, recentlyAddedFilter, debouncedSearch, selectedProductFilter, clearQueryParam, router, pathname])

  if (loading) {
    return <InventoryDashboardSkeleton />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pb-8">
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-balance">
              {isArchiveView ? "Archived Inventory" : "Inventory Monitoring"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {isArchiveView 
                ? "View and restore archived items" 
                : "Monitor stock movement, expiration, and barcode management"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
            {canEditInventory && !isArchiveView && (
              <>
                <Button onClick={() => setAddItemDialogOpen(true)} className="gap-1 sm:gap-2 h-9 sm:h-10 text-[11px] sm:text-sm px-2 sm:px-4 rounded-lg">
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span className="truncate">Add Item</span>
                </Button>
                <Button
                  onClick={() => setScanDialogOpen(true)}
                  className="gap-1 sm:gap-2 h-9 sm:h-10 text-[11px] sm:text-sm px-2 sm:px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-lg"
                >
                  <ScanLine className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span className="truncate">Scan</span>
                </Button>
                <Button
                  onClick={() => setReturnDialogOpen(true)}
                  className="gap-1 sm:gap-2 h-9 sm:h-10 text-[11px] sm:text-sm px-2 sm:px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-lg"
                >
                  <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span className="truncate">Return</span>
                </Button>
              </>
            )}

            {isArchiveView ? (
              <Button variant="outline" className="h-9 sm:h-10 text-[11px] sm:text-sm px-2 sm:px-4 rounded-lg" onClick={() => window.history.back()}>
                Back to Inventory
              </Button>
            ) : (
              <Button 
                variant="outline" 
                className="h-9 sm:h-10 text-[11px] sm:text-sm px-2 sm:px-4 rounded-lg gap-2" 
                onClick={() => setArchivedDialogOpen(true)}
              >
                <Archive className="h-4 w-4" />
                View Archives
              </Button>
            )}

            {isReadOnly && (
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-blue-200/60 dark:border-blue-800/40 bg-blue-50/80 dark:bg-blue-950/20 shrink-0">
                <svg className="h-4 w-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                <span className="text-[11px] sm:text-xs font-semibold text-blue-700 dark:text-blue-300">View Only Access</span>
              </div>
            )}
          </div>
        </div>

        {!isArchiveView && (
        <div className="grid gap-2.5 sm:gap-4 md:gap-5 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {/* ── 1. Today's Transactions ── */}
          <Card
            className={`group/card shadow-sm transition-all duration-300 rounded-xl bg-white dark:bg-card ${
              todayTransactions.total > 0
                ? "cursor-pointer hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] " +
                  (activeCardFilter === "today-transactions"
                    ? "ring-2 ring-indigo-500 dark:ring-indigo-400 ring-offset-2 dark:ring-offset-gray-900 shadow-indigo-100 dark:shadow-indigo-900/20 bg-indigo-50/50 dark:bg-indigo-900/10"
                    : "hover:shadow-md hover:-translate-y-0.5")
                : "cursor-default"
            }`}
            onClick={() => { if (todayTransactions.total > 0) handleCardClick("today-transactions") }}
            title="Click to view today's inventory movements"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-[11px] sm:text-sm font-medium text-muted-foreground group-hover/card:text-indigo-600 dark:group-hover/card:text-indigo-400 transition-colors">Today&apos;s Transactions</CardTitle>
              <TodaysMovementIcon />
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              {todayTransactions.total === 0 ? (
                <>
                  <div className="text-2xl sm:text-3xl font-bold text-muted-foreground/40">0</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">No transactions today</p>
                </>
              ) : (
                <>
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight">{todayTransactions.total.toLocaleString()} kg</div>
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1.5 sm:mt-2">
                    <span className="inline-flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-1.5 py-0.5 rounded-md">↑ {todayTransactions.incoming.toLocaleString()} kg In</span>
                    <span className="inline-flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded-md">↓ {todayTransactions.outgoing.toLocaleString()} kg Out</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* ── 2. Total Items ── */}
          <Card
            className={`group/card shadow-sm transition-all duration-300 rounded-xl bg-white dark:bg-card ${
              totalItems > 0
                ? "cursor-pointer hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] " +
                  (activeCardFilter === "total-items"
                    ? "ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-2 dark:ring-offset-gray-900 shadow-blue-100 dark:shadow-blue-900/20 bg-blue-50/50 dark:bg-blue-900/10"
                    : "hover:shadow-md hover:-translate-y-0.5")
                : "cursor-default"
            }`}
            onClick={() => { if (totalItems > 0) handleCardClick("total-items") }}
            title="Click to view all inventory items"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-[11px] sm:text-sm font-medium text-muted-foreground group-hover/card:text-blue-600 dark:group-hover/card:text-blue-400 transition-colors">TOTAL ITEMS</CardTitle>
              <StockOverviewIcon />
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight">{totalItems} items</div>
              <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1.5 sm:mt-2">
                <span className="inline-flex items-center text-[10px] sm:text-xs text-muted-foreground bg-slate-50 dark:bg-slate-900/40 px-1 sm:px-1.5 py-0.5 rounded-md">{totalStockWeight.toLocaleString()} kg total</span>
              </div>
            </CardContent>
          </Card>

          {/* ── 3. Low Stock ── */}
          <Card
            className={`group/card shadow-sm transition-all duration-300 rounded-xl bg-white dark:bg-card ${
              lowStockItems > 0
                ? "cursor-pointer hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] " +
                  (activeCardFilter === "low-stock"
                    ? "ring-2 ring-orange-500 dark:ring-orange-400 ring-offset-2 dark:ring-offset-gray-900 shadow-orange-100 dark:shadow-orange-900/20 bg-orange-50/50 dark:bg-orange-900/10"
                    : "hover:shadow-md hover:-translate-y-0.5")
                : "cursor-default"
            }`}
            onClick={() => { if (lowStockItems > 0) handleCardClick("low-stock") }}
            title="Click to view low stock items"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-[11px] sm:text-sm font-medium text-orange-600 dark:text-orange-400 group-hover/card:text-orange-700 dark:group-hover/card:text-orange-300 transition-colors">Low Stock</CardTitle>
              <LowStockAlertIcon />
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              {lowStockItems === 0 ? (
                <>
                  <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">✔</div>
                  <p className="text-[10px] sm:text-xs text-green-600 mt-1">All items stocked</p>
                </>
              ) : (
                <>
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight text-orange-600 dark:text-orange-400">{lowStockItems} items</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Below 50 kg threshold</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* ── 4. Expiring Soon ── */}
          <Card
            className={`group/card shadow-sm transition-all duration-300 rounded-xl bg-white dark:bg-card ${
              expiringSoonItems > 0
                ? "cursor-pointer hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] " +
                  (activeCardFilter === "expiring-soon"
                    ? "ring-2 ring-purple-500 dark:ring-purple-400 ring-offset-2 dark:ring-offset-gray-900 shadow-purple-100 dark:shadow-purple-900/20 bg-purple-50/50 dark:bg-purple-900/10"
                    : "hover:shadow-md hover:-translate-y-0.5")
                : "cursor-default"
            }`}
            onClick={() => { if (expiringSoonItems > 0) handleCardClick("expiring-soon") }}
            title="Click to view expiring items"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-[11px] sm:text-sm font-medium text-purple-600 dark:text-purple-400 group-hover/card:text-purple-700 dark:group-hover/card:text-purple-300 transition-colors">Expiring Soon</CardTitle>
              <ExpiryAlertIcon />
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              {expiringSoonItems === 0 ? (
                <>
                  <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">✔</div>
                  <p className="text-[10px] sm:text-xs text-green-600 mt-1">No items expiring</p>
                </>
              ) : (
                <>
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight text-purple-600 dark:text-purple-400">{expiringSoonItems} items</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Within 7 days</p>
                </>
              )}
            </CardContent>
          </Card>



          {/* ── 6. Returns Summary ── */}
          <Card
            className={`group/card shadow-sm transition-all duration-300 rounded-xl bg-white dark:bg-card ${
              todayReturns.total > 0
                ? "cursor-pointer hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] " +
                  (activeCardFilter === "returns-summary"
                    ? "ring-2 ring-teal-500 dark:ring-teal-400 ring-offset-2 dark:ring-offset-gray-900 shadow-teal-100 dark:shadow-teal-900/20 bg-teal-50/50 dark:bg-teal-900/10"
                    : "hover:shadow-md hover:-translate-y-0.5")
                : "cursor-default"
            }`}
            onClick={() => { if (todayReturns.total > 0) handleCardClick("returns-summary") }}
            title="Click to view today's return records"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-[11px] sm:text-sm font-medium text-muted-foreground group-hover/card:text-teal-600 dark:group-hover/card:text-teal-400 transition-colors">Returns Summary</CardTitle>
              <ReturnsSummaryIcon />
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              {todayReturns.total === 0 ? (
                <>
                  <div className="text-2xl sm:text-3xl font-bold text-muted-foreground/40">0</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">No returns today</p>
                </>
              ) : (
                <>
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight">{todayReturns.total.toLocaleString()} kg</div>
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1.5 sm:mt-2">
                    <span className="inline-flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-1.5 py-0.5 rounded-md">+{todayReturns.good.toLocaleString()} kg Good</span>
                    <span className="inline-flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded-md">+{todayReturns.damaged.toLocaleString()} kg Bad</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
        )}

        {/* Main Content - Inventory Section */}
        <Card ref={inventoryTableRef} className="shadow-sm rounded-xl bg-white dark:bg-card overflow-hidden transition-shadow duration-500" id="inventory-table-section">
          <CardHeader className="pb-0 px-0 pt-0">
            {/* ═══ Active Card Filter Banner ═══ */}
            {activeCardFilter && (
              <div className="flex items-center justify-between gap-3 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                    <Filter className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300">
                      Showing: {getFilterLabel(activeCardFilter)}
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-blue-500/70 dark:text-blue-400/60 ml-1">
                    ({filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'})
                  </span>
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); resetAllFilters(); }}
                    className="h-7 px-2.5 gap-1 rounded-md text-[11px] sm:text-xs font-medium text-blue-600 hover:text-red-600 hover:bg-red-50/80 dark:hover:bg-red-950/30 dark:text-blue-400 dark:hover:text-red-400 transition-all"
                  >
                    <X className="h-3 w-3" />
                    Clear Filter
                  </Button>
                </div>
              </div>
            )}
            {/* ═══ TOP HEADER ROW — Title + Search inline ═══ */}
            <div className="flex flex-row items-center justify-between gap-3 px-3 sm:px-4 md:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4">
              <div className="min-w-0 shrink-0">
                <CardTitle className="text-sm sm:text-base md:text-lg font-semibold tracking-tight">Inventory Items</CardTitle>
                <CardDescription className="mt-0.5 text-[10px] sm:text-xs">
                  <span className="font-medium text-foreground">{filteredItems.length}</span> of {totalItems} items
                  {hasActiveFilters && <span className="text-blue-600 dark:text-blue-400 ml-1">• Filtered</span>}
                </CardDescription>
              </div>
              {/* ── Compact search bar — right-aligned, constrained width ── */}
              <div className="relative flex-1 max-w-[320px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                <Input
                  type="text"
                  placeholder="Search products or barcodes…"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9 pr-9 h-9 rounded-lg border-gray-200/80 dark:border-border bg-gray-50/60 dark:bg-muted/30 hover:bg-white dark:hover:bg-muted/50 focus:bg-white focus:border-blue-300 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.08)] dark:focus:bg-card transition-all duration-200 text-xs sm:text-[13px] placeholder:text-muted-foreground/50"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
                    onClick={() => { setSearchQuery(""); setDebouncedSearch("") }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* ═══ UNIFIED FILTER TOOLBAR ═══ */}
            <div className="bg-gray-50/70 dark:bg-muted/20 border-y border-border/40 px-2.5 sm:px-4 md:px-5 py-2 sm:py-3">
              <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                {/* ── Filter icon label ── */}
                <div className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-0.5 sm:mr-1 select-none">
                  <Filter className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span className="hidden sm:inline">Filters</span>
                </div>

                {/* ── Divider ── */}
                <div className="w-px h-6 bg-border/60 mx-0.5" />

                {/* Category */}
                <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger className={`h-8 sm:h-[34px] w-auto min-w-0 sm:min-w-[130px] rounded-lg border text-[11px] sm:text-[13px] font-medium transition-all duration-200 focus:ring-2 focus:ring-blue-500/15 gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 ${selectedCategory !== "all"
                    ? "bg-blue-50 border-blue-200 text-blue-700 shadow-[inset_0_1px_0_rgba(59,130,246,0.08)] dark:bg-blue-950/40 dark:border-blue-700 dark:text-blue-300"
                    : "bg-white dark:bg-card border-gray-200/80 dark:border-border text-gray-600 dark:text-foreground hover:border-gray-300 hover:bg-gray-50/50"
                    }`}>
                    <Package className={`h-3 w-3 shrink-0 hidden sm:block ${selectedCategory !== "all" ? "text-blue-500" : "text-gray-400"}`} />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories ({totalItems})</SelectItem>
                    {CATEGORIES.map((cat) => {
                      const count = items.filter((item) => {
                        const itemCat = (item.category || "").trim()
                        return itemCat.toLowerCase() === cat.toLowerCase()
                      }).length
                      return (
                        <SelectItem key={cat} value={cat}>
                          {cat} ({count})
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>

                {/* Type */}
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className={`h-8 sm:h-[34px] w-auto min-w-0 sm:min-w-[110px] rounded-lg border text-[11px] sm:text-[13px] font-medium transition-all duration-200 focus:ring-2 focus:ring-blue-500/15 gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 ${selectedType !== "all"
                    ? "bg-amber-50 border-amber-200 text-amber-700 shadow-[inset_0_1px_0_rgba(245,158,11,0.08)] dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-300"
                    : "bg-white dark:bg-card border-gray-200/80 dark:border-border text-gray-600 dark:text-foreground hover:border-gray-300 hover:bg-gray-50/50"
                    }`}>
                    <Tag className={`h-3 w-3 shrink-0 hidden sm:block ${selectedType !== "all" ? "text-amber-500" : "text-gray-400"}`} />
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {availableTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Stock Status Filter - Hidden in archive view */}
                {!isArchiveView && (
                  <Select value={stockStatusFilter} onValueChange={setStockStatusFilter}>
                    <SelectTrigger className={`h-8 sm:h-[34px] w-auto min-w-0 sm:min-w-[120px] rounded-lg border text-[11px] sm:text-[13px] font-medium transition-all duration-200 focus:ring-2 focus:ring-blue-500/15 gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 ${stockStatusFilter !== "all"
                      ? "bg-sky-50 border-sky-200 text-sky-700 shadow-[inset_0_1px_0_rgba(14,165,233,0.08)] dark:bg-sky-950/40 dark:border-sky-700 dark:text-sky-300"
                      : "bg-white dark:bg-card border-gray-200/80 dark:border-border text-gray-600 dark:text-foreground hover:border-gray-300 hover:bg-gray-50/50"
                      }`}>
                      <Layers className={`h-3 w-3 shrink-0 hidden sm:block ${stockStatusFilter !== "all" ? "text-sky-500" : "text-gray-400"}`} />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STOCK_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-sm">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Expiration */}
                <Select value={expirationFilter} onValueChange={setExpirationFilter}>
                  <SelectTrigger className={`h-8 sm:h-[34px] w-auto min-w-0 sm:min-w-[110px] rounded-lg border text-[11px] sm:text-[13px] font-medium transition-all duration-200 focus:ring-2 focus:ring-blue-500/15 gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 ${expirationFilter !== "all"
                    ? "bg-rose-50 border-rose-200 text-rose-700 shadow-[inset_0_1px_0_rgba(244,63,94,0.08)] dark:bg-rose-950/40 dark:border-rose-700 dark:text-rose-300"
                    : "bg-white dark:bg-card border-gray-200/80 dark:border-border text-gray-600 dark:text-foreground hover:border-gray-300 hover:bg-gray-50/50"
                    }`}>
                    <CalendarClock className={`h-3 w-3 shrink-0 hidden sm:block ${expirationFilter !== "all" ? "text-rose-500" : "text-gray-400"}`} />
                    <SelectValue placeholder="Expiry" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRATION_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Date Added */}
                <Select value={recentlyAddedFilter} onValueChange={setRecentlyAddedFilter}>
                  <SelectTrigger className={`h-8 sm:h-[34px] w-auto min-w-0 sm:min-w-[110px] rounded-lg border text-[11px] sm:text-[13px] font-medium transition-all duration-200 focus:ring-2 focus:ring-blue-500/15 gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 ${recentlyAddedFilter !== "all"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-[inset_0_1px_0_rgba(16,185,129,0.08)] dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-300"
                    : "bg-white dark:bg-card border-gray-200/80 dark:border-border text-gray-600 dark:text-foreground hover:border-gray-300 hover:bg-gray-50/50"
                    }`}>
                    <Clock className={`h-3 w-3 shrink-0 hidden sm:block ${recentlyAddedFilter !== "all" ? "text-emerald-500" : "text-gray-400"}`} />
                    <SelectValue placeholder="Date" />
                  </SelectTrigger>
                  <SelectContent>
                    {RECENTLY_ADDED_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* ── Spacer + Divider ── */}
                <div className="hidden sm:block flex-1 min-w-[16px]" />
                <div className="basis-full sm:hidden" />
                <div className="w-px h-6 bg-border/60 mx-0.5 hidden sm:block" />

                {/* ── Sort + Rows inline ── */}
                <div className="flex items-center gap-1 sm:gap-1.5 w-full sm:w-auto">
                  <Select value={sortMode} onValueChange={setSortMode}>
                    <SelectTrigger className={`h-8 sm:h-[34px] w-auto flex-1 sm:flex-none sm:min-w-[140px] rounded-lg border text-[11px] sm:text-[13px] font-medium transition-all duration-200 focus:ring-2 focus:ring-blue-500/15 gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 ${sortMode !== "date-desc"
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-700 dark:text-indigo-300"
                      : "bg-white dark:bg-card border-gray-200/80 dark:border-border text-gray-600 dark:text-foreground hover:border-gray-300 hover:bg-gray-50/50"
                      }`}>
                      <ArrowDownUp className={`h-3 w-3 shrink-0 hidden sm:block ${sortMode !== "date-desc" ? "text-indigo-500" : "text-gray-400"}`} />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={String(rowsPerPage)} onValueChange={(v) => setRowsPerPage(Number(v))}>
                    <SelectTrigger className="h-8 sm:h-[34px] w-[60px] sm:w-[72px] rounded-lg border text-[11px] sm:text-[13px] font-medium bg-white dark:bg-card border-gray-200/80 dark:border-border text-gray-600 dark:text-foreground hover:border-gray-300 hover:bg-gray-50/50 transition-all duration-200 focus:ring-2 focus:ring-blue-500/15 px-1.5 sm:px-2.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 rows</SelectItem>
                      <SelectItem value="20">20 rows</SelectItem>
                      <SelectItem value="50">50 rows</SelectItem>
                      <SelectItem value="100">100 rows</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* ── Reset button ── */}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetAllFilters}
                    className="h-[34px] px-2.5 gap-1.5 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-red-600 hover:bg-red-50/80 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-all duration-200"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </Button>
                )}
              </div>

              {/* ── Active filter tags — below the toolbar ── */}
              {activeFilterTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2.5 border-t border-border/30">
                  <span className="text-[11px] text-muted-foreground/70 font-medium uppercase tracking-wider mr-0.5">Active:</span>
                  {activeFilterTags.map(tag => (
                    <span
                      key={tag.key}
                      className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50/80 text-blue-700 border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 transition-all duration-200 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                    >
                      {tag.label}
                      <button
                        onClick={tag.onRemove}
                        className="inline-flex items-center justify-center w-4 h-4 rounded hover:bg-blue-200/80 dark:hover:bg-blue-800 transition-colors ml-0.5"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                  <button
                    onClick={resetAllFilters}
                    className="text-[11px] font-medium text-muted-foreground/60 hover:text-red-500 transition-colors ml-1 underline decoration-dotted underline-offset-2"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-2 sm:px-4 md:px-6 pb-4 sm:pb-6 pt-0">
            <InventoryTable
              items={filteredItems}
              transactions={filteredTransactions}
              categories={categories}
              loading={loading}
              scrollToItemId={scrollToItemIdRef.current}
              newItemIds={newItemIds}
              onItemScrolled={() => {
                scrollToItemIdRef.current = null
              }}
              sortMode={sortMode}
              rowsPerPage={rowsPerPage}
              searchQuery={debouncedSearch}
              highlightFilter={searchParams.get("filter") || undefined}
              readOnly={!canEditInventory}
            />
          </CardContent>
        </Card>
      </div>

      {/* Add Item Dialog */}
      <AddItemDialog
        open={addItemDialogOpen}
        onOpenChange={(open) => {
          setAddItemDialogOpen(open)
          if (!open) setScannedItem(null)
        }}
        scannedItem={scannedItem}
      />

      {/* Scan Item Dialog */}
      <ScanItemDialog
        open={scanDialogOpen}
        onOpenChange={(open) => {
          setScanDialogOpen(open)
          // Clear pending barcode when dialog is closed manually
          if (!open) setPendingBarcode(null)
        }}
        inventoryItems={items}
        initialBarcode={pendingBarcode}
        onInitialBarcodeConsumed={() => setPendingBarcode(null)}
        onProductOut={(item) => {
          setScannedItem(item || null)
          setScanDialogOpen(false)
          setOutgoingDialogOpen(true)
        }}
        onReturnItem={(item) => {
          setScannedItem(item || null)
          setScanDialogOpen(false)
          setReturnDialogOpen(true)
        }}
        onRegisterNew={() => {
          setScannedItem(null)
          setScanDialogOpen(false)
          setAddItemDialogOpen(true)
        }}
      />

      {/* Outgoing Stock Dialog */}
      <OutgoingStockDialog
        open={outgoingDialogOpen}
        onOpenChange={(open) => {
          setOutgoingDialogOpen(open)
          if (!open) setScannedItem(null)
        }}
        inventoryItems={items}
        scannedItem={scannedItem}
      />

      {/* Return Item Dialog */}
      <ReturnItemDialog
        open={returnDialogOpen}
        onOpenChange={(open) => {
          setReturnDialogOpen(open)
          if (!open) setScannedItem(null)
        }}
        inventoryItems={items}
        scannedItem={scannedItem}
      />
      <ArchivedItemsDialog 
        open={archivedDialogOpen} 
        onOpenChange={setArchivedDialogOpen} 
      />
    </div>
  )
}