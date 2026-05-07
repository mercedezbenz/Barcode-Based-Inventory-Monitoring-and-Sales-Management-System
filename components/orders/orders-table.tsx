"use client"

import { useState, useMemo, useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Search, ChevronLeft, ChevronRight, Eye, ShoppingCart,
  Filter, Package, Clock, CheckCircle2, XCircle, TrendingUp,
} from "lucide-react"
import { useOrders, type Order } from "@/hooks/useOrders"

// ─── Helpers ───
const parseDate = (d: any): Date | null => {
  if (!d) return null
  if (typeof d === "string") return new Date(d)
  if (d instanceof Date) return d
  if (d?.toDate) return d.toDate()
  if (d?.seconds) return new Date(d.seconds * 1000)
  return null
}

const formatDate = (d: any): string => {
  const date = parseDate(d)
  if (!date || isNaN(date.getTime())) return "N/A"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const formatTime = (d: any): string => {
  const date = parseDate(d)
  if (!date || isNaN(date.getTime())) return ""
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
}

// ─── Status Badge ───
const StatusBadge = ({ status }: { status: string }) => {
  let cls = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide "
  let icon = null

  switch (status) {
    case "pending":
      cls += "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
      icon = <Clock className="h-3 w-3" />
      break
    case "delivered":
    case "completed":
      cls += "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
      icon = <CheckCircle2 className="h-3 w-3" />
      break
    case "cancelled":
      cls += "bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
      icon = <XCircle className="h-3 w-3" />
      break
    default:
      cls += "bg-gray-50 text-gray-600 border border-gray-200"
  }

  return <span className={cls}>{icon}{status.charAt(0).toUpperCase() + status.slice(1)}</span>
}

type StatusFilter = "all" | "pending" | "completed" | "cancelled"

export function OrdersTable() {
  const formatAddress = (addr: any) => {
  if (!addr) return "—"

  return [
    addr.street,
    addr.barangay,
    addr.city,
    addr.province,
    addr.postalCode,
  ]
    .filter(Boolean)
    .join(", ")
}
  const { orders, loading } = useOrders()
  const router = useRouter()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 8

  // ─── Stats ───
  const stats = useMemo(() => {
    const total = orders.length
    const completed = orders.filter(o => o.status === "completed" || (o.status as string) === "delivered").length
    const cancelled = orders.filter(o => o.status === "cancelled").length
    // Group all other active statuses (pending, processing, in_production, etc.) under "pending"
    const pending = total - completed - cancelled
    return { total, pending, completed, cancelled }
  }, [orders])

  // ─── Filtered + Searched ───
  const filteredOrders = useMemo(() => {
    // Normalize and resolve missing fields
    const normalized = orders.map(o => ({
      ...o,
      customerPhone: o.customerPhone && o.customerPhone !== "N/A" ? o.customerPhone : "",
    }))

    let result = normalized
    if (statusFilter !== "all") {
      result = result.filter(o => {
        if (statusFilter === "completed") return o.status === "completed" || (o.status as string) === "delivered"
        if (statusFilter === "cancelled") return o.status === "cancelled"
        // If "pending" is selected, show all active orders (not completed, not cancelled)
        if (statusFilter === "pending") {
          return o.status !== "completed" && (o.status as string) !== "delivered" && o.status !== "cancelled"
        }
        return o.status === statusFilter
      })
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(o =>
        (o.customerName || "").toLowerCase().includes(q) ||
        (o.customerPhone || "").toLowerCase().includes(q) ||
        (o.customerAddress || "").toLowerCase().includes(q)
      )
    }
    return result
  }, [orders, statusFilter, search])

  // ─── Pagination ───
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ITEMS_PER_PAGE))
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  )

  // Reset page when filter/search changes
  useEffect(() => { setCurrentPage(1) }, [statusFilter, search])

  if (loading) {
    return (
      <div className="space-y-6 pb-8 animate-in fade-in duration-300">
        <div><div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" /><div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (<Card key={i} className="rounded-2xl"><CardHeader className="pb-2 pt-5 px-5"><div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></CardHeader><CardContent className="px-5 pb-5"><div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></CardContent></Card>))}
        </div>
        <Card className="rounded-2xl"><CardContent className="p-6">{[...Array(5)].map((_, i) => (<div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse mb-2" />))}</CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-[28px] font-bold text-gray-900 dark:text-foreground leading-tight tracking-[-0.01em]">
          Orders Management
        </h1>
        <p className="text-gray-400 dark:text-muted-foreground text-[13px] mt-1 tracking-wide">
          View and manage all customer orders
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {/* Total Orders */}
        <Card className="rounded-2xl border border-gray-100 dark:border-border bg-white dark:bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-5 pt-5">
            <CardTitle className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Orders</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
              <Package className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-2xl font-bold text-gray-900 dark:text-foreground">{stats.total}</div>
          </CardContent>
        </Card>

        {/* Pending */}
        <Card className="rounded-2xl border border-gray-100 dark:border-border bg-white dark:bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-5 pt-5">
            <CardTitle className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pending</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-2xl font-bold text-amber-500">{stats.pending}</div>
          </CardContent>
        </Card>

        {/* Completed */}
        <Card className="rounded-2xl border border-gray-100 dark:border-border bg-white dark:bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-5 pt-5">
            <CardTitle className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Completed</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-2xl font-bold text-emerald-500">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table Card */}
      <Card className="rounded-2xl border border-gray-100 dark:border-border bg-white dark:bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <CardHeader className="px-6 pt-6 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-gray-900 dark:text-foreground">All Orders</CardTitle>
              <CardDescription className="text-sm text-gray-400 mt-0.5">
                {filteredOrders.length} order{filteredOrders.length === 1 ? "" : "s"} found
              </CardDescription>
            </div>
          </div>

          {/* Search + Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, email, or address..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-lg border-gray-200 dark:border-border bg-gray-50/50 dark:bg-secondary/30 text-sm"
              />
            </div>

            {/* Status filter pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="h-4 w-4 text-gray-400 mr-1 hidden sm:block" />
              {(["all", "pending", "completed", "cancelled"] as StatusFilter[]).map((s) => {
                const isActive = s === statusFilter
                let pillClass = "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border cursor-pointer "
                if (isActive) {
                  switch (s) {
                    case "pending": pillClass += "bg-amber-500 text-white border-amber-500 shadow-sm"; break
                    case "completed": pillClass += "bg-emerald-500 text-white border-emerald-500 shadow-sm"; break
                    case "cancelled": pillClass += "bg-red-500 text-white border-red-500 shadow-sm"; break
                    default: pillClass += "bg-sky-500 text-white border-sky-500 shadow-sm"
                  }
                } else {
                  pillClass += "bg-white dark:bg-secondary/20 text-gray-500 border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-secondary/40"
                }
                return (
                  <button key={s} onClick={() => setStatusFilter(s)} className={pillClass}>
                    {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                )
              })}
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-5 pt-0">
          {/* Scrollable table wrapper for responsive display */}
          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[1350px] border-separate border-spacing-x-4 border-spacing-y-0">
              <thead>
                <tr className="text-[11px] font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wider bg-gray-50/50 dark:bg-secondary/10">
                  <th className="px-4 py-4 text-left font-bold border-b border-gray-100 dark:border-border w-[180px]">Customer</th>
                  <th className="px-4 py-4 text-left font-bold border-b border-gray-100 dark:border-border w-[140px]">Phone</th>
                  <th className="px-4 py-4 text-left font-bold border-b border-gray-100 dark:border-border w-[260px]">Address</th>
                  <th className="px-6 py-4 text-left font-bold border-b border-gray-100 dark:border-border w-[320px]">Products</th>
                  <th className="px-4 py-4 text-center font-bold border-b border-gray-100 dark:border-border w-[100px]">Unit</th>
                  <th className="px-4 py-4 text-center font-bold border-b border-gray-100 dark:border-border w-[120px]">Status</th>
                  <th className="px-4 py-4 text-center font-bold border-b border-gray-100 dark:border-border w-[140px]">Date</th>
                  <th className="px-4 py-4 text-right font-bold border-b border-gray-100 dark:border-border w-[100px] pr-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-border/50">
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-24 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="h-16 w-16 rounded-full bg-gray-50 dark:bg-secondary/50 flex items-center justify-center mb-4">
                          <ShoppingCart className="h-7 w-7 text-gray-300" />
                        </div>
                        <p className="text-base font-semibold text-gray-500">
                          {orders.length === 0 ? "No orders yet" : "No orders found"}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          {search || statusFilter !== "all" ? "Try adjusting your filters" : "Orders will appear here once created"}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => {
                    let borderColor = "border-l-gray-200"
                    if (order.status === "pending") borderColor = "border-l-amber-400"
                    else if (order.status === "completed" || (order.status as string) === "delivered") borderColor = "border-l-emerald-400"
                    else if (order.status === "cancelled") borderColor = "border-l-red-400"

                    return (
                      <tr
                        key={order.id}
                        className="group transition-all duration-200 hover:bg-blue-50/40 dark:hover:bg-secondary/20 cursor-pointer"
                        onClick={() => router.push(`/orders/details?id=${order.id}`)}
                      >
                        {/* Customer Info */}
                        <td className={`px-4 py-4 align-top border-l-[4px] ${borderColor}`}>
                          <p className="font-medium text-[14px] text-gray-900 dark:text-foreground truncate">{order.customerName}</p>
                        </td>

                        {/* Phone Number */}
                        <td className="px-4 py-4 align-top">
                          <p className="text-[13px] text-gray-500 dark:text-foreground/70 truncate">{order.customerPhone || "—"}</p>
                        </td>

                        {/* Address */}
                        <td className="px-4 py-4 pr-6 align-top max-w-[260px]">
                          <div className="flex gap-2 items-start text-[13px] text-gray-600 dark:text-gray-400 leading-snug line-clamp-2" title={order.customerAddress}>
                            <span className="shrink-0 mt-0.5 text-xs opacity-70">📍</span>
                            <span>
  {formatAddress(order.shippingAddress) || "—"}
</span>
                          </div>
                        </td>

                        {/* Products */}
                        <td className="px-6 py-4 pl-6 align-top max-w-[320px]">
                          {order.items && order.items.length > 0 ? (
                            <div className="space-y-2">
                              {order.items.slice(0, 3).map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3 hover:scale-[1.02] transition-transform group/item">
                                  <Image
                                    src={item.imageUrl || "/placeholder.png"}
                                    alt={item.name}
                                    width={32}
                                    height={32}
                                    className="w-8 h-8 rounded-md object-cover border border-gray-200 dark:border-border bg-gray-50/50 shadow-sm shrink-0"
                                  />
                                  <div className="text-[13px] text-gray-700 dark:text-foreground/80 leading-tight line-clamp-2">
                                    <span className="font-medium">{item.name}</span> 
                                  </div>
                                </div>
                              ))}
                              {order.items.length > 3 && (
                                <p className="text-[11px] text-blue-500 font-medium italic mt-1 pl-11">
                                  +{order.items.length - 3} more items
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-[13px] text-gray-400 italic">No items</p>
                          )}
                        </td>

                        {/* Unit Column */}
                        <td className="px-4 py-4 align-top text-center">
                          {order.items && order.items.length > 0 ? (
                            <div className="space-y-1">
                              {order.items.slice(0, 3).map((item, idx) => (
                                <p key={idx} className="text-[13px] text-gray-500 font-medium truncate">
                                  {item.unit ? item.unit.charAt(0).toUpperCase() + item.unit.slice(1).toLowerCase() : "—"}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[13px] text-gray-400">—</p>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4 align-top text-center">
                          <div className="flex justify-center">
                            <StatusBadge status={order.status} />
                          </div>
                        </td>

                        {/* Date */}
                        <td className="px-4 py-4 align-top text-center">
                          <p className="text-[13px] font-medium text-gray-700 dark:text-foreground">{formatDate(order.createdAt)}</p>
                          <p className="text-[11px] text-gray-400 mt-1">{formatTime(order.createdAt)}</p>
                        </td>

                        {/* Action */}
                        <td className="px-4 py-4 align-top text-right pr-6">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/orders/details?id=${order.id}`)}
                            }
                            className="h-8 px-3 text-xs font-medium rounded-lg border-gray-200 dark:border-border hover:bg-sky-50 hover:border-sky-300 hover:text-sky-600 dark:hover:bg-sky-950/30 transition-all"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            View
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-gray-100 dark:border-border">
              <div className="text-xs text-gray-400">
                Showing {paginatedOrders.length} of {filteredOrders.length}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 px-3 text-xs font-medium rounded-lg"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-0.5" /> Previous
                </Button>
                <div className="flex items-center gap-0.5 px-2.5 py-1 bg-gray-50 dark:bg-secondary/40 rounded-lg">
                  <span className="text-xs font-bold text-gray-700 dark:text-foreground">{currentPage}</span>
                  <span className="text-xs text-gray-300">/</span>
                  <span className="text-xs text-gray-400">{totalPages}</span>
                </div>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 px-3 text-xs font-medium rounded-lg"
                >
                  Next <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
