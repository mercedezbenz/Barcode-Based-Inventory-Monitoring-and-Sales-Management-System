"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  TrendingUp, TrendingDown, AlertCircle, X, ChevronLeft, ChevronRight,
  Clock, Package, AlertTriangle, ShieldAlert, Zap, TrendingDown as SlowIcon,
  RotateCcw, Trash2, ArrowUpCircle, ArrowDownCircle, RefreshCw,
  ShoppingCart, CalendarDays, Trophy
} from "lucide-react"
import { TotalStocksIcon, LowStockIcon, ExpiringSoonIcon } from "./dashboard-icons"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { subscribeToCollection, CustomerTransactionService } from "@/services/firebase-service"
import { TransactionService } from "@/services/firebase-service"
import { useAuth } from "@/hooks/use-auth"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { InventoryItem, InventoryTransaction } from "@/lib/types"
import { formatExpirationDate as formatExpDate } from "@/lib/utils"
import { DashboardOverviewSkeleton } from "@/components/skeletons/dashboard-skeleton"
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Area, AreaChart
} from "recharts"

interface DashboardStats {
  totalItems: number
  totalWeight: number
  lowStockItems: number
  expiringSoon: number
  outOfStock: number
}

// ─── Mini sparkline bar chart for KPI cards ───
const TrendChart = ({ trend, type }: { trend: "up" | "down"; type: "total" | "low" | "expiring" | "outofstock" }) => {
  const palettes: Record<string, { height: number; color: string }[]> = {
    total: [
      { height: 25, color: "#93C5FD" },
      { height: 45, color: "#60A5FA" },
      { height: 35, color: "#3B82F6" },
      { height: 60, color: "#2563EB" },
      { height: 75, color: "#1D4ED8" },
    ],
    low: [
      { height: 70, color: "#FCA5A5" },
      { height: 50, color: "#F87171" },
      { height: 35, color: "#EF4444" },
      { height: 25, color: "#FB923C" },
      { height: 15, color: "#FBBF24" },
    ],
    expiring: [
      { height: 20, color: "#FDE68A" },
      { height: 40, color: "#FCD34D" },
      { height: 55, color: "#FBBF24" },
      { height: 45, color: "#F59E0B" },
      { height: 70, color: "#D97706" },
    ],
    outofstock: [
      { height: 60, color: "#FCA5A5" },
      { height: 80, color: "#F87171" },
      { height: 45, color: "#EF4444" },
      { height: 30, color: "#DC2626" },
      { height: 55, color: "#B91C1C" },
    ],
  }

  const bars = palettes[type] || palettes.total

  return (
    <div className="relative h-14 w-20 flex items-end justify-center gap-[3px] opacity-50">
      {bars.map((bar, index) => (
        <div
          key={index}
          className="w-2.5 rounded-t-sm transition-all duration-500"
          style={{
            height: `${bar.height}%`,
            backgroundColor: bar.color,
            animationDelay: `${index * 80}ms`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Out of Stock icon ───
const OutOfStockIcon = ({ className }: { className?: string }) => (
  <div
    className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 hover:scale-110 ${className}`}
    style={{
      background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
      boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
    }}
  >
    <div
      className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      style={{
        background: "linear-gradient(135deg, #f87171 0%, #ef4444 100%)",
        boxShadow: "0 0 20px rgba(239, 68, 68, 0.6)",
      }}
    />
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10">
      <path d="M20 7L12 3L4 7M20 7L12 11M20 7V17L12 21M12 11L4 7M12 11V21M4 7V17L12 21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="4" y1="4" x2="20" y2="20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  </div>
)

// ─── Action badge component for stock movements ───
const ActionBadge = ({ action }: { action: string }) => {
  const normalized = action?.toUpperCase()?.trim() || ""

  let label = action
  let className = "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase "
  let icon: React.ReactNode = null

  if (normalized.includes("INCOMING") || normalized === "IN" || normalized.includes("FROM")) {
    label = "IN"
    className += "bg-emerald-50 text-emerald-700 border border-emerald-200"
    icon = <ArrowDownCircle className="h-3 w-3 mr-1" />
  } else if (normalized.includes("OUTGOING") || normalized === "OUT" || normalized === "PRODUCT_OUT") {
    label = "OUT"
    className += "bg-red-50 text-red-600 border border-red-200"
    icon = <ArrowUpCircle className="h-3 w-3 mr-1" />
  } else if (normalized.includes("GOOD") || normalized === "GOOD_RETURN" || normalized === "GOOD RETURN") {
    label = "RETURN"
    className += "bg-blue-50 text-blue-600 border border-blue-200"
    icon = <RefreshCw className="h-3 w-3 mr-1" />
  } else if (normalized.includes("BAD") || normalized.includes("DAMAGE") || normalized === "BAD_RETURN" || normalized === "BAD RETURN") {
    label = "BAD RETURN"
    className += "bg-gray-100 text-gray-500 border border-gray-200"
    icon = <Trash2 className="h-3 w-3 mr-1" />
  } else {
    className += "bg-gray-50 text-gray-600 border border-gray-200"
  }

  return <span className={className}>{icon}{label}</span>
}

// ─── Movement type label ───
const getMovementTypeLabel = (action: string) => {
  const normalized = action?.toUpperCase()?.trim() || ""
  if (normalized.includes("INCOMING") || normalized === "IN" || normalized.includes("FROM") || normalized.includes("SUPPLIER") || normalized.includes("PRODUCTION")) return "Restock"
  if (normalized.includes("OUTGOING") || normalized === "OUT" || normalized === "PRODUCT_OUT") return "Usage"
  if (normalized.includes("GOOD") || normalized === "GOOD_RETURN") return "Return"
  if (normalized.includes("BAD") || normalized.includes("DAMAGE")) return "Damage"
  return "Movement"
}

// ─── Stock Status Donut Chart Custom Label ───
const DONUT_COLORS = ["#10B981", "#F59E0B", "#EF4444", "#F97316"]
const renderDonutLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-[11px] font-bold" style={{ fontSize: '11px', fontWeight: 700 }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export function DashboardOverview() {
  const { user, firebaseError, isReadOnly } = useAuth()
  console.log("USER ROLE:", user?.role)
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    totalWeight: 0,
    lowStockItems: 0,
    expiringSoon: 0,
    outOfStock: 0,
  })
  const [allInventoryItems, setAllInventoryItems] = useState<InventoryItem[]>([])
  const [stockAlerts, setStockAlerts] = useState<InventoryItem[]>([])
  const [recentlyAdded, setRecentlyAdded] = useState<InventoryItem[]>([])
  const [recentMovements, setRecentMovements] = useState<InventoryTransaction[]>([])
  const [allTransactions, setAllTransactions] = useState<InventoryTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [hasPermissionError, setHasPermissionError] = useState(false)
  const [showNotificationBanner, setShowNotificationBanner] = useState(false)

  // Pagination state for Stock Alert & Updates table
  const [stockCurrentPage, setStockCurrentPage] = useState(1)
  const STOCK_ITEMS_PER_PAGE = 6

  // Pagination state for Recent Stock Movements
  const [movementCurrentPage, setMovementCurrentPage] = useState(1)
  const MOVEMENT_ITEMS_PER_PAGE = 6

  // Helper function to calculate paginated stock items
  const getPaginatedStockItems = () => {
    const allStockItems = [...recentlyAdded, ...stockAlerts]
    // Remove duplicates by id
    const unique = allStockItems.filter((item, index, self) =>
      index === self.findIndex((t) => t.id === item.id)
    )
    const totalItems = unique.length
    const totalPages = Math.max(1, Math.ceil(totalItems / STOCK_ITEMS_PER_PAGE))
    const startIndex = (stockCurrentPage - 1) * STOCK_ITEMS_PER_PAGE
    const endIndex = Math.min(startIndex + STOCK_ITEMS_PER_PAGE, totalItems)

    return {
      items: unique.slice(startIndex, endIndex),
      totalPages,
      totalItems,
      startIndex,
      endIndex,
    }
  }

  // Helper function to calculate paginated movement items
  const getPaginatedMovements = () => {
    const totalItems = recentMovements.length
    const totalPages = Math.max(1, Math.ceil(totalItems / MOVEMENT_ITEMS_PER_PAGE))
    const startIndex = (movementCurrentPage - 1) * MOVEMENT_ITEMS_PER_PAGE
    const endIndex = Math.min(startIndex + MOVEMENT_ITEMS_PER_PAGE, totalItems)

    return {
      items: recentMovements.slice(startIndex, endIndex),
      totalPages,
      totalItems,
      startIndex,
      endIndex,
    }
  }

  // Reset to page 1 when data changes
  useEffect(() => {
    setStockCurrentPage(1)
  }, [recentlyAdded.length, stockAlerts.length])

  useEffect(() => {
    setMovementCurrentPage(1)
  }, [recentMovements.length])

  // Helper function to parse dates
  const parseDate = (d: any) => {
    if (!d) return null
    if (typeof d === "string") return new Date(d)
    if (d instanceof Date) return d
    if (d && typeof d.toDate === "function") return d.toDate()
    if (d && d.seconds) return new Date(d.seconds * 1000)
    return null
  }

  useEffect(() => {
    if (!user || firebaseError) {
      setLoading(false)
      if (firebaseError?.includes("permission")) {
        setHasPermissionError(true)
      }
      return
    }

    let unsubscribeInventory: (() => void) | undefined
    let unsubscribeTransactions: (() => void) | undefined

    try {
      // Subscribe to inventory collection
      unsubscribeInventory = subscribeToCollection("inventory", (items: InventoryItem[]) => {
        const normalizedItems = items.map((it: any) => {
          const incomingStock = it.incoming_weight ?? it.production_weight ?? it.incoming ?? it.stockIncoming ?? it.incomingStock ?? 0
          const outgoingStock = it.outgoing_weight ?? it.outgoing ?? it.stockOutgoing ?? it.outgoingStock ?? 0
          const goodReturnStock = it.good_return_weight ?? it.goodReturnStock ?? 0
          const damageReturnStock = it.damage_return_weight ?? it.damageReturnStock ?? 0
          const stockLeft = Math.max(0, incomingStock - outgoingStock + goodReturnStock - damageReturnStock)

          let updatedAt = it.updatedAt || it.lastUpdated || it.createdAt
          if (!updatedAt) {
            updatedAt = new Date()
          }

          return {
            ...it,
            incoming: incomingStock,
            outgoing: outgoingStock,
            goodReturnStock,
            damageReturnStock,
            stockLeft,
            updatedAt,
          }
        })

        setAllInventoryItems(normalizedItems)

        // Filter low stock items - Logic: remainingWeight <= 50 kg
        const lowStockItems = normalizedItems.filter((item) => {
          const stockLeft = (item as any).stockLeft ?? 0
          return stockLeft > 0 && stockLeft <= 50
        })
        setStockAlerts(lowStockItems.slice(0, 10))

        // Filter out of stock
        const outOfStockItems = normalizedItems.filter((item) => {
          const stockLeft = (item as any).stockLeft ?? 0
          return stockLeft === 0
        })

        // Filter expiring soon (within 30 days)
        const now = new Date()
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        const expiringItems = normalizedItems.filter((item) => {
          const stockLeft = (item as any).stockLeft ?? 0
          if (stockLeft <= 0) return false // Only count items in stock
          const expDate = parseDate((item as any).expiryDate ?? (item as any).expirationDate)
          if (!expDate) return false
          return expDate > now && expDate <= thirtyDaysFromNow
        })

        // Recently added: top 10 by createdAt desc
        const recent = [...normalizedItems]
          .sort((a, b) => {
            const ad = parseDate((a as any).createdAt)?.getTime() || 0
            const bd = parseDate((b as any).createdAt)?.getTime() || 0
            return bd - ad
          })
          .slice(0, 10)
        setRecentlyAdded(recent)

        const totalWeight = normalizedItems.reduce((sum, it) => sum + ((it as any).stockLeft || 0), 0)
        console.log("TOTAL KG:", totalWeight)
        const totalItemsCount = normalizedItems.length

        setStats((prev) => ({
          ...prev,
          totalItems: totalItemsCount,
          totalWeight: totalWeight,
          lowStockItems: lowStockItems.length,
          expiringSoon: expiringItems.length,
          outOfStock: outOfStockItems.length,
        }))

        setShowNotificationBanner(lowStockItems.length > 0)
        setLoading(false)
      })

      // Subscribe to transactions for Recent Stock Movements
      try {
        unsubscribeTransactions = TransactionService.subscribeToTransactions(
          (txns: InventoryTransaction[]) => {
            // Store all transactions for sales computations
            setAllTransactions(txns)
            // Sort by most recent first
            const sorted = [...txns].sort((a, b) => {
              const ad = parseDate(a.transaction_date || a.created_at)?.getTime() || 0
              const bd = parseDate(b.transaction_date || b.created_at)?.getTime() || 0
              return bd - ad
            })
            setRecentMovements(sorted.slice(0, 50)) // Keep last 50 movements
          },
          () => {
            console.log("[Dashboard] Transactions subscription not accessible, skipping...")
            setRecentMovements([])
          }
        )
      } catch (error) {
        console.log("[Dashboard] Transactions subscription error, skipping...")
      }
    } catch (error) {
      console.error("[Dashboard] Subscription error:", error)
      setHasPermissionError(true)
      setLoading(false)
    }

    return () => {
      unsubscribeInventory?.()
      unsubscribeTransactions?.()
    }
  }, [user, firebaseError])

  const handleNotificationClick = () => {
    router.push("/inventory?filter=low-stock")
    setShowNotificationBanner(false)
  }

  const formatTimeAgo = (date: Date | string | any) => {
    let dateObj: Date

    if (date && typeof date === "object" && date.toDate) {
      dateObj = date.toDate()
    } else if (date && typeof date === "object" && date.seconds) {
      dateObj = new Date(date.seconds * 1000)
    } else if (typeof date === "string") {
      dateObj = new Date(date)
    } else if (date instanceof Date) {
      dateObj = date
    } else {
      return "N/A"
    }

    if (isNaN(dateObj.getTime())) {
      return "N/A"
    }

    const now = new Date()
    const diffInMs = now.getTime() - dateObj.getTime()
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInMinutes < 1) return "Just now"
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`
    if (diffInHours === 1) return "1 hour ago"
    if (diffInHours < 24) return `${diffInHours} hours ago`
    if (diffInDays === 1) return "1 day ago"
    if (diffInDays < 7) return `${diffInDays} days ago`

    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatMovementDateTime = (date: Date | string | any) => {
    let dateObj: Date

    if (date && typeof date === "object" && date.toDate) {
      dateObj = date.toDate()
    } else if (date && typeof date === "object" && date.seconds) {
      dateObj = new Date(date.seconds * 1000)
    } else if (typeof date === "string") {
      dateObj = new Date(date)
    } else if (date instanceof Date) {
      dateObj = date
    } else {
      return { date: "N/A", time: "" }
    }

    if (isNaN(dateObj.getTime())) {
      return { date: "N/A", time: "" }
    }

    return {
      date: dateObj.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      time: dateObj.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    }
  }

  // Determine movement type label from transaction data
  const getMovementAction = (txn: InventoryTransaction) => {
    const mt = (txn.movement_type || txn.source || "").toUpperCase()
    if (mt.includes("RETURN") && mt.includes("DAMAGE")) return "BAD RETURN"
    if (mt.includes("GOOD") || (mt.includes("RETURN") && !mt.includes("DAMAGE"))) return "GOOD RETURN"
    if (mt.includes("OUTGOING") || mt.includes("OUT")) return "OUT"
    if (mt.includes("INCOMING") || mt.includes("SUPPLIER") || mt.includes("PRODUCTION") || mt.includes("FROM")) return "IN"
    // Fallback: check weights
    if (((txn as any).outgoing_weight || 0) > 0) return "OUT"
    if (((txn as any).incoming_weight || (txn as any).production_weight || 0) > 0) return "IN"
    if (((txn as any).good_return_weight || 0) > 0) return "GOOD RETURN"
    if (((txn as any).damage_return_weight || 0) > 0) return "BAD RETURN"
    return mt || "IN"
  }

  // Get the relevant quantity for a movement
  const getMovementQuantity = (txn: InventoryTransaction) => {
    const action = getMovementAction(txn)
    if (action === "OUT") return (txn as any).outgoing_weight ?? (txn as any).outgoing_qty ?? 0
    if (action === "IN") return (txn as any).incoming_weight ?? (txn as any).production_weight ?? (txn as any).incoming_qty ?? 0
    if (action === "GOOD RETURN") return (txn as any).good_return_weight ?? (txn.good_return || 0)
    if (action === "BAD RETURN") return (txn as any).damage_return_weight ?? (txn.damage_return || 0)
    return (txn as any).incoming_weight ?? (txn as any).outgoing_weight ?? 0
  }

  const getMovementUnit = (txn: InventoryTransaction) => {
    return "kg"
  }

  // ─── Computed: Stock Status Donut Data ───
  const donutData = useMemo(() => {
    const now = new Date()
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    let inStock = 0, lowStock = 0, outOfStock = 0, expiringSoon = 0

    allInventoryItems.forEach((item: any) => {
      const stockLeft = item.stockLeft ?? 0
      const expDate = parseDate(item.expiryDate ?? item.expirationDate)
      const isExpiring = expDate && expDate > now && expDate <= thirtyDays

      if (stockLeft === 0) {
        outOfStock++
      } else if (isExpiring) {
        expiringSoon += stockLeft
      } else if (stockLeft <= 50) {
        lowStock += stockLeft
      } else {
        inStock += stockLeft
      }
    })

    return [
      { name: "In Stock", value: inStock, color: "#10B981" },
      { name: "Low Stock", value: lowStock, color: "#F59E0B" },
      { name: "Out of Stock", value: outOfStock, color: "#EF4444" },
      { name: "Expiring Soon", value: expiringSoon, color: "#F97316" },
    ].filter(d => d.value > 0)
  }, [allInventoryItems])

  // ─── Computed: Inventory Insights ───
  const insights = useMemo(() => {
    const now = new Date()
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const result: { type: string; icon: React.ReactNode; message: string; priority: number; category: "Critical" | "Warning" }[] = []

    allInventoryItems.forEach((item: any) => {
      const stockLeft = item.stockLeft ?? 0
      const name = item.name ?? item.itemName ?? item.category ?? "Unknown"
      const expDate = parseDate(item.expiryDate ?? item.expirationDate)

      // 4. EXPIRED (Critical)
      if (expDate && expDate < now) {
        result.push({
          type: "expired",
          icon: <div className="h-2.5 w-2.5 rounded-full bg-gray-500 shadow-sm" />,
          message: `${name} has expired. Record as waste.`,
          priority: 1,
          category: "Critical",
        })
      }
      // 1. OUT OF STOCK (Critical)
      else if (stockLeft <= 0) {
        result.push({
          type: "outofstock",
          icon: <div className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/20" />,
          message: `${name} is currently out of stock. Consider restocking.`,
          priority: 2,
          category: "Critical",
        })
      }
      // 3. EXPIRING SOON (Warning)
      else if (expDate && expDate <= sevenDays) {
        const days = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        const daysText = days === 1 ? "1 day" : `${days} days`
        result.push({
          type: "expiring",
          icon: <div className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-sm shadow-orange-500/20" />,
          message: `${name} will expire in ${daysText}. Prioritize usage (FEFO).`,
          priority: 3,
          category: "Warning",
        })
      }
      // 2. LOW STOCK (Warning)
      else if (stockLeft <= 50) {
        const boxes = Math.ceil(stockLeft / 25)
        result.push({
          type: "lowstock",
          icon: <div className="h-2.5 w-2.5 rounded-full bg-yellow-400 shadow-sm shadow-yellow-400/20" />,
          message: `${boxes} box${boxes > 1 ? "es" : ""} remaining (${stockLeft} kg)`,
          priority: 4,
          category: "Warning",
        })
      }
    })

    // Sort by priority and limit to top 8 most important
    return result.sort((a, b) => a.priority - b.priority).slice(0, 8)
  }, [allInventoryItems])

  // ─── Filtered Insights: hide expiry for owner ───
  const filteredInsights = useMemo(() => {
    if (user?.role === "owner") {
      return insights.filter(i => i.type !== "expired" && i.type !== "expiring")
    }
    return insights
  }, [insights, user?.role])

  // ─── Computed: Usage Trend (from transactions) ───
  const usageTrendData = useMemo(() => {
    if (recentMovements.length === 0) return []

    const dailyMap: Record<string, { date: string; used: number; restocked: number }> = {}

    recentMovements.forEach((txn) => {
      const dateObj = parseDate(txn.transaction_date || txn.created_at)
      if (!dateObj || isNaN(dateObj.getTime())) return
      const key = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })

      if (!dailyMap[key]) {
        dailyMap[key] = { date: key, used: 0, restocked: 0 }
      }

      const action = getMovementAction(txn)
      if (action === "OUT") {
        dailyMap[key].used += (txn as any).outgoing_weight || 0
      } else if (action === "IN") {
        dailyMap[key].restocked += (txn as any).incoming_weight || (txn as any).production_weight || 0
      }
    })

    return Object.values(dailyMap).reverse().slice(-14)
  }, [recentMovements])

  // ─── Sales Summary Computations (OUT transactions only, kg) ───
  const salesData = useMemo(() => {
    const isToday = (date: any) => {
      const parsed = parseDate(date)
      if (!parsed) return false
      const today = new Date()
      return parsed.toDateString() === today.toDateString()
    }

    const isThisWeek = (date: any) => {
      const parsed = parseDate(date)
      if (!parsed) return false
      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)
      return parsed >= startOfWeek
    }

    // Filter all OUT transactions
    const outTransactions = allTransactions.filter((txn) => {
      const action = getMovementAction(txn)
      return action === "OUT"
    })

    // Sales Today (kg)
    const salesToday = outTransactions
      .filter((txn) => isToday(txn.transaction_date || txn.created_at))
      .reduce((sum, txn) => sum + ((txn as any).outgoing_weight || 0), 0)

    // Sales This Week (kg)
    const salesThisWeek = outTransactions
      .filter((txn) => isThisWeek(txn.transaction_date || txn.created_at))
      .reduce((sum, txn) => sum + ((txn as any).outgoing_weight || 0), 0)

    // Top Selling Product (all-time by kg)
    const productMap: Record<string, number> = {}
    outTransactions.forEach((txn) => {
      const name = (txn as any).product_name || (txn as any).productName || "Unknown"
      if (!productMap[name]) productMap[name] = 0
      productMap[name] += (txn as any).outgoing_weight || 0
    })

    const topProduct = Object.entries(productMap).sort((a, b) => b[1] - a[1])[0]
    const topProductName = topProduct ? topProduct[0] : "N/A"
    const topProductWeight = topProduct ? topProduct[1] : 0

    return { salesToday, salesThisWeek, topProductName, topProductWeight }
  }, [allTransactions])

  if (hasPermissionError || firebaseError) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Firebase Setup Required:</strong> Please configure your Firebase project to access dashboard
            features.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (loading) {
    return <DashboardOverviewSkeleton />
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Alert Banner */}
      {showNotificationBanner && (
        <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-orange-950/40 dark:to-amber-950/40 border border-amber-200/60 dark:border-orange-800 px-5 py-3.5 shadow-sm animate-in slide-in-from-top-2 duration-300">
          <div className="flex-shrink-0 h-9 w-9 rounded-xl bg-white dark:bg-orange-900 flex items-center justify-center shadow-sm">
            <AlertCircle className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
          </div>
          <span className="text-sm text-gray-800 dark:text-orange-200">
            <strong className="font-semibold">Low Stock Alert:</strong>{" "}
            {stats.lowStockItems} items require immediate attention.
          </span>
          <div className="flex-1"></div>
          <Button
            size="sm"
            onClick={handleNotificationClick}
            className="px-4 py-2 rounded-full bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold transition-all hover:scale-[1.02] hover:shadow-md flex-shrink-0"
          >
            View Items
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowNotificationBanner(false)}
            className="h-8 w-8 p-0 rounded-full text-gray-400 hover:text-gray-600 hover:bg-orange-100 dark:hover:bg-orange-900 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Page Header */}
      <div>
        <h1 className="text-[28px] font-bold text-gray-900 dark:text-foreground leading-tight tracking-[-0.01em]">
          Main Dashboard
        </h1>
        <p className="text-gray-400 dark:text-muted-foreground text-[13px] mt-1 tracking-wide">
          Monitor inventory flow and stock status in real time
        </p>
      </div>

      {/* ─── KPI Summary Cards ─── */}
      <div className={`grid gap-5 grid-cols-2 ${user?.role === "owner" ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
        {/* Total Stocks */}
        <Card className="rounded-2xl border border-gray-100 dark:border-border bg-white dark:bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wide">
              Total Items
            </CardTitle>
            <TotalStocksIcon />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold text-gray-900 dark:text-foreground leading-none mb-1">
                  {stats.totalItems.toLocaleString()} items
                </div>
                <div className="text-[13px] font-medium text-gray-400 dark:text-muted-foreground mb-2">
                  {stats.totalWeight.toLocaleString()} kg total
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">+5</span>
                  </div>
                  <span className="text-xs text-gray-400">this week</span>
                </div>
              </div>
              <TrendChart trend="up" type="total" />
            </div>
          </CardContent>
        </Card>

        {/* Low Stock */}
        <Card className="rounded-2xl border border-gray-100 dark:border-border bg-white dark:bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wide">
              Low Stock
            </CardTitle>
            <LowStockIcon />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold text-amber-500 leading-none mb-2">
                  {stats.lowStockItems}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/30">
                    <TrendingDown className="h-3 w-3 text-red-500" />
                    <span className="text-xs font-semibold text-red-500 dark:text-red-400">-1</span>
                  </div>
                  <span className="text-xs text-gray-400">this week</span>
                </div>
              </div>
              <TrendChart trend="down" type="low" />
            </div>
          </CardContent>
        </Card>

        {/* Expiring Soon (hidden for owner) */}
        {user?.role !== "owner" && (
        <Card className="rounded-2xl border border-gray-100 dark:border-border bg-white dark:bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wide">
              Expiring Soon
            </CardTitle>
            <ExpiringSoonIcon />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold text-orange-500 leading-none mb-2">
                  {stats.expiringSoon}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30">
                    <AlertCircle className="h-3 w-3 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">30d</span>
                  </div>
                  <span className="text-xs text-gray-400">window</span>
                </div>
              </div>
              <TrendChart trend="up" type="expiring" />
            </div>
          </CardContent>
        </Card>
        )}

        {/* Out of Stock */}
        <Card className="rounded-2xl border border-gray-100 dark:border-border bg-white dark:bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wide">
              Out of Stock
            </CardTitle>
            <OutOfStockIcon />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold text-red-500 leading-none mb-2">
                  {stats.outOfStock}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/30">
                    <ShieldAlert className="h-3 w-3 text-red-500" />
                    <span className="text-xs font-semibold text-red-500 dark:text-red-400">critical</span>
                  </div>
                  <span className="text-xs text-gray-400">needs action</span>
                </div>
              </div>
              <TrendChart trend="up" type="outofstock" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Sales Summary Cards (Owner only) ─── */}
      {user?.role === "owner" && (
      <div className="grid gap-5 grid-cols-1 md:grid-cols-3">
        {/* Sales Today */}
        <Card className="rounded-2xl border border-gray-100 dark:border-border bg-gradient-to-br from-white to-emerald-50/40 dark:from-card dark:to-emerald-950/20 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(16,185,129,0.12)] transition-all duration-300 group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-100/50 to-transparent dark:from-emerald-900/20 rounded-bl-[60px]" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wide">
              Sales Today
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform duration-300">
              <ShoppingCart className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 relative">
            <div className="text-3xl font-bold text-gray-900 dark:text-foreground leading-none mb-1">
              {salesData.salesToday.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-lg font-semibold text-gray-400">kg</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-muted-foreground mt-1">
              Total outgoing weight today
            </p>
          </CardContent>
        </Card>

        {/* Sales This Week */}
        <Card className="rounded-2xl border border-gray-100 dark:border-border bg-gradient-to-br from-white to-blue-50/40 dark:from-card dark:to-blue-950/20 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(59,130,246,0.12)] transition-all duration-300 group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-100/50 to-transparent dark:from-blue-900/20 rounded-bl-[60px]" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wide">
              Sales This Week
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform duration-300">
              <CalendarDays className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 relative">
            <div className="text-3xl font-bold text-gray-900 dark:text-foreground leading-none mb-1">
              {salesData.salesThisWeek.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-lg font-semibold text-gray-400">kg</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-muted-foreground mt-1">
              Total outgoing weight this week
            </p>
          </CardContent>
        </Card>

        {/* Top Product */}
        <Card className="rounded-2xl border border-gray-100 dark:border-border bg-gradient-to-br from-white to-amber-50/40 dark:from-card dark:to-amber-950/20 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(245,158,11,0.12)] transition-all duration-300 group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-100/50 to-transparent dark:from-amber-900/20 rounded-bl-[60px]" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wide">
              Top Product
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-transform duration-300">
              <Trophy className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 relative">
            <div className="text-lg font-bold text-gray-900 dark:text-foreground leading-tight mb-0.5 truncate" title={salesData.topProductName}>
              {salesData.topProductName}
            </div>
            <div className="text-sm font-semibold text-amber-600 dark:text-amber-400">
              {salesData.topProductWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg
            </div>
            <p className="text-xs text-gray-400 dark:text-muted-foreground mt-1">
              Highest outgoing volume (all-time)
            </p>
          </CardContent>
        </Card>
      </div>
      )}

      {/* ─── Donut Chart + Insights Panel ─── */}
      <div className="grid gap-5 lg:grid-cols-5">

        {/* ──── LEFT: Donut Chart (2 cols) ──── */}
        <Card className="lg:col-span-2 rounded-2xl border border-gray-100 dark:border-border bg-white dark:bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300 overflow-hidden">
          <CardHeader className="px-6 pt-6 pb-2">
            <CardTitle className="text-lg font-bold text-gray-900 dark:text-foreground">
              Stock Status Overview
            </CardTitle>
            <CardDescription className="text-sm text-gray-400 dark:text-muted-foreground">
              Current inventory distribution
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {donutData.length > 0 ? (
              <div className="flex flex-col items-center">
                <div className="w-full h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        labelLine={false}
                        label={renderDonutLabel}
                        stroke="none"
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e5e7eb",
                          borderRadius: "12px",
                          padding: "8px 14px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                          fontSize: "13px",
                        }}
                        formatter={(value: number, name: string) => [`${value.toLocaleString()} kg`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-2 w-full max-w-[280px]">
                  {donutData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="text-xs text-gray-500 dark:text-muted-foreground truncate">{entry.name}</span>
                       <span className="text-xs font-bold text-gray-700 dark:text-foreground ml-auto">{entry.value.toLocaleString()} kg</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Package className="h-10 w-10 text-gray-200 mb-3" />
                <p className="text-sm text-gray-400">No inventory data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ──── RIGHT: Inventory Insights (3 cols) ──── */}
        <Card className="lg:col-span-3 rounded-2xl border border-gray-100 dark:border-border bg-white dark:bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300 overflow-hidden">
          <CardHeader className="px-6 pt-6 pb-2">
            <CardTitle className="text-lg font-bold text-gray-900 dark:text-foreground flex items-center gap-2">
              <Zap className="h-5 w-5 text-sky-500" />
              Inventory Insights
            </CardTitle>
            <CardDescription className="text-sm text-gray-400 dark:text-muted-foreground">
              Smart recommendations based on current stock health
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {filteredInsights.length > 0 ? (
              <div className="space-y-6 max-h-[340px] overflow-y-auto pr-1">
                {(["Critical", "Warning"] as const).map((category) => {
                  const categoryInsights = filteredInsights.filter((i) => i.category === category)
                  if (categoryInsights.length === 0) return null

                  return (
                    <div key={category} className="space-y-3">
                      <h4 className="text-[11px] font-bold text-gray-400 dark:text-muted-foreground uppercase tracking-widest pl-1">
                        {category}
                      </h4>
                      <div className="space-y-2">
                        {categoryInsights.map((insight, idx) => (
                          <div
                            key={`${category}-${idx}`}
                            className="flex items-start gap-3.5 p-3.5 rounded-xl bg-gray-50/60 dark:bg-secondary/20 border border-gray-100/50 dark:border-border/30 hover:bg-gray-100/50 dark:hover:bg-secondary/40 transition-colors"
                          >
                            <div className="flex-shrink-0 mt-1.5 flex items-center justify-center">
                              {insight.icon}
                            </div>
                            <p className="text-[13px] text-gray-700 dark:text-foreground leading-relaxed flex-1">
                              {insight.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-3">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-gray-700 dark:text-foreground">All systems healthy!</p>
                <p className="text-xs text-gray-400 mt-1">No immediate actions required</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Main Content: Stock Alerts + Recent Movements ─── */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* ──────── LEFT: Stock Alert & Updates ──────── */}
        <Card className="rounded-2xl border border-gray-100 dark:border-border bg-white dark:bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-0 px-6 pt-6">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-bold text-gray-900 dark:text-foreground mb-0.5">
                Stock Alert & Updates
              </CardTitle>
              <CardDescription className="text-sm text-gray-400 dark:text-muted-foreground">
                Items requiring immediate attention
              </CardDescription>
            </div>
            {!isReadOnly && (
              <Button
                asChild
                className="h-9 px-5 rounded-full bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm flex-shrink-0 transition-all hover:scale-[1.02] hover:shadow-md"
              >
                <Link href="/inventory">Manage Stock</Link>
              </Button>
            )}
          </CardHeader>
          <CardContent className="px-6 pb-5 pt-4">

            {/* ── Summary Bar ── */}
            {(() => {
              const allItems = [...recentlyAdded, ...stockAlerts].filter((item, index, self) =>
                index === self.findIndex((t) => t.id === item.id)
              )
              const outOfStockCount = allItems.filter(i => ((i as any).stockLeft ?? 0) <= 0).length
              const lowStockCount = allItems.filter(i => {
                const s = (i as any).stockLeft ?? 0
                return s > 0 && s <= 5
              }).length
              const now = new Date()
              const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
              const expiringCount = allItems.filter(i => {
                const expDate = (i as any).expiryDate ?? (i as any).expirationDate
                if (!expDate) return false
                const d = expDate instanceof Date ? expDate : expDate?.toDate ? expDate.toDate() : new Date(expDate)
                return !isNaN(d.getTime()) && d > now && d <= sevenDays
              }).length

              if (outOfStockCount > 0 || lowStockCount > 0 || expiringCount > 0) {
                return (
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    {outOfStockCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        {outOfStockCount} Out of Stock
                      </span>
                    )}
                    {lowStockCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {lowStockCount} Low Stock
                      </span>
                    )}
                    {expiringCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-50 text-orange-600 border border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800">
                        <Clock className="h-3 w-3" />
                        {expiringCount} Expiring Soon
                      </span>
                    )}
                  </div>
                )
              }
              return null
            })()}

            {/* Table Header */}
            <div className="grid grid-cols-[2fr_1.4fr_1.2fr_0.9fr] gap-3 text-[11px] font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wider pb-3 border-b border-gray-100 dark:border-border">
              <div>Product Name</div>
              <div className="text-center">Expiration</div>
              <div className="text-center">Stock Status</div>
              <div className="text-right">Last Update</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-gray-50 dark:divide-border/50">
              {(() => {
                const { items, totalPages, totalItems } = getPaginatedStockItems()

                if (items.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="h-12 w-12 rounded-full bg-gray-50 dark:bg-secondary/50 flex items-center justify-center mb-3">
                        <AlertCircle className="h-5 w-5 text-gray-300" />
                      </div>
                      <p className="text-sm text-gray-400">No stock items to display</p>
                    </div>
                  )
                }

                return (
                  <>
                    {items.map((item, index) => {
                      const stockLeft = (item as any).stockLeft ?? 0
                      const maxStock = Math.max(stockLeft, (item as any).incoming ?? 10, 10)
                      const stockPercent = Math.min(100, Math.round((stockLeft / maxStock) * 100))

                      // Status badge logic
                      let statusLabel = "In Stock"
                      let statusColor = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                      let barColor = "bg-emerald-500"
                      let borderColor = "border-l-emerald-400"
                      if (stockLeft <= 0) {
                        statusLabel = "Out of Stock"
                        statusColor = "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
                        barColor = "bg-red-500"
                        borderColor = "border-l-red-400"
                      } else if (stockLeft <= 5) {
                        statusLabel = "Low Stock"
                        statusColor = "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
                        barColor = "bg-amber-500"
                        borderColor = "border-l-amber-400"
                      }

                      // Expiry logic
                      const rawExp = (item as any).expiryDate ?? (item as any).expirationDate
                      let expiryDisplay = "—"
                      let expiryIcon: React.ReactNode = null
                      let expiryStyle = "text-gray-400"
                      if (rawExp) {
                        const expDate = rawExp instanceof Date ? rawExp : rawExp?.toDate ? rawExp.toDate() : new Date(rawExp)
                        if (!isNaN(expDate.getTime())) {
                          const now = new Date()
                          const diffMs = expDate.getTime() - now.getTime()
                          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
                          if (diffDays < 0) {
                            expiryDisplay = "Expired"
                            expiryIcon = <AlertTriangle className="h-3 w-3 text-red-500" />
                            expiryStyle = "text-red-600 font-semibold dark:text-red-400"
                          } else if (diffDays <= 3) {
                            expiryDisplay = `${diffDays}d left`
                            expiryIcon = <AlertTriangle className="h-3 w-3 text-red-500" />
                            expiryStyle = "text-red-600 font-semibold dark:text-red-400"
                          } else if (diffDays <= 7) {
                            expiryDisplay = `${diffDays}d left`
                            expiryIcon = <Clock className="h-3 w-3 text-amber-500" />
                            expiryStyle = "text-amber-600 font-medium dark:text-amber-400"
                          } else if (diffDays <= 30) {
                            expiryDisplay = `${diffDays}d left`
                            expiryIcon = <Clock className="h-3 w-3 text-gray-400" />
                            expiryStyle = "text-gray-500"
                          } else {
                            expiryDisplay = formatExpDate(rawExp)
                            expiryStyle = "text-gray-500"
                          }
                        }
                      }

                      return (
                        <div
                          key={`stock-${item.id}-${index}`}
                          className={`grid grid-cols-[2fr_1.4fr_1.2fr_0.9fr] gap-3 py-3 items-center transition-all duration-200 hover:bg-blue-50/40 dark:hover:bg-secondary/30 hover:shadow-[0_1px_4px_rgba(0,0,0,0.04)] group border-l-[3px] ${borderColor} rounded-r-md -ml-px pl-3`}
                        >
                          {/* Product Name */}
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-gray-800 dark:text-foreground truncate leading-snug">
                              {(item as any).name ?? (item as any).itemName ?? item.category ?? "General"}
                            </p>
                            {item.subcategory && item.subcategory !== "N/A" && (
                              <p className="text-[11px] text-gray-400 dark:text-muted-foreground mt-0.5 truncate">
                                {item.subcategory}
                              </p>
                            )}
                          </div>

                          {/* Expiration — relative time with icon */}
                          <div className="flex items-center justify-center gap-1.5">
                            {expiryIcon}
                            <span className={`text-[13px] ${expiryStyle}`}>
                              {expiryDisplay}
                            </span>
                          </div>

                          {/* Stock Status — badge + progress bar */}
                          <div className="flex flex-col items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${statusColor}`}>
                              {statusLabel}
                              {stockLeft > 0 && (
                                <span className="font-bold text-[11px]">
                                  ({Math.ceil(stockLeft / 25)} box{Math.ceil(stockLeft / 25) !== 1 ? "es" : ""})
                                </span>
                              )}
                            </span>
                            {/* Progress bar */}
                            <div className="w-full max-w-[80px] h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                style={{ width: `${Math.max(stockLeft <= 0 ? 0 : 4, stockPercent)}%` }}
                              />
                            </div>
                          </div>

                          {/* Last Update */}
                          <div className="text-right text-[13px] text-gray-400 dark:text-muted-foreground">
                            {formatTimeAgo((item as any).updatedAt)}
                          </div>
                        </div>
                      )
                    })}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-4 mt-1">
                        <div className="text-xs text-gray-400 dark:text-muted-foreground">
                          Showing {items.length} of {totalItems}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setStockCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={stockCurrentPage === 1}
                            className="h-8 px-3 text-xs font-medium rounded-lg border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-secondary/50 disabled:opacity-40 transition-all"
                          >
                            <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                            Previous
                          </Button>
                          <div className="flex items-center gap-0.5 px-2.5 py-1 bg-gray-50 dark:bg-secondary/40 rounded-lg">
                            <span className="text-xs font-bold text-gray-700 dark:text-foreground">{stockCurrentPage}</span>
                            <span className="text-xs text-gray-300">/</span>
                            <span className="text-xs text-gray-400">{totalPages}</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setStockCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={stockCurrentPage === totalPages}
                            className="h-8 px-3 text-xs font-medium rounded-lg border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-secondary/50 disabled:opacity-40 transition-all"
                          >
                            Next
                            <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          </CardContent>
        </Card>

        {/* ──────── RIGHT: Recent Stock Movements ──────── */}
        <Card className="rounded-2xl border border-gray-100 dark:border-border bg-white dark:bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-0 px-6 pt-6">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-bold text-gray-900 dark:text-foreground mb-0.5">
                Recent Activity
              </CardTitle>
              <CardDescription className="text-sm text-gray-400 dark:text-muted-foreground">
                Latest stock movements with timestamps
              </CardDescription>
            </div>
            {!isReadOnly && (
              <Button
                asChild
                className="h-9 px-5 rounded-full bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm flex-shrink-0 transition-all hover:scale-[1.02] hover:shadow-md"
              >
                <Link href="/stock-logs">Track All</Link>
              </Button>
            )}
          </CardHeader>
          <CardContent className="px-6 pb-5 pt-4">
            {/* Movement Rows — Card Style */}
            <div className="space-y-2">
              {(() => {
                const { items, totalPages, totalItems } = getPaginatedMovements()

                if (items.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="h-12 w-12 rounded-full bg-gray-50 dark:bg-secondary/50 flex items-center justify-center mb-3">
                        <AlertCircle className="h-5 w-5 text-gray-300" />
                      </div>
                      <p className="text-sm text-gray-400">No recent stock movements</p>
                    </div>
                  )
                }

                return (
                  <>
                    {items.map((txn, index) => {
                      const dt = formatMovementDateTime(txn.transaction_date || txn.created_at)
                      const action = getMovementAction(txn)
                      const qty = getMovementQuantity(txn)
                      const unit = getMovementUnit(txn)
                      const typeLabel = getMovementTypeLabel(action)

                      return (
                        <div
                          key={`mvmt-${txn.id}-${index}`}
                          className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/60 dark:bg-secondary/20 border border-gray-100/60 dark:border-border/30 hover:bg-gray-100/60 dark:hover:bg-secondary/40 transition-all duration-200"
                        >
                          {/* IN / OUT indicator */}
                          <div className={`flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${action === "IN" ? "bg-emerald-100 dark:bg-emerald-950/40" :
                              action === "OUT" ? "bg-red-100 dark:bg-red-950/40" :
                                action === "GOOD RETURN" ? "bg-blue-100 dark:bg-blue-950/40" :
                                  "bg-gray-100 dark:bg-gray-800"
                            }`}>
                            {action === "IN" ? (
                              <ArrowDownCircle className="h-4 w-4 text-emerald-600" />
                            ) : action === "OUT" ? (
                              <ArrowUpCircle className="h-4 w-4 text-red-500" />
                            ) : action === "GOOD RETURN" ? (
                              <RefreshCw className="h-4 w-4 text-blue-500" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-gray-400" />
                            )}
                          </div>

                          {/* Product info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-foreground truncate leading-snug">
                              {txn.product_name || (txn as any).productName || (txn as any).name || (txn as any).category || "Unknown Product"}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-gray-400 dark:text-muted-foreground">
                                {dt.time && `${dt.time}`} · {dt.date}
                              </span>
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${typeLabel === "Restock" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" :
                                  typeLabel === "Usage" ? "bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400" :
                                    typeLabel === "Return" ? "bg-blue-50 text-blue-500 dark:bg-blue-950/30 dark:text-blue-400" :
                                      "bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                }`}>
                                {typeLabel}
                              </span>
                            </div>
                          </div>

                          {/* Action badge + qty */}
                          <div className="flex items-center gap-2.5 flex-shrink-0">
                            <ActionBadge action={action} />
                            <div className="text-right min-w-[50px]">
                              <span className="text-sm font-bold text-gray-800 dark:text-foreground">{qty}</span>
                              <span className="text-[11px] text-gray-400 ml-1">{unit}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-3 mt-1">
                        <div className="text-xs text-gray-400 dark:text-muted-foreground">
                          Showing {items.length} of {totalItems}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setMovementCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={movementCurrentPage === 1}
                            className="h-8 px-3 text-xs font-medium rounded-lg border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-secondary/50 disabled:opacity-40 transition-all"
                          >
                            <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                            Previous
                          </Button>
                          <div className="flex items-center gap-0.5 px-2.5 py-1 bg-gray-50 dark:bg-secondary/40 rounded-lg">
                            <span className="text-xs font-bold text-gray-700 dark:text-foreground">{movementCurrentPage}</span>
                            <span className="text-xs text-gray-300">/</span>
                            <span className="text-xs text-gray-400">{totalPages}</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setMovementCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={movementCurrentPage === totalPages}
                            className="h-8 px-3 text-xs font-medium rounded-lg border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-secondary/50 disabled:opacity-40 transition-all"
                          >
                            Next
                            <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
