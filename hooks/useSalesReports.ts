"use client"

import { useState, useMemo, useCallback } from "react"
import { useOrders, type Order, type OrderItem } from "./useOrders"
import {
  normalizeSalesStatus,
  matchesSalesFilter,
  computeSalesKPIs,
  computeSalesStatusDistribution,
  type SalesStatusFilterKey,
} from "@/lib/sales-status-mapper"

// ─── Types ───────────────────────────────────────────────────────────────────
export type { SalesStatusFilterKey }
// Legacy alias — kept for backward compat with any imports that still use this name
export type SalesStatusFilter = SalesStatusFilterKey

export type ProductCategoryFilter = "all" | "chicken" | "pork" | "beef"
export type SortField = "orderId" | "customerName" | "totalKg" | "totalAmount" | "status" | "createdAt"
export type SortDir = "asc" | "desc"

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

// ─── Date helpers ────────────────────────────────────────────────────────────
export function parseTimestamp(ts: any): Date | null {
  if (!ts) return null
  if (ts instanceof Date) return ts
  if (typeof ts === "string") return new Date(ts)
  if (ts?.toDate) return ts.toDate()
  if (ts?.seconds) return new Date(ts.seconds * 1000)
  return null
}

function startOfDay(d: Date) {
  const n = new Date(d)
  n.setHours(0, 0, 0, 0)
  return n
}

function endOfDay(d: Date) {
  const n = new Date(d)
  n.setHours(23, 59, 59, 999)
  return n
}

function startOfWeek(d: Date) {
  const n = new Date(d)
  const day = n.getDay()
  n.setDate(n.getDate() - (day === 0 ? 6 : day - 1)) // Monday
  n.setHours(0, 0, 0, 0)
  return n
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

// ─── Detect product category from item name ─────────────────────────────────
function detectCategory(item: OrderItem): string {
  const name = (item.name || "").toLowerCase()
  if (name.includes("chicken")) return "chicken"
  if (name.includes("pork")) return "pork"
  if (name.includes("beef")) return "beef"
  return "other"
}

// ─── Main Hook ──────────────────────────────────────────────────────────────
export function useSalesReports() {
  const { orders, loading } = useOrders()

  // ─── Filter state ───
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<SalesStatusFilterKey>("all")
  const [categoryFilter, setCategoryFilter] = useState<ProductCategoryFilter>("all")
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)

  // ─── Sort state ───
  const [sortField, setSortField] = useState<SortField>("createdAt")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  // ─── Pagination state ───
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // ─── Quick filters ───
  const setToday = useCallback(() => {
    const now = new Date()
    setStartDate(startOfDay(now))
    setEndDate(endOfDay(now))
    setPage(1)
  }, [])

  const setThisWeek = useCallback(() => {
    const now = new Date()
    setStartDate(startOfWeek(now))
    setEndDate(endOfDay(now))
    setPage(1)
  }, [])

  const setThisMonth = useCallback(() => {
    const now = new Date()
    setStartDate(startOfMonth(now))
    setEndDate(endOfDay(now))
    setPage(1)
  }, [])

  const resetFilters = useCallback(() => {
    setSearchTerm("")
    setStatusFilter("all")
    setCategoryFilter("all")
    setStartDate(null)
    setEndDate(null)
    setPage(1)
  }, [])

  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"))
        return field
      }
      setSortDir("asc")
      return field
    })
    setPage(1)
  }, [])

  // ─── Filtered orders (before pagination) ───
  const allFilteredOrders = useMemo(() => {
    let result = [...orders]

    // Date range
    if (startDate) {
      result = result.filter((o) => {
        const d = parseTimestamp(o.createdAt)
        return d && d >= startDate
      })
    }
    if (endDate) {
      result = result.filter((o) => {
        const d = parseTimestamp(o.createdAt)
        return d && d <= endDate
      })
    }

    // Status filter — uses centralized matchesSalesFilter
    if (statusFilter !== "all") {
      result = result.filter((o) => matchesSalesFilter(o.status, statusFilter, (o as any).salesStatus))
    }

    // Category filter
    if (categoryFilter !== "all") {
      result = result.filter((o) => {
        if (!o.items || o.items.length === 0) return false
        return o.items.some((item) => detectCategory(item) === categoryFilter)
      })
    }

    // Search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      result = result.filter(
        (o) =>
          (o.customerName || "").toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q) ||
          (o.customerPhone || "").toLowerCase().includes(q) ||
          (o.items || []).some((item) => (item.name || "").toLowerCase().includes(q))
      )
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case "orderId":
          cmp = a.id.localeCompare(b.id)
          break
        case "customerName":
          cmp = (a.customerName || "").localeCompare(b.customerName || "")
          break
        case "totalKg":
          cmp = computeTotalKg(a) - computeTotalKg(b)
          break
        case "totalAmount":
          cmp = computeTotalAmount(a) - computeTotalAmount(b)
          break
        case "status":
          // Sort by sales display status, not raw status
          cmp = normalizeSalesStatus(a.status).localeCompare(normalizeSalesStatus(b.status))
          break
        case "createdAt": {
          const da = parseTimestamp(a.createdAt)?.getTime() || 0
          const db = parseTimestamp(b.createdAt)?.getTime() || 0
          cmp = da - db
          break
        }
      }
      return sortDir === "asc" ? cmp : -cmp
    })

    return result
  }, [orders, searchTerm, statusFilter, categoryFilter, startDate, endDate, sortField, sortDir])

  // ─── KPI Summary — uses centralized computeSalesKPIs ───
  const summary = useMemo(() => {
    const kpis = computeSalesKPIs(orders)

    const totalRevenue = orders.reduce((sum, o) => {
      if (normalizeSalesStatus((o as any).salesStatus || o.status) === "Cancelled") return sum
      return sum + computeTotalAmount(o)
    }, 0)

    // Top selling product by KG
    const productKgMap: Record<string, number> = {}
    orders.forEach((o) => {
      if (normalizeSalesStatus((o as any).salesStatus || o.status) === "Cancelled") return
      ;(o.items || []).forEach((item) => {
        const name = item.name || "Unknown"
        const kg = Number(item.quantity ?? 0)
        productKgMap[name] = (productKgMap[name] || 0) + kg
      })
    })
    const topProduct = Object.entries(productKgMap).sort((a, b) => b[1] - a[1])[0]

    // Revenue this week
    const weekStart = startOfWeek(new Date())
    const revenueThisWeek = orders.reduce((sum, o) => {
      if (normalizeSalesStatus((o as any).salesStatus || o.status) === "Cancelled") return sum
      const d = parseTimestamp(o.createdAt)
      if (d && d >= weekStart) return sum + computeTotalAmount(o)
      return sum
    }, 0)

    return {
      totalRevenue,
      totalOrders: kpis.totalOrders,
      pending: kpis.pending,
      onDelivery: kpis.onDelivery,
      completed: kpis.completed,
      cancelled: kpis.cancelled,
      topProduct: topProduct ? { name: topProduct[0], kg: topProduct[1] } : null,
      revenueThisWeek,
    }
  }, [orders])

  // ─── Weekly Sales Revenue Chart (Mon–Sun) ───
  const weeklyRevenueData = useMemo(() => {
    const weekStart = startOfWeek(new Date())
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    const dayRevenue = new Array(7).fill(0)

    orders.forEach((o) => {
      if (normalizeSalesStatus((o as any).salesStatus || o.status) === "Cancelled") return
      const d = parseTimestamp(o.createdAt)
      if (!d || d < weekStart) return
      const dayOfWeek = d.getDay()
      const idx = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Mon=0, Sun=6
      dayRevenue[idx] += computeTotalAmount(o)
    })

    return days.map((label, i) => ({
      label,
      value: Math.round(dayRevenue[i]),
    }))
  }, [orders])

  // ─── Order Status Distribution — uses centralized helper ───
  const statusDistribution = useMemo(() => {
    return computeSalesStatusDistribution(orders)
  }, [orders])

  // ─── Top Selling Products by KG ───
  const topProductsData = useMemo(() => {
    const map: Record<string, number> = {}
    orders.forEach((o) => {
      if (normalizeSalesStatus((o as any).salesStatus || o.status) === "Cancelled") return
      ;(o.items || []).forEach((item) => {
        const name = item.name || "Unknown"
        const kg = Number(item.quantity ?? 0)
        map[name] = (map[name] || 0) + kg
      })
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, kg]) => ({ name, kg: Math.round(kg * 10) / 10 }))
  }, [orders])

  // ─── Monthly Sales Trend ───
  const monthlyTrendData = useMemo(() => {
    const map: Record<string, number> = {}
    orders.forEach((o) => {
      if (normalizeSalesStatus((o as any).salesStatus || o.status) === "Cancelled") return
      const d = parseTimestamp(o.createdAt)
      if (!d) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      map[key] = (map[key] || 0) + computeTotalAmount(o)
    })
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([key, value]) => {
        const [year, month] = key.split("-")
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        return {
          label: `${monthNames[parseInt(month) - 1]} ${year.slice(2)}`,
          value: Math.round(value),
        }
      })
  }, [orders])

  // ─── Customer Analytics ───
  const customerAnalytics = useMemo(() => {
    const customerMap: Record<string, { totalAmount: number; orderCount: number }> = {}
    orders.forEach((o) => {
      if (normalizeSalesStatus((o as any).salesStatus || o.status) === "Cancelled") return
      const name = o.customerName || "Unknown"
      if (!customerMap[name]) customerMap[name] = { totalAmount: 0, orderCount: 0 }
      customerMap[name].totalAmount += computeTotalAmount(o)
      customerMap[name].orderCount++
    })

    const sorted = Object.entries(customerMap).sort((a, b) => b[1].totalAmount - a[1].totalAmount)

    const topCustomer = sorted[0]
      ? { name: sorted[0][0], amount: sorted[0][1].totalAmount }
      : null

    const highestPurchase = orders.reduce(
      (max, o) => {
        if (normalizeSalesStatus((o as any).salesStatus || o.status) === "Cancelled") return max
        const amt = computeTotalAmount(o)
        return amt > max.amount ? { name: o.customerName, amount: amt } : max
      },
      { name: "", amount: 0 }
    )

    const repeatCustomers = Object.values(customerMap).filter((c) => c.orderCount > 1).length

    const productOrderCount: Record<string, number> = {}
    orders.forEach((o) => {
      if (normalizeSalesStatus((o as any).salesStatus || o.status) === "Cancelled") return
      ;(o.items || []).forEach((item) => {
        const name = item.name || "Unknown"
        productOrderCount[name] = (productOrderCount[name] || 0) + 1
      })
    })
    const mostOrdered = Object.entries(productOrderCount).sort((a, b) => b[1] - a[1])[0]

    return {
      topCustomer,
      highestPurchase: highestPurchase.name ? highestPurchase : null,
      repeatCustomers,
      mostOrderedProduct: mostOrdered
        ? { name: mostOrdered[0], count: mostOrdered[1] }
        : null,
    }
  }, [orders])

  // ─── Pagination ───
  const totalResults = allFilteredOrders.length
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize))
  const paginatedOrders = allFilteredOrders.slice(
    (page - 1) * pageSize,
    page * pageSize
  )
  const paginationStart = totalResults === 0 ? 0 : (page - 1) * pageSize + 1
  const paginationEnd = Math.min(page * pageSize, totalResults)

  return {
    loading,
    orders: paginatedOrders,
    allFilteredOrders,
    allOrders: orders,
    summary,
    weeklyRevenueData,
    statusDistribution,
    topProductsData,
    monthlyTrendData,
    customerAnalytics,
    // Filters
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    categoryFilter, setCategoryFilter,
    startDate, setStartDate,
    endDate, setEndDate,
    setToday, setThisWeek, setThisMonth,
    resetFilters,
    // Sort
    sortField, sortDir, toggleSort,
    // Pagination
    page, setPage, totalPages, totalResults,
    pageSize, setPageSize,
    paginationStart, paginationEnd,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    // Utilities
    parseTimestamp,
    // expose normalizer so components can use it without extra imports
    normalizeSalesStatus,
  }
}

// ─── Compute helpers (exported for PDF & external use) ──────────────────────
export function computeTotalKg(order: Order): number {
  return (order.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
}

export function computeTotalAmount(order: Order): number {
  return (order.items || []).reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
    0
  )
}

export function computeProductSummary(order: Order): string {
  const items = order.items || []
  if (items.length === 0) return "—"
  const names = items.slice(0, 2).map((i) => i.name)
  return items.length > 2
    ? `${names.join(", ")} +${items.length - 2} more`
    : names.join(", ")
}
