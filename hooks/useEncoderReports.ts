"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { getFirebaseDb } from "@/lib/firebase-live"
import { auth } from "@/lib/firebase-live"
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"

// ─── Types ──────────────────────────────────────────────────────────────────
export interface ReportTransaction {
  id: string
  product_name: string
  barcode: string
  barcode_base?: string
  category: string
  product_id?: string
  movement_type: string
  type: string
  outgoing_weight: number
  outgoing_qty: number
  incoming_weight: number
  incoming_qty: number
  stock_left: number
  customer_name?: string
  sales_invoice_no?: string
  delivery_receipt_no?: string
  reference_no?: string
  source: string
  orderId?: string
  inventoryId?: string
  transaction_date: any
  created_at: any
  // Computed fields for UI
  computedMovementType?: "IN" | "OUT"
  computedWeightKg?: number
  processedBy?: string
  dateAdded?: Date | null
  dateReleased?: Date | null
}

export interface ReportSummary {
  totalReleasedKg: number
  totalAddedKg: number
  totalTransactions: number
  totalProductsReleased: number
  remainingInventoryKg: number
  mostReleasedProduct: { name: string; weight: number } | null
  movementTodayKg: number
}

export interface ChartDataPoint {
  label: string
  value: number
}

export interface TopProductData {
  name: string
  weight: number
}

// ─── Utility: Parse Firestore timestamp to Date ────────────────────────────
function parseTimestamp(ts: any): Date | null {
  if (!ts) return null
  if (ts.toDate) return ts.toDate()
  if (ts.seconds) return new Date(ts.seconds * 1000)
  if (ts instanceof Date) return ts
  const d = new Date(ts)
  return isNaN(d.getTime()) ? null : d
}

// ─── Utility: Determine movement type for a transaction ────────────────────
function getMovementType(t: ReportTransaction): "IN" | "OUT" {
  const mt = (t.movement_type || "").toLowerCase()
  const type = (t.type || "").toUpperCase()
  const source = (t.source || "").toLowerCase()

  if (mt === "incoming" || type === "IN") return "IN"
  if (
    mt === "outgoing" ||
    type === "OUT" ||
    source === "encoder_verification" ||
    (t.outgoing_weight && t.outgoing_weight > 0)
  ) return "OUT"

  // If there's incoming weight but no outgoing, treat as IN
  if ((t.incoming_weight || 0) > 0 && (t.outgoing_weight || 0) === 0) return "IN"

  return "OUT"
}

// ─── Utility: Get weight for a transaction based on movement ───────────────
function getWeightKg(t: ReportTransaction, movementType: "IN" | "OUT"): number {
  if (movementType === "OUT") return t.outgoing_weight || 0
  return t.incoming_weight || t.outgoing_weight || 0
}

// ─── Utility: Detect meat category from product name ───────────────────────
export type MeatCategory = "all" | "chicken" | "pork" | "beef"

export const MEAT_CATEGORIES: { value: MeatCategory; label: string }[] = [
  { value: "all", label: "All Categories" },
  { value: "chicken", label: "Chicken" },
  { value: "pork", label: "Pork" },
  { value: "beef", label: "Beef" },
]

function detectMeatCategory(t: ReportTransaction): MeatCategory {
  const name = (t.product_name || "").toLowerCase()
  const cat = (t.category || "").toLowerCase()

  // Check product name first (most reliable for meat systems)
  if (name.includes("chicken") || cat.includes("chicken")) return "chicken"
  if (name.includes("pork") || cat.includes("pork")) return "pork"
  if (name.includes("beef") || cat.includes("beef")) return "beef"

  return "all" // uncategorized
}

// ─── Hook ──────────────────────────────────────────────────────────────────
export function useEncoderReports() {
  const [transactions, setTransactions] = useState<ReportTransaction[]>([])
  const [inventoryItems, setInventoryItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<MeatCategory>("all")
  const [sortField, setSortField] = useState<string>("transaction_date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // ── Quick filter helpers ───────────────────────────────────────────────
  const setToday = useCallback(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    setStartDate(start)
    setEndDate(end)
    setPage(1)
  }, [])

  const setThisWeek = useCallback(() => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const start = new Date(now)
    start.setDate(now.getDate() - dayOfWeek)
    start.setHours(0, 0, 0, 0)
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    setStartDate(start)
    setEndDate(end)
    setPage(1)
  }, [])

  const setThisMonth = useCallback(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    setStartDate(start)
    setEndDate(end)
    setPage(1)
  }, [])

  const resetFilters = useCallback(() => {
    setStartDate(null)
    setEndDate(null)
    setSearchTerm("")
    setCategoryFilter("all")
    setPage(1)
  }, [])

  // ── Firebase listeners ─────────────────────────────────────────────────
  useEffect(() => {
    let unsubTransactions: (() => void) | undefined
    let unsubInventory: (() => void) | undefined
    let unsubAuth: (() => void) | undefined

    try {
      const firebaseAuth = auth
      if (!firebaseAuth) {
        setLoading(false)
        return
      }

      unsubAuth = onAuthStateChanged(firebaseAuth, (user) => {
        if (unsubTransactions) { unsubTransactions(); unsubTransactions = undefined }
        if (unsubInventory) { unsubInventory(); unsubInventory = undefined }

        if (!user) {
          setTransactions([])
          setInventoryItems([])
          setLoading(false)
          return
        }

        const db = getFirebaseDb()
        if (!db) {
          setLoading(false)
          return
        }

        // Subscribe to transactions (encoder outgoing)
        const txnRef = collection(db, "transactions")
        const txnQuery = query(txnRef, orderBy("created_at", "desc"))

        let txnLoaded = false
        let invLoaded = false
        const checkDone = () => { if (txnLoaded && invLoaded) setLoading(false) }

        unsubTransactions = onSnapshot(
          txnQuery,
          (snapshot) => {
            const data: ReportTransaction[] = snapshot.docs.map((d) => {
              const dd = d.data()
              return { id: d.id, ...dd } as ReportTransaction
            })
            setTransactions(data)
            txnLoaded = true
            checkDone()
          },
          (error) => {
            // Fallback without orderBy if index missing
            if (error.code === "failed-precondition" || error?.message?.includes("index")) {
              const fallbackQuery = txnRef
              unsubTransactions = onSnapshot(fallbackQuery, (snap) => {
                const data: ReportTransaction[] = snap.docs.map((d) => {
                  const dd = d.data()
                  return { id: d.id, ...dd } as ReportTransaction
                })
                data.sort((a, b) => {
                  const ta = parseTimestamp(a.created_at)?.getTime() || 0
                  const tb = parseTimestamp(b.created_at)?.getTime() || 0
                  return tb - ta
                })
                setTransactions(data)
                txnLoaded = true
                checkDone()
              })
            } else {
              console.error("[useEncoderReports] Transaction snapshot error:", error)
              setTransactions([])
              txnLoaded = true
              checkDone()
            }
          }
        )

        // Subscribe to inventory (for remaining stock)
        const invRef = collection(db, "inventory")
        unsubInventory = onSnapshot(invRef, (snapshot) => {
          const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
          setInventoryItems(data)
          invLoaded = true
          checkDone()
        }, () => {
          setInventoryItems([])
          invLoaded = true
          checkDone()
        })
      })
    } catch (err) {
      console.error("[useEncoderReports] Init error:", err)
      setLoading(false)
    }

    return () => {
      unsubTransactions?.()
      unsubInventory?.()
      unsubAuth?.()
    }
  }, [])

  // ── Enriched transactions with computed movement type ─────────────────
  const enrichedTransactions = useMemo(() => {
    return transactions.map((t) => {
      const movementType = getMovementType(t)
      const weightKg = getWeightKg(t, movementType)
      const txnDate = parseTimestamp(t.transaction_date || t.created_at)

      return {
        ...t,
        computedMovementType: movementType,
        computedWeightKg: weightKg,
        processedBy: t.source || "encoder",
        dateAdded: movementType === "IN" ? txnDate : (parseTimestamp(t.created_at) || null),
        dateReleased: movementType === "OUT" ? txnDate : null,
      }
    })
  }, [transactions])

  // ── Outgoing-only transactions (encoder releases) — kept for backward compat
  const outgoingTransactions = useMemo(() => {
    return enrichedTransactions.filter((t) => t.computedMovementType === "OUT")
  }, [enrichedTransactions])

  // ── Date-filtered transactions ─────────────────────────────────────────
  const filteredByDate = useMemo(() => {
    const base = enrichedTransactions.filter(
      (t) => (t.computedWeightKg || 0) > 0
    )
    if (!startDate && !endDate) return base
    return base.filter((t) => {
      const txnDate = parseTimestamp(t.transaction_date || t.created_at)
      if (!txnDate) return false
      if (startDate && txnDate < startDate) return false
      if (endDate && txnDate > endDate) return false
      return true
    })
  }, [enrichedTransactions, startDate, endDate])

  // ── Category-filtered transactions ─────────────────────────────────────
  const filteredByCategory = useMemo(() => {
    if (categoryFilter === "all") return filteredByDate
    return filteredByDate.filter((t) => detectMeatCategory(t) === categoryFilter)
  }, [filteredByDate, categoryFilter])

  // ── Search + Sort ──────────────────────────────────────────────────────
  const searchedAndSorted = useMemo(() => {
    let items = [...filteredByCategory]

    // Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      items = items.filter((t) =>
        t.product_name?.toLowerCase().includes(term) ||
        t.barcode?.toLowerCase().includes(term) ||
        t.customer_name?.toLowerCase().includes(term) ||
        t.reference_no?.toLowerCase().includes(term) ||
        t.sales_invoice_no?.toLowerCase().includes(term) ||
        t.computedMovementType?.toLowerCase().includes(term)
      )
    }

    // Sort
    items.sort((a, b) => {
      let valA: any, valB: any
      switch (sortField) {
        case "product_name":
          valA = (a.product_name || "").toLowerCase()
          valB = (b.product_name || "").toLowerCase()
          return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA)
        case "outgoing_weight":
          valA = a.computedWeightKg || 0
          valB = b.computedWeightKg || 0
          return sortDir === "asc" ? valA - valB : valB - valA
        case "movement_type":
          valA = a.computedMovementType || "OUT"
          valB = b.computedMovementType || "OUT"
          return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA)
        case "transaction_date":
        default:
          valA = parseTimestamp(a.transaction_date || a.created_at)?.getTime() || 0
          valB = parseTimestamp(b.transaction_date || b.created_at)?.getTime() || 0
          return sortDir === "asc" ? valA - valB : valB - valA
      }
    })

    return items
  }, [filteredByCategory, searchTerm, sortField, sortDir])

  // ── Pagination ─────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(searchedAndSorted.length / pageSize))
  const paginationStart = searchedAndSorted.length === 0 ? 0 : (page - 1) * pageSize + 1
  const paginationEnd = Math.min(page * pageSize, searchedAndSorted.length)
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize
    return searchedAndSorted.slice(start, start + pageSize)
  }, [searchedAndSorted, page, pageSize])

  // ── Summary ────────────────────────────────────────────────────────────
  const summary: ReportSummary = useMemo(() => {
    const outItems = filteredByCategory.filter((t) => t.computedMovementType === "OUT")
    const inItems = filteredByCategory.filter((t) => t.computedMovementType === "IN")

    const totalReleasedKg = outItems.reduce((s, t) => s + (t.computedWeightKg || 0), 0)
    const totalAddedKg = inItems.reduce((s, t) => s + (t.computedWeightKg || 0), 0)
    const totalTransactions = filteredByCategory.length

    // Unique products by product_name or barcode_base
    const productSet = new Set<string>()
    outItems.forEach((t) => {
      productSet.add(t.product_name || t.barcode || "Unknown")
    })
    const totalProductsReleased = productSet.size

    // Remaining inventory — sum of (incoming - outgoing + good_return - damage_return)
    // When a category is selected, only count matching inventory items
    const filteredInventory = categoryFilter === "all"
      ? inventoryItems
      : inventoryItems.filter((inv) => {
          const name = (inv.product_name || inv.name || "").toLowerCase()
          const cat = (inv.category || "").toLowerCase()
          return name.includes(categoryFilter) || cat.includes(categoryFilter)
        })
    const remainingInventoryKg = filteredInventory.reduce((sum, inv) => {
      const incoming = inv.incoming_weight ?? inv.production_weight ?? inv.incoming ?? 0
      const outgoing = inv.outgoing_weight ?? inv.outgoing ?? 0
      const good = inv.good_return_weight ?? inv.goodReturnStock ?? 0
      const bad = inv.damage_return_weight ?? inv.damageReturnStock ?? 0
      return sum + Math.max(0, incoming - outgoing + good - bad)
    }, 0)

    // Most released product
    const productWeightMap: Record<string, number> = {}
    outItems.forEach((t) => {
      const name = t.product_name || "Unknown"
      productWeightMap[name] = (productWeightMap[name] || 0) + (t.computedWeightKg || 0)
    })
    let mostReleasedProduct: { name: string; weight: number } | null = null
    Object.entries(productWeightMap).forEach(([name, weight]) => {
      if (!mostReleasedProduct || weight > mostReleasedProduct.weight) {
        mostReleasedProduct = { name, weight }
      }
    })

    // Today's movement
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)
    const movementTodayKg = enrichedTransactions
      .filter((t) => {
        if (categoryFilter !== "all" && detectMeatCategory(t) !== categoryFilter) return false
        const dt = parseTimestamp(t.transaction_date || t.created_at)
        return dt && dt >= todayStart && dt <= todayEnd
      })
      .reduce((s, t) => s + (t.computedWeightKg || 0), 0)

    return {
      totalReleasedKg,
      totalAddedKg,
      totalTransactions,
      totalProductsReleased,
      remainingInventoryKg,
      mostReleasedProduct,
      movementTodayKg,
    }
  }, [filteredByCategory, inventoryItems, enrichedTransactions, categoryFilter])

  // ── Chart Data: Weekly Released KG ─────────────────────────────────────
  const weeklyChartData: ChartDataPoint[] = useMemo(() => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const buckets: Record<string, number> = {}
    dayNames.forEach((d) => (buckets[d] = 0))

    const outItems = filteredByCategory.filter((t) => t.computedMovementType === "OUT")
    outItems.forEach((t) => {
      const dt = parseTimestamp(t.transaction_date || t.created_at)
      if (dt) {
        const dayName = dayNames[dt.getDay()]
        buckets[dayName] += t.computedWeightKg || 0
      }
    })

    return dayNames.map((d) => ({ label: d, value: Math.round(buckets[d] * 100) / 100 }))
  }, [filteredByCategory])

  // ── Chart Data: Monthly Movement ───────────────────────────────────────
  const monthlyChartData: ChartDataPoint[] = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const buckets: Record<string, number> = {}
    monthNames.forEach((m) => (buckets[m] = 0))

    const outItems = enrichedTransactions.filter((t) => t.computedMovementType === "OUT")
    outItems.forEach((t) => {
      const dt = parseTimestamp(t.transaction_date || t.created_at)
      if (dt) {
        const monthName = monthNames[dt.getMonth()]
        buckets[monthName] += t.computedWeightKg || 0
      }
    })

    return monthNames.map((m) => ({ label: m, value: Math.round(buckets[m] * 100) / 100 }))
  }, [enrichedTransactions])

  // ── Chart Data: Top Released Products ──────────────────────────────────
  const topProductsData: TopProductData[] = useMemo(() => {
    const map: Record<string, number> = {}
    const outItems = filteredByCategory.filter((t) => t.computedMovementType === "OUT")
    outItems.forEach((t) => {
      const name = t.product_name || "Unknown"
      map[name] = (map[name] || 0) + (t.computedWeightKg || 0)
    })

    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, weight]) => ({ name, weight: Math.round(weight * 100) / 100 }))
  }, [filteredByCategory])

  // ── Toggle sort ────────────────────────────────────────────────────────
  const toggleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("desc")
    }
    setPage(1)
  }, [sortField])

  return {
    // Data
    loading,
    transactions: paginatedData,
    allFilteredTransactions: searchedAndSorted,
    summary,
    weeklyChartData,
    monthlyChartData,
    topProductsData,

    // Filters
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    setToday,
    setThisWeek,
    setThisMonth,
    resetFilters,

    // Sort
    sortField,
    sortDir,
    toggleSort,

    // Pagination
    page,
    setPage,
    totalPages,
    pageSize,
    setPageSize,
    totalResults: searchedAndSorted.length,
    paginationStart,
    paginationEnd,

    // Helpers
    parseTimestamp,
  }
}
