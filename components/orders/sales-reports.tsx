"use client"

import { useState, useRef } from "react"
import { useSalesReports, computeTotalKg, computeTotalAmount, computeProductSummary } from "@/hooks/useSalesReports"
import { auth } from "@/lib/firebase-live"
import { logActivity } from "@/lib/activity-logger"
import { AuthLoadingSkeleton } from "@/components/skeletons/dashboard-skeleton"
import {
  Search, FileText, Calendar, Download, Printer, RotateCcw,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  TrendingUp, Package, Clock, CheckCircle2, XCircle, Award,
  ChevronsLeft, ChevronsRight, Filter, Truck
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Cell, PieChart, Pie, Legend
} from "recharts"

// ─── Constants & Types ───────────────────────────────────────────────────────
const CHART_COLORS = ["#0ea5e9", "#38bdf8", "#0284c7", "#7dd3fc", "#06b6d4", "#22d3ee", "#0891b2", "#155e75"]
const STATUS_COLORS: Record<string, string> = {
  Pending: "#f59e0b",
  Processing: "#3b82f6",
  "On Delivery": "#8b5cf6",
  Completed: "#10b981",
  Cancelled: "#ef4444",
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)
}

function formatDateDisplay(d: Date | null) {
  if (!d) return "—"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// ─── PDF Export (Mock for now, needs proper jsPDF implementation) ────────────
async function exportSalesPDF(
  allOrders: any[],
  summary: any,
  startDate: Date | null,
  endDate: Date | null
) {
  const { default: jsPDF } = await import("jspdf")
  const autoTable = (await import("jspdf-autotable")).default
  const doc = new jsPDF({ orientation: "landscape" })

  doc.setFontSize(18)
  doc.setTextColor(14, 165, 233)
  doc.text("DecktaGo — Sales Report", 14, 18)

  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  const rangeStr = startDate && endDate
    ? `${startDate.toLocaleDateString()} — ${endDate.toLocaleDateString()}`
    : "All Time"
  doc.text(`Date Range: ${rangeStr}`, 14, 26)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32)

  doc.setFontSize(11)
  doc.setTextColor(30, 30, 30)
doc.text(`Total Revenue: PHP ${summary.totalRevenue.toFixed(2)}`, 14, 42)
  doc.text(`Total Orders: ${summary.totalOrders}`, 100, 42)
  doc.text(`Completed Orders: ${summary.completed}`, 180, 42)

  const rows = allOrders.map(o => [
    o.id.slice(-8),
    o.customerName || "—",
    computeProductSummary(o),
    `${computeTotalKg(o).toFixed(1)} KG`,
  `PHP ${computeTotalAmount(o).toFixed(2)}`,
    o.status.toUpperCase(),
    formatDateDisplay(o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt))
  ])

  autoTable(doc, {
    startY: 54,
    head: [["Order ID", "Customer", "Products", "Total KG", "Total Amount", "Status", "Date"]],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [14, 165, 233], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  })

  doc.save(`DecktaGo_Sales_Report_${new Date().toISOString().slice(0, 10)}.pdf`)
  
  if (auth.currentUser) {
    logActivity({
      type: "reports exported",
      message: `Exported Sales Report PDF with ${allOrders.length} orders`,
      performedBy: auth.currentUser.displayName || auth.currentUser.email || "Owner/Admin",
      role: "owner"
    })
  }
}

// ─── Status Badge Component ──────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  let classes = "px-2.5 py-1 text-[11px] font-bold rounded-full border flex items-center gap-1.5 w-fit "
  let icon = null

  if (s === "pending") {
    classes += "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400"
    icon = <Clock className="h-3 w-3" />
  } else if (s === "processing" || s === "ready_for_processing" || s === "in_production") {
    classes += "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400"
    icon = <Package className="h-3 w-3" />
  } else if (s === "on_delivery" || s === "ready_for_delivery") {
    classes += "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400"
    icon = <Truck className="h-3 w-3" />
  } else if (s === "completed" || s === "delivered") {
    classes += "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400"
    icon = <CheckCircle2 className="h-3 w-3" />
  } else if (s === "cancelled") {
    classes += "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400"
    icon = <XCircle className="h-3 w-3" />
  } else {
    classes += "bg-gray-50 text-gray-700 border-gray-200"
  }

  return (
    <div className={classes}>
      {icon}
      {status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
    </div>
  )
}

// ─── Main Dashboard Component ────────────────────────────────────────────────
export function SalesReports() {
  const {
    loading,
    orders,
    allFilteredOrders,
    summary,
    weeklyRevenueData,
    statusDistribution,
    topProductsData,
    monthlyTrendData,
    customerAnalytics,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    categoryFilter, setCategoryFilter,
    startDate, setStartDate,
    endDate, setEndDate,
    setToday, setThisWeek, setThisMonth, resetFilters,
    sortField, sortDir, toggleSort,
    page, setPage, totalPages, totalResults,
    pageSize, setPageSize, pageSizeOptions,
    paginationStart, paginationEnd,
    parseTimestamp
  } = useSalesReports()

  const reportRef = useRef<HTMLDivElement>(null)

  if (loading) return <AuthLoadingSkeleton />

  const formatDate = (d: Date | null) => d ? d.toISOString().slice(0, 10) : ""

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
  }

  const handlePrint = () => window.print()

  return (
    <div ref={reportRef} className="max-w-[1600px] mx-auto space-y-8 pb-8 animate-in fade-in duration-500" id="sales-reports">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-gray-900 dark:text-foreground leading-tight tracking-[-0.01em] flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 hover:scale-110 transition-transform duration-300">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            Sales & Analytics
          </h1>
          <p className="text-gray-400 dark:text-muted-foreground text-[13px] mt-1 tracking-wide">
            Monitor revenue, track order performance, and analyze business insights.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="gap-2 text-xs font-semibold rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:shadow-sm transition-all duration-200"
            onClick={() => exportSalesPDF(allFilteredOrders, summary, startDate, endDate)}
          >
            <Download className="h-3.5 w-3.5" /> Export PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 text-xs font-semibold rounded-xl hover:shadow-sm transition-all duration-200"
            onClick={handlePrint}
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
      icon={<Package className="h-5 w-5 text-indigo-600" />}
      label="Total Revenue"
          value={formatCurrency(summary.totalRevenue)}
          color="indigo"
        />
        <KPICard
          icon={<Package className="h-5 w-5 text-blue-600" />}
          label="Total Orders"
          value={summary.totalOrders.toString()}
          color="blue"
        />
        <KPICard
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          label="Pending Orders"
          value={summary.pending.toString()}
          color="amber"
        />
        <KPICard
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          label="Completed Orders"
          value={summary.completed.toString()}
          color="emerald"
        />
        <KPICard
          icon={<Award className="h-5 w-5 text-purple-600" />}
          label="Top Selling (KG)"
          value={summary.topProduct?.name || "—"}
          sub={summary.topProduct ? `${summary.topProduct.kg.toFixed(1)} kg` : undefined}
          color="purple"
        />
        <KPICard
          icon={<TrendingUp className="h-5 w-5 text-sky-600" />}
          label="Revenue This Week"
          value={formatCurrency(summary.revenueThisWeek)}
          color="sky"
        />
      </div>

      {/* ── Charts Section ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Revenue Bar Chart */}
        <div className="bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="mb-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-foreground">Weekly Revenue</h3>
            <p className="text-xs text-gray-500">Sales performance from Monday to Sunday</p>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyRevenueData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(value) => `₱${value/1000}k`} />
                <Tooltip
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(val: number) => [formatCurrency(val), "Revenue"]}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {weeklyRevenueData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.label === 'Sun' ? '#818cf8' : '#4f46e5'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Order Status Distribution Donut */}
        <div className="bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="mb-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-foreground">Order Status Distribution</h3>
            <p className="text-xs text-gray-500">Breakdown of all active and completed orders</p>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#cbd5e1'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Trend Line Chart */}
        <div className="bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="mb-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-foreground">Monthly Sales Trend</h3>
            <p className="text-xs text-gray-500">Revenue growth over time</p>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(value) => `₱${value/1000}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(val: number) => [formatCurrency(val), "Revenue"]}
                />
                <Area type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Selling Products Bar Chart */}
        <div className="bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="mb-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-foreground">Top Products by Volume (KG)</h3>
            <p className="text-xs text-gray-500">Highest moving products</p>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProductsData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} width={120} />
                <Tooltip
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(val: number) => [`${val} kg`, "Volume"]}
                />
                <Bar dataKey="kg" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {topProductsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Table Section ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl shadow-sm overflow-hidden">
        
        {/* Filter Toolbar */}
        <div className="p-5 border-b border-gray-100 dark:border-border space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            
            {/* Search */}
            <div className="relative flex-1 min-w-[240px]">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Order ID, Customer, Product..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-secondary/30 border border-gray-200 dark:border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-gray-800 dark:text-foreground"
                />
              </div>
            </div>

            {/* Product Category */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Category</label>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <select
                  value={categoryFilter}
                  onChange={(e) => { setCategoryFilter(e.target.value as any); setPage(1) }}
                  className="pl-9 pr-8 py-2 bg-gray-50 dark:bg-secondary/30 border border-gray-200 dark:border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-gray-800 dark:text-foreground appearance-none min-w-[130px] cursor-pointer"
                >
                  <option value="all">All Products</option>
                  <option value="chicken">Chicken</option>
                  <option value="pork">Pork</option>
                  <option value="beef">Beef</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Date Range */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="date"
                  value={formatDate(startDate)}
                  onChange={(e) => { setStartDate(e.target.value ? new Date(e.target.value + "T00:00:00") : null); setPage(1) }}
                  className="pl-9 pr-4 py-2 bg-gray-50 dark:bg-secondary/30 border border-gray-200 dark:border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-gray-800 dark:text-foreground"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="date"
                  value={formatDate(endDate)}
                  onChange={(e) => { setEndDate(e.target.value ? new Date(e.target.value + "T23:59:59") : null); setPage(1) }}
                  className="pl-9 pr-4 py-2 bg-gray-50 dark:bg-secondary/30 border border-gray-200 dark:border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-gray-800 dark:text-foreground"
                />
              </div>
            </div>

            {/* Quick Filter Buttons */}
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" className="h-9 rounded-xl text-xs" onClick={setToday}>Today</Button>
              <Button size="sm" variant="outline" className="h-9 rounded-xl text-xs" onClick={setThisWeek}>This Week</Button>
              <Button size="sm" variant="outline" className="h-9 rounded-xl text-xs" onClick={setThisMonth}>This Month</Button>
              <Button size="sm" variant="ghost" className="h-9 rounded-xl text-xs text-gray-500 px-2" onClick={resetFilters}>
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Status Chips */}
          <div className="flex items-center gap-2 flex-wrap pt-2">
            {(["all", "pending", "on_delivery", "completed", "cancelled"] as const).map((status) => {
              const isActive = statusFilter === status
              let chipClass = "px-3.5 py-1.5 text-[11px] font-bold rounded-full transition-all cursor-pointer border "
              if (isActive) {
                if (status === 'all') chipClass += "bg-gray-800 text-white border-gray-800 dark:bg-gray-200 dark:text-gray-900"
                else if (status === 'pending') chipClass += "bg-amber-500 text-white border-amber-500"
                else if (status === 'on_delivery') chipClass += "bg-purple-500 text-white border-purple-500"
                else if (status === 'completed') chipClass += "bg-emerald-500 text-white border-emerald-500"
                else if (status === 'cancelled') chipClass += "bg-red-500 text-white border-red-500"
              } else {
                chipClass += "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-transparent dark:border-border dark:text-gray-400 dark:hover:bg-secondary/50"
              }
              return (
                <button
                  key={status}
                  onClick={() => { setStatusFilter(status); setPage(1) }}
                  className={chipClass}
                >
                  {status === 'all' ? 'All Orders' : status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </button>
              )
            })}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto min-h-[400px]">
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
              <Package className="h-12 w-12 text-gray-300 mb-3" />
              <p className="font-medium text-gray-500">No orders found</p>
              <p className="text-xs mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-gray-50/80 dark:bg-secondary/40 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="px-5 py-4 cursor-pointer group select-none" onClick={() => toggleSort("orderId")}>
                    <div className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
                      Order ID <SortIcon field="orderId" />
                    </div>
                  </th>
                  <th className="px-5 py-4 cursor-pointer group select-none" onClick={() => toggleSort("customerName")}>
                    <div className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
                      Customer Name <SortIcon field="customerName" />
                    </div>
                  </th>
                  <th className="px-5 py-4">Products</th>
                  <th className="px-5 py-4 cursor-pointer group select-none text-right" onClick={() => toggleSort("totalKg")}>
                    <div className="flex items-center justify-end gap-1.5 hover:text-gray-900 transition-colors">
                      Total KG <SortIcon field="totalKg" />
                    </div>
                  </th>
                  <th className="px-5 py-4 cursor-pointer group select-none text-right" onClick={() => toggleSort("totalAmount")}>
                    <div className="flex items-center justify-end gap-1.5 hover:text-gray-900 transition-colors">
                      Total Amount <SortIcon field="totalAmount" />
                    </div>
                  </th>
                  
                  <th className="px-5 py-4 cursor-pointer group select-none" onClick={() => toggleSort("status")}>
                    <div className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
                      Status <SortIcon field="status" />
                    </div>
                  </th>
                  <th className="px-5 py-4 cursor-pointer group select-none" onClick={() => toggleSort("createdAt")}>
                    <div className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
                      Date Ordered <SortIcon field="createdAt" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-border/50">
                {orders.map((order, idx) => (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs text-gray-500">
                      #{order.id.slice(-6).toUpperCase()}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-900 dark:text-foreground">{order.customerName}</div>
                      <div className="text-[11px] text-gray-500">{order.customerPhone}</div>
                    </td>
                    <td className="px-5 py-4 max-w-[200px] truncate text-[13px] text-gray-600 dark:text-gray-400">
                      {computeProductSummary(order)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="font-bold text-gray-700 dark:text-gray-300">{computeTotalKg(order).toFixed(1)}</span>
                      <span className="text-[10px] text-gray-400 ml-1">KG</span>
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(computeTotalAmount(order))}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-4 text-[13px] text-gray-600 dark:text-gray-400">
                      {formatDateDisplay(parseTimestamp(order.createdAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-border bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-gray-500">
            Showing <span className="font-bold text-gray-900 dark:text-foreground">{paginationStart}-{paginationEnd}</span> of <span className="font-bold text-gray-900 dark:text-foreground">{totalResults}</span> orders
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Rows per page</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                className="text-xs border-gray-200 rounded-md py-1 pl-2 pr-6 bg-white cursor-pointer"
              >
                {pageSizeOptions.map(size => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(1)}>
                <ChevronsLeft className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="text-xs font-medium px-2">Page {page} of {totalPages}</span>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
                <ChevronsRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── KPI Card Subcomponent ───────────────────────────────────────────────────
function KPICard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string
}) {
  const iconBgMap: Record<string, string> = {
    indigo: "from-indigo-50 to-indigo-100 text-indigo-600 dark:from-indigo-900/30 dark:to-indigo-800/30",
    blue: "from-blue-50 to-blue-100 text-blue-600 dark:from-blue-900/30 dark:to-blue-800/30",
    emerald: "from-emerald-50 to-emerald-100 text-emerald-600 dark:from-emerald-900/30 dark:to-emerald-800/30",
    amber: "from-amber-50 to-amber-100 text-amber-600 dark:from-amber-900/30 dark:to-amber-800/30",
    purple: "from-purple-50 to-purple-100 text-purple-600 dark:from-purple-900/30 dark:to-purple-800/30",
    sky: "from-sky-50 to-sky-100 text-sky-600 dark:from-sky-900/30 dark:to-sky-800/30",
  }

  return (
    <div className="bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
      <div className="flex flex-col gap-3">
        <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${iconBgMap[color] || iconBgMap.indigo} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-foreground truncate">{value}</p>
          {sub && <p className="text-xs font-medium text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
      <div className={`absolute -right-4 -bottom-4 w-24 h-24 bg-gradient-to-br ${iconBgMap[color]} opacity-20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500`} />
    </div>
  )
}
