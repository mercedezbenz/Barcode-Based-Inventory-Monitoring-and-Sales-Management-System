"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  TrendingUp, AlertCircle, X, ChevronLeft, ChevronRight,
  Zap, ShoppingCart, Clock, CheckCircle2, BanknoteIcon
} from "lucide-react"
import {
  TotalOrdersIcon,
  PendingOrdersIcon,
  CompletedOrdersIcon,
  RevenueIcon,
} from "./sales-dashboard-icons"
import { useOrders } from "@/hooks/useOrders"
import { useAuth } from "@/hooks/use-auth"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DashboardOverviewSkeleton } from "@/components/skeletons/dashboard-skeleton"

// ─── Mini sparkline bar chart for KPI cards (replicating existing TrendChart) ───
// ─── Mini sparkline bar chart for KPI cards (replicating existing TrendChart) ───
const SalesTrendChart = ({ type }: { type: "orders" | "pending" | "completed" }) => {
  const palettes: Record<string, { height: number; color: string }[]> = {
    orders: [
      { height: 25, color: "#93C5FD" },
      { height: 45, color: "#60A5FA" },
      { height: 35, color: "#3B82F6" },
      { height: 60, color: "#2563EB" },
      { height: 75, color: "#1D4ED8" },
    ],
    pending: [
      { height: 20, color: "#FDE68A" },
      { height: 40, color: "#FCD34D" },
      { height: 55, color: "#FBBF24" },
      { height: 45, color: "#F59E0B" },
      { height: 70, color: "#D97706" },
    ],
    completed: [
      { height: 30, color: "#6EE7B7" },
      { height: 50, color: "#34D399" },
      { height: 65, color: "#10B981" },
      { height: 55, color: "#059669" },
      { height: 80, color: "#047857" },
    ],
  }

  const bars = palettes[type] || palettes.orders

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

// ─── Status badge component for orders ───
const StatusBadge = ({ status }: { status: string }) => {
  let label = status
  let className = "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase "

  switch (status) {
    case "pending":
      label = "Pending"
      className += "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
      break
    case "delivered":
    case "completed":
      label = "Completed"
      className += "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
      break
    case "cancelled":
      label = "Cancelled"
      className += "bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
      break
    default:
      className += "bg-gray-50 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-400"
  }

  return <span className={className}>{label}</span>
}

// ─── Helper: Parse Firestore dates ───
const parseDate = (d: any): Date | null => {
  if (!d) return null
  if (typeof d === "string") return new Date(d)
  if (d instanceof Date) return d
  if (d && typeof d.toDate === "function") return d.toDate()
  if (d && d.seconds) return new Date(d.seconds * 1000)
  return null
}

// ─── Helper: Check if date is today ───
const isToday = (date: Date | null): boolean => {
  if (!date) return false
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

// ─── Helper: Format time ago ───
const formatTimeAgo = (date: any): string => {
  const dateObj = parseDate(date)
  if (!dateObj || isNaN(dateObj.getTime())) return "N/A"

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

// ─── Helper: Format time ───
const formatTime = (date: any): string => {
  const dateObj = parseDate(date)
  if (!dateObj || isNaN(dateObj.getTime())) return "N/A"

  return dateObj.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

// ─── Helper: Format currency ───
const formatCurrency = (amount: number): string => {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function SalesDashboard() {
  const { user, firebaseError, isReadOnly } = useAuth()
  const { orders, loading } = useOrders()

  // Pagination for recent orders table
  const [ordersCurrentPage, setOrdersCurrentPage] = useState(1)
  const ORDERS_PER_PAGE = 6

  // ─── Computed: Today's orders ───
  const todayOrders = useMemo(() => {
    return orders.filter((order) => {
      const createdAt = parseDate(order.createdAt)
      return isToday(createdAt)
    })
  }, [orders])

  // ─── Computed: KPI Stats ───
  const stats = useMemo(() => {
    const totalOrdersToday = todayOrders.length
    const completedOrders = orders.filter((o) => o.status === "completed" || o.status === "delivered").length
    const cancelledOrders = orders.filter((o) => o.status === "cancelled").length
    // Group all active statuses under "pendingOrders" for the dashboard KPIs
    const pendingOrders = orders.length - completedOrders - cancelledOrders

    return { totalOrdersToday, pendingOrders, completedOrders }
  }, [orders, todayOrders])

  // ─── Computed: All orders (newest first — already sorted by hook) ───
  const recentOrders = useMemo(() => {
    return orders // Removed .slice(0, 10) to allow full dataset pagination
  }, [orders])

  // ─── Pagination ───
  const getPaginatedOrders = () => {
    const totalItems = recentOrders.length
    const totalPages = Math.max(1, Math.ceil(totalItems / ORDERS_PER_PAGE))
    const startIndex = (ordersCurrentPage - 1) * ORDERS_PER_PAGE
    const endIndex = Math.min(startIndex + ORDERS_PER_PAGE, totalItems)

    return {
      items: recentOrders.slice(startIndex, endIndex),
      totalPages,
      totalItems,
    }
  }

  // ─── Computed: Sales Insights ───
  const insights = useMemo(() => {
    const result: { icon: React.ReactNode; message: string; priority: number; category: "Info" | "Warning" }[] = []

    // New orders today
    if (todayOrders.length > 0) {
      result.push({
        icon: <div className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/20" />,
        message: `${todayOrders.length} new order${todayOrders.length === 1 ? "" : "s"} received today.`,
        priority: 1,
        category: "Info",
      })
    }

    // Pending orders needing attention
    const pendingCount = orders.filter((o) => o.status === "pending").length
    if (pendingCount > 0) {
      result.push({
        icon: <div className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/20" />,
        message: `${pendingCount} pending order${pendingCount === 1 ? "" : "s"} need${pendingCount === 1 ? "s" : ""} attention.`,
        priority: 2,
        category: "Warning",
      })
    }

    // Completed orders today
    const completedToday = todayOrders.filter((o) => o.status === "completed" || o.status === "delivered").length
    if (completedToday > 0) {
      result.push({
        icon: <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/20" />,
        message: `${completedToday} order${completedToday === 1 ? "" : "s"} completed today.`,
        priority: 4,
        category: "Info",
      })
    }

    // Cancelled orders today
    const cancelledToday = todayOrders.filter((o) => o.status === "cancelled").length
    if (cancelledToday > 0) {
      result.push({
        icon: <div className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/20" />,
        message: `${cancelledToday} order${cancelledToday === 1 ? "" : "s"} cancelled today.`,
        priority: 5,
        category: "Warning",
      })
    }

    // No orders yet
    if (orders.length === 0) {
      result.push({
        icon: <div className="h-2.5 w-2.5 rounded-full bg-gray-400 shadow-sm" />,
        message: "No orders have been placed yet. Waiting for first customer order.",
        priority: 10,
        category: "Info",
      })
    }

    return result.sort((a, b) => a.priority - b.priority).slice(0, 8)
  }, [orders, todayOrders])

  // ─── Notification banner state ───
  const [showPendingBanner, setShowPendingBanner] = useState(true)
  const hasPendingOrders = stats.pendingOrders > 0

  // ─── Error state ───
  if (firebaseError) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Firebase Setup Required:</strong> Please configure your Firebase project to access sales dashboard
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
      {/* Alert Banner — Pending Orders */}
      {hasPendingOrders && showPendingBanner && (
        <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-orange-950/40 dark:to-amber-950/40 border border-amber-200/60 dark:border-orange-800 px-5 py-3.5 shadow-sm animate-in slide-in-from-top-2 duration-300">
          <div className="flex-shrink-0 h-9 w-9 rounded-xl bg-white dark:bg-orange-900 flex items-center justify-center shadow-sm">
            <Clock className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
          </div>
          <span className="text-sm text-gray-800 dark:text-orange-200">
            <strong className="font-semibold">Pending Orders:</strong>{" "}
            {stats.pendingOrders} order{stats.pendingOrders === 1 ? "" : "s"} require immediate attention.
          </span>
          <div className="flex-1"></div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowPendingBanner(false)}
            className="h-8 w-8 p-0 rounded-full text-gray-400 hover:text-gray-600 hover:bg-orange-100 dark:hover:bg-orange-900 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Page Header */}
      <div>
        <h1 className="text-[28px] font-bold text-gray-900 dark:text-foreground leading-tight tracking-[-0.01em]">
          Sales Dashboard
        </h1>
        <p className="text-gray-400 dark:text-muted-foreground text-[13px] mt-1 tracking-wide">
          Monitor customer orders in real time
        </p>
      </div>

      {/* ─── KPI Summary Cards ─── */}
      <div className="grid gap-5 grid-cols-2 lg:grid-cols-3">
        {/* Total Orders Today */}
        <Card className="rounded-2xl border border-gray-100 dark:border-border bg-white dark:bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wide">
              Orders Today
            </CardTitle>
            <TotalOrdersIcon />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold text-gray-900 dark:text-foreground leading-none mb-2">
                  {stats.totalOrdersToday}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30">
                    <ShoppingCart className="h-3 w-3 text-blue-500" />
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">today</span>
                  </div>
                  <span className="text-xs text-gray-400">all channels</span>
                </div>
              </div>
              <SalesTrendChart type="orders" />
            </div>
          </CardContent>
        </Card>

        {/* Pending Orders */}
        <Card className="rounded-2xl border border-gray-100 dark:border-border bg-white dark:bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wide">
              Pending Orders
            </CardTitle>
            <PendingOrdersIcon />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold text-amber-500 leading-none mb-2">
                  {stats.pendingOrders}
                </div>
                <div className="flex items-center gap-1.5">
                  {stats.pendingOrders > 0 ? (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30">
                      <AlertCircle className="h-3 w-3 text-amber-500" />
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">action needed</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">all clear</span>
                    </div>
                  )}
                </div>
              </div>
              <SalesTrendChart type="pending" />
            </div>
          </CardContent>
        </Card>

        {/* Completed Orders */}
        <Card className="rounded-2xl border border-gray-100 dark:border-border bg-white dark:bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wide">
              Completed
            </CardTitle>
            <CompletedOrdersIcon />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold text-emerald-500 leading-none mb-2">
                  {stats.completedOrders}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">total</span>
                  </div>
                  <span className="text-xs text-gray-400">all time</span>
                </div>
              </div>
              <SalesTrendChart type="completed" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Recent Orders + Sales Insights (same grid as Donut + Insights) ─── */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* ──── LEFT: Recent Orders Table (3 cols) ──── */}
        <Card className="lg:col-span-3 rounded-2xl border border-gray-100 dark:border-border bg-white dark:bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-0 px-6 pt-6">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-bold text-gray-900 dark:text-foreground mb-0.5">
                Recent Orders
              </CardTitle>
              <CardDescription className="text-sm text-gray-400 dark:text-muted-foreground">
                Latest 10 customer orders — newest first
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-5 pt-4">

            {/* Summary Bar */}
            {(() => {
              const completedCount = recentOrders.filter(o => o.status === "completed" || o.status === "delivered").length
              const cancelledCount = recentOrders.filter(o => o.status === "cancelled").length
              // Any order that is not completed or cancelled is active/pending
              const pendingCount = recentOrders.length - completedCount - cancelledCount

              if (pendingCount > 0 || completedCount > 0 || cancelledCount > 0) {
                return (
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    {completedCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {completedCount} Completed
                      </span>
                    )}
                    {pendingCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        {pendingCount} Pending
                      </span>
                    )}
                    {cancelledCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        {cancelledCount} Cancelled
                      </span>
                    )}
                  </div>
                )
              }
              return null
            })()}

            {/* Table Header */}
            <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr] gap-3 text-[11px] font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wider pb-3 border-b border-gray-100 dark:border-border">
              <div>Customer Name</div>
              <div className="text-center">Phone</div>
              <div className="text-center">Status</div>
              <div className="text-right">Time</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-gray-50 dark:divide-border/50">
              {(() => {
                const { items, totalPages, totalItems } = getPaginatedOrders()

                if (items.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="h-12 w-12 rounded-full bg-gray-50 dark:bg-secondary/50 flex items-center justify-center mb-3">
                        <ShoppingCart className="h-5 w-5 text-gray-300" />
                      </div>
                      <p className="text-sm text-gray-400">No orders yet</p>
                      <p className="text-xs text-gray-300 mt-1">New orders will appear here in real time</p>
                    </div>
                  )
                }

                return (
                  <>
                    {items.map((order, index) => {
                      // Determine left border color based on status
                      let borderColor = "border-l-gray-300"
                      if (order.status === "pending") borderColor = "border-l-amber-400"
                      else if (order.status === "completed" || order.status === "delivered") borderColor = "border-l-emerald-400"
                      else if (order.status === "cancelled") borderColor = "border-l-red-400"

                      // Highlight pending/active rows
                      const isPending = order.status !== "completed" && order.status !== "delivered" && order.status !== "cancelled"

                      return (
                        <div
                          key={`order-${order.id}-${index}`}
                          className={`grid grid-cols-[2fr_1.5fr_1fr_1fr] gap-3 py-3 items-center transition-all duration-200 hover:bg-blue-50/40 dark:hover:bg-secondary/30 hover:shadow-[0_1px_4px_rgba(0,0,0,0.04)] group border-l-[3px] ${borderColor} rounded-r-md -ml-px pl-3 ${isPending ? "bg-amber-50/20 dark:bg-amber-950/10" : ""}`}
                        >
                          {/* Customer Name */}
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-gray-800 dark:text-foreground truncate leading-snug">
                              {order.customerName}
                            </p>
                            <p className="text-[11px] text-gray-400 dark:text-muted-foreground mt-0.5 truncate">
                              {order.items?.length || 0} item{(order.items?.length || 0) === 1 ? "" : "s"}: {
                                order.items?.slice(0, 2).map(i => `${i.name} (${i.quantity} ${i.unit || "unit"})`).join(", ")
                              }{order.items?.length > 2 ? "..." : ""}
                            </p>
                          </div>

                          {/* Phone Number */}
                          <div className="text-center text-sm text-gray-500 dark:text-foreground/70 truncate">
                            {order.customerPhone || "N/A"}
                          </div>

                          {/* Status Badge */}
                          <div className="flex justify-center">
                            <StatusBadge status={order.status} />
                          </div>

                          {/* Time */}
                          <div className="text-right text-[13px] text-gray-400 dark:text-muted-foreground">
                            {formatTimeAgo(order.createdAt)}
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
                            onClick={() => setOrdersCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={ordersCurrentPage === 1}
                            className="h-8 px-3 text-xs font-medium rounded-lg border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-secondary/50 disabled:opacity-40 transition-all"
                          >
                            <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                            Previous
                          </Button>
                          <div className="flex items-center gap-0.5 px-2.5 py-1 bg-gray-50 dark:bg-secondary/40 rounded-lg">
                            <span className="text-xs font-bold text-gray-700 dark:text-foreground">{ordersCurrentPage}</span>
                            <span className="text-xs text-gray-300">/</span>
                            <span className="text-xs text-gray-400">{totalPages}</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setOrdersCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={ordersCurrentPage === totalPages}
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

        {/* ──── RIGHT: Sales Insights (2 cols) ──── */}
        <Card className="lg:col-span-2 rounded-2xl border border-gray-100 dark:border-border bg-white dark:bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300 overflow-hidden">
          <CardHeader className="px-6 pt-6 pb-2">
            <CardTitle className="text-lg font-bold text-gray-900 dark:text-foreground flex items-center gap-2">
              <Zap className="h-5 w-5 text-sky-500" />
              Sales Insights
            </CardTitle>
            <CardDescription className="text-sm text-gray-400 dark:text-muted-foreground">
              Smart recommendations based on current order status
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {insights.length > 0 ? (
              <div className="space-y-6 max-h-[340px] overflow-y-auto pr-1">
                {(["Warning", "Info"] as const).map((category) => {
                  const categoryInsights = insights.filter((i) => i.category === category)
                  if (categoryInsights.length === 0) return null

                  return (
                    <div key={category} className="space-y-3">
                      <h4 className="text-[11px] font-bold text-gray-400 dark:text-muted-foreground uppercase tracking-widest pl-1">
                        {category === "Warning" ? "Needs Attention" : "Overview"}
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
                <p className="text-sm font-medium text-gray-700 dark:text-foreground">All caught up!</p>
                <p className="text-xs text-gray-400 mt-1">No pending actions at this time</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
