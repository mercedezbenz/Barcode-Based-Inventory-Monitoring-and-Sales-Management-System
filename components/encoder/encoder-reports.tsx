"use client"

import { useState, useRef } from "react"
import { useEncoderReports, MEAT_CATEGORIES, type MeatCategory } from "@/hooks/useEncoderReports"
import { AuthLoadingSkeleton } from "@/components/skeletons/dashboard-skeleton"
import {
  Search, FileText, Calendar, Download, Printer, RotateCcw,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Weight, ArrowUpDown, Package, TrendingUp, Award, Warehouse,
  ArrowDownToLine, ArrowUpFromLine, ChevronsLeft, ChevronsRight,
  PackagePlus, PackageMinus, Filter
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Cell
} from "recharts"

// ─── PDF Export ──────────────────────────────────────────────────────────────
async function exportPDF(
  allData: any[],
  summary: any,
  startDate: Date | null,
  endDate: Date | null,
  parseTs: (ts: any) => Date | null
) {
  const { default: jsPDF } = await import("jspdf")
  const autoTable = (await import("jspdf-autotable")).default
  const doc = new jsPDF({ orientation: "landscape" })

  // Title
  doc.setFontSize(18)
  doc.setTextColor(14, 165, 233)
  doc.text("DecktaGo — Encoder Report", 14, 18)

  // Date range
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  const rangeStr = startDate && endDate
    ? `${startDate.toLocaleDateString()} — ${endDate.toLocaleDateString()}`
    : "All Time"
  doc.text(`Date Range: ${rangeStr}`, 14, 26)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32)

  // Summary
  doc.setFontSize(11)
  doc.setTextColor(30, 30, 30)
  doc.text(`Total Released: ${summary.totalReleasedKg.toFixed(1)} KG`, 14, 42)
  doc.text(`Total Transactions: ${summary.totalTransactions}`, 100, 42)
  doc.text(`Products Released: ${summary.totalProductsReleased}`, 180, 42)
  if (summary.mostReleasedProduct) {
    doc.text(`Most Released: ${summary.mostReleasedProduct.name} (${summary.mostReleasedProduct.weight.toFixed(1)} KG)`, 14, 48)
  }

  // Table
  const rows = allData.map((t) => {
    const movement = t.computedMovementType === "IN" ? "STOCK IN" : "STOCK OUT"
    const activity = t.computedMovementType === "IN" ? "Inventory Added" : "Inventory Released"
    const weight = (t.computedWeightKg || t.outgoing_weight || t.incoming_weight || 0).toFixed(1)
    const dateAdded = t.dateAdded ? t.dateAdded.toLocaleDateString() : (t.computedMovementType === "IN" ? (parseTs(t.transaction_date || t.created_at)?.toLocaleDateString() || "—") : "—")
    const dateReleased = t.dateReleased ? t.dateReleased.toLocaleDateString() : (t.computedMovementType === "OUT" ? (parseTs(t.transaction_date || t.created_at)?.toLocaleDateString() || "—") : "—")
    return [
      t.product_name || "—",
      t.barcode || "—",
      movement,
      `${weight} KG`,
      dateAdded,
      dateReleased,
      activity,
    ]
  })

  autoTable(doc, {
    startY: 54,
    head: [["Product", "Barcode", "Movement", "Weight (KG)", "Date Added", "Date Released", "Activity"]],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [14, 165, 233], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  })

  doc.save(`DecktaGo_Encoder_Report_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─── Print ───────────────────────────────────────────────────────────────────
function handlePrint() {
  window.print()
}

// ─── Chart Colors ────────────────────────────────────────────────────────────
const CHART_COLORS = ["#0ea5e9", "#38bdf8", "#0284c7", "#7dd3fc", "#06b6d4", "#22d3ee", "#0891b2", "#155e75"]


const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

// ─── Component ───────────────────────────────────────────────────────────────
export function EncoderReports() {
  const {
    loading,
    transactions,
    allFilteredTransactions,
    summary,
    weeklyChartData,
    monthlyChartData,
    topProductsData,
    startDate, setStartDate,
    endDate, setEndDate,
    searchTerm, setSearchTerm,
    categoryFilter, setCategoryFilter,
    setToday, setThisWeek, setThisMonth, resetFilters,
    sortField, sortDir, toggleSort,
    page, setPage, totalPages, totalResults,
    pageSize, setPageSize,
    paginationStart, paginationEnd,
    parseTimestamp,
  } = useEncoderReports()

  const [activeChart, setActiveChart] = useState<"weekly" | "monthly" | "top">("weekly")
  const reportRef = useRef<HTMLDivElement>(null)

  if (loading) return <AuthLoadingSkeleton />

  const formatDate = (d: Date | null) => d ? d.toISOString().slice(0, 10) : ""

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
  }

  return (
    <div ref={reportRef} className="max-w-[1600px] mx-auto space-y-8 pb-8 animate-in fade-in duration-500" id="encoder-reports">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-gray-900 dark:text-foreground leading-tight tracking-[-0.01em] flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20 hover:scale-110 transition-transform duration-300">
              <FileText className="h-5 w-5 text-white" />
            </div>
            Encoder Reports
          </h1>
          <p className="text-gray-400 dark:text-muted-foreground text-[13px] mt-1 tracking-wide">
            Track inventory movement, stock-out history, and released products.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="gap-2 text-xs font-semibold rounded-xl border-sky-200 text-sky-700 hover:bg-sky-50 hover:shadow-sm dark:border-sky-800 dark:text-sky-400 transition-all duration-200"
            onClick={() => exportPDF(allFilteredTransactions, summary, startDate, endDate, parseTimestamp)}
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


      {/* ── Summary Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
        <SummaryCard
          icon={<Weight className="h-5 w-5 text-sky-600" />}
          label="Total Released KG"
          value={`${summary.totalReleasedKg.toFixed(1)} kg`}
          color="sky"
        />
        <SummaryCard
          icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
          label="Total Transactions"
          value={summary.totalTransactions.toString()}
          color="blue"
        />
        <SummaryCard
          icon={<Package className="h-5 w-5 text-violet-600" />}
          label="Products Released"
          value={summary.totalProductsReleased.toString()}
          color="violet"
        />
        <SummaryCard
          icon={<Warehouse className="h-5 w-5 text-emerald-600" />}
          label="Remaining Inventory"
          value={`${summary.remainingInventoryKg.toFixed(1)} kg`}
          color="emerald"
        />
        <SummaryCard
          icon={<Award className="h-5 w-5 text-amber-600" />}
          label="Most Released"
          value={summary.mostReleasedProduct?.name || "—"}
          sub={summary.mostReleasedProduct ? `${summary.mostReleasedProduct.weight.toFixed(1)} kg` : ""}
          color="amber"
        />
      </div>

      {/* ── Charts ──────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Chart tabs */}
        <div className="flex border-b border-gray-100 dark:border-border px-6 pt-1">
          {(["weekly", "monthly", "top"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveChart(tab)}
              className={`px-5 py-3.5 text-sm font-semibold text-center transition-all duration-200 border-b-2 ${
                activeChart === tab
                  ? "border-sky-500 text-sky-700 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/20"
                  : "border-transparent text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              }`}
            >
              {tab === "weekly" ? "Weekly Released KG" : tab === "monthly" ? "Monthly Movement" : "Top Products"}
            </button>
          ))}
        </div>

        <div className="p-6 h-[340px]">
          {activeChart === "weekly" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 13 }}
                  formatter={(val: number) => [`${val.toFixed(1)} kg`, "Released"]}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {weeklyChartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {activeChart === "monthly" && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorMonthly" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 13 }}
                  formatter={(val: number) => [`${val.toFixed(1)} kg`, "Movement"]}
                />
                <Area type="monotone" dataKey="value" stroke="#0ea5e9" strokeWidth={2} fill="url(#colorMonthly)" />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {activeChart === "top" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProductsData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 13 }}
                  formatter={(val: number) => [`${val.toFixed(1)} kg`, "Released"]}
                />
                <Bar dataKey="weight" radius={[0, 6, 6, 0]} maxBarSize={28}>
                  {topProductsData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Report Table ────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
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
                  placeholder="Search product, barcode, customer..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-secondary/30 border border-gray-200 dark:border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all text-gray-800 dark:text-foreground"
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
                  onChange={(e) => { setCategoryFilter(e.target.value as MeatCategory); setPage(1) }}
                  className="pl-9 pr-8 py-2 bg-gray-50 dark:bg-secondary/30 border border-gray-200 dark:border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all text-gray-800 dark:text-foreground appearance-none min-w-[130px] cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {MEAT_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
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
                  className="pl-9 pr-4 py-2 bg-gray-50 dark:bg-secondary/30 border border-gray-200 dark:border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all text-gray-800 dark:text-foreground"
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
                  className="pl-9 pr-4 py-2 bg-gray-50 dark:bg-secondary/30 border border-gray-200 dark:border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all text-gray-800 dark:text-foreground"
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

          {/* Active filter display & Rows selector */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
            <div className="flex items-center gap-2 flex-wrap">
              {(startDate || endDate || categoryFilter !== "all") && (
                <>
                  {(startDate || endDate) && (
                    <div className="flex items-center gap-2 text-xs text-sky-700 dark:text-sky-400 font-medium bg-sky-50 dark:bg-sky-950/30 px-3 py-1.5 rounded-lg border border-sky-100 dark:border-sky-900/40 w-fit">
                      <Calendar className="h-3 w-3" />
                      {startDate?.toLocaleDateString() || "..."} — {endDate?.toLocaleDateString() || "..."}
                    </div>
                  )}
                  {categoryFilter !== "all" && (
                    <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border w-fit ${
                      categoryFilter === "chicken" ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40" :
                      categoryFilter === "pork" ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/40" :
                      "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800/40"
                    }`}>
                      <span className={`inline-block h-2 w-2 rounded-full ${
                        categoryFilter === "chicken" ? "bg-amber-500" :
                        categoryFilter === "pork" ? "bg-rose-500" :
                        "bg-orange-700"
                      }`} />
                      {MEAT_CATEGORIES.find(c => c.value === categoryFilter)?.label}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Pagination Controls / Records Count */}
            <div className="flex items-center gap-3 ml-auto">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Rows per page:</label>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                  className="px-2.5 py-1.5 bg-gray-50 dark:bg-secondary/30 border border-gray-200 dark:border-border rounded-lg text-sm font-semibold text-gray-700 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer transition-all duration-200"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
              <div className="text-xs font-semibold text-gray-500 px-3 py-1.5 rounded-full bg-gray-50 dark:bg-secondary/30 border border-gray-200 dark:border-border">
                {totalResults} records
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[300px]">
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
              <div className="h-14 w-14 rounded-full bg-gray-50 dark:bg-secondary/50 flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-gray-300" />
              </div>
              <p className="font-medium text-gray-500 dark:text-foreground">No movement records found</p>
              <p className="text-xs mt-1">Try adjusting your date range or search filters</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 dark:bg-secondary/40 border-b border-gray-200 dark:border-border text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-5 py-3.5 text-left cursor-pointer select-none hover:text-gray-700 transition-colors duration-200" onClick={() => toggleSort("product_name")}>
                    <span className="flex items-center gap-1.5">Product Name <SortIcon field="product_name" /></span>
                  </th>
                  <th className="px-5 py-3.5 text-left">Barcode</th>
                  <th className="px-5 py-3.5 text-center cursor-pointer select-none hover:text-gray-700 transition-colors duration-200" onClick={() => toggleSort("movement_type")}>
                    <span className="flex items-center gap-1.5 justify-center">Movement Type <SortIcon field="movement_type" /></span>
                  </th>
                  <th className="px-5 py-3.5 text-right cursor-pointer select-none hover:text-gray-700 transition-colors duration-200" onClick={() => toggleSort("outgoing_weight")}>
                    <span className="flex items-center gap-1.5 justify-end">Weight (KG) <SortIcon field="outgoing_weight" /></span>
                  </th>
                  <th className="px-5 py-3.5 text-left cursor-pointer select-none hover:text-gray-700 transition-colors duration-200" onClick={() => toggleSort("transaction_date")}>
                    <span className="flex items-center gap-1.5">Date Added <SortIcon field="transaction_date" /></span>
                  </th>
                  <th className="px-5 py-3.5 text-left">Date Released</th>
                  <th className="px-5 py-3.5 text-left">Activity</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, idx) => {
                  const movementType = t.computedMovementType || (t.outgoing_weight > 0 ? "OUT" : "IN")
                  const isStockIn = movementType === "IN"
                  const weightKg = t.computedWeightKg || (isStockIn ? (t.incoming_weight || 0) : (t.outgoing_weight || 0))
                  const txnDate = parseTimestamp(t.transaction_date || t.created_at)
                  const dateAdded = isStockIn ? txnDate : (t.dateAdded || parseTimestamp(t.created_at))
                  const dateReleased = !isStockIn ? txnDate : t.dateReleased

                  return (
                    <tr
                      key={t.id}
                      className={`border-b border-gray-100 dark:border-border/30 last:border-b-0 transition-colors duration-150 hover:bg-sky-50/40 dark:hover:bg-secondary/40 ${
                        idx % 2 === 1 ? "bg-gray-50/40 dark:bg-secondary/10" : ""
                      }`}
                    >
                      {/* Product Name */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const name = (t.product_name || "").toLowerCase()
                            const cat = (t.category || "").toLowerCase()
                            const isChicken = name.includes("chicken") || cat.includes("chicken")
                            const isPork = name.includes("pork") || cat.includes("pork")
                            const isBeef = name.includes("beef") || cat.includes("beef")
                            const dotColor = isChicken ? "bg-amber-400" : isPork ? "bg-rose-400" : isBeef ? "bg-orange-700" : "bg-gray-300 dark:bg-gray-600"
                            return <span className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${dotColor}`} title={isChicken ? "Chicken" : isPork ? "Pork" : isBeef ? "Beef" : "Other"} />
                          })()}
                          <span className="font-semibold text-gray-900 dark:text-foreground">{t.product_name || "—"}</span>
                        </div>
                      </td>

                      {/* Barcode */}
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-secondary px-2.5 py-1 rounded-md border border-gray-200 dark:border-border">
                          {t.barcode || "—"}
                        </span>
                      </td>

                      {/* Movement Type Badge */}
                      <td className="px-5 py-3.5 text-center">
                        {isStockIn ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50 shadow-sm">
                            <ArrowDownToLine className="h-3.5 w-3.5" />
                            STOCK IN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/50 shadow-sm">
                            <ArrowUpFromLine className="h-3.5 w-3.5" />
                            STOCK OUT
                          </span>
                        )}
                      </td>

                      {/* Weight (KG) */}
                      <td className="px-5 py-3.5 text-right">
                        <span className="tabular-nums font-bold text-[15px] text-blue-700 dark:text-blue-400 tracking-tight">
                          {weightKg.toFixed(1)}
                        </span>
                        <span className="text-[11px] font-semibold text-blue-500/70 dark:text-blue-500/60 ml-1">KG</span>
                      </td>

                      {/* Date Added */}
                      <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap">
                        {dateAdded ? (
                          <span>{dateAdded.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </td>

                      {/* Date Released */}
                      <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap">
                        {dateReleased ? (
                          <span>{dateReleased.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600 italic">Not Released</span>
                        )}
                      </td>

                      {/* Activity */}
                      <td className="px-5 py-3.5">
                        {isStockIn ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50 shadow-sm whitespace-nowrap">
                            <PackagePlus className="h-3.5 w-3.5" />
                            Inventory Added
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/50 shadow-sm whitespace-nowrap">
                            <PackageMinus className="h-3.5 w-3.5" />
                            Inventory Released
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 dark:border-border bg-gray-50/40 dark:bg-secondary/10 rounded-b-2xl">
          {/* Left: Showing info */}
          <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            Showing{" "}
            <span className="font-bold text-gray-700 dark:text-foreground">{paginationStart}–{paginationEnd}</span>
            {" "}of{" "}
            <span className="font-bold text-gray-700 dark:text-foreground">{totalResults}</span>
            {" "}records
          </div>

          {/* Right: Pagination controls */}
          <div className="flex items-center gap-1.5">
            {/* First page */}
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(1)}
              className="h-9 w-9 p-0 rounded-xl border-gray-200 dark:border-border hover:bg-sky-50 hover:border-sky-300 dark:hover:bg-sky-950/30 transition-all duration-200 disabled:opacity-40"
              title="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>

            {/* Previous */}
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="h-9 w-9 p-0 rounded-xl border-gray-200 dark:border-border hover:bg-sky-50 hover:border-sky-300 dark:hover:bg-sky-950/30 transition-all duration-200 disabled:opacity-40"
              title="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Page numbers */}
            {(() => {
              const pages: (number | "ellipsis-start" | "ellipsis-end")[] = []
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i)
              } else {
                pages.push(1)
                if (page > 3) pages.push("ellipsis-start")
                const rangeStart = Math.max(2, page - 1)
                const rangeEnd = Math.min(totalPages - 1, page + 1)
                for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i)
                if (page < totalPages - 2) pages.push("ellipsis-end")
                pages.push(totalPages)
              }
              return pages.map((p, idx) => {
                if (typeof p === "string") {
                  return (
                    <span key={p + idx} className="h-9 w-6 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm select-none">
                      …
                    </span>
                  )
                }
                const isActive = page === p
                return (
                  <Button
                    key={p}
                    size="sm"
                    variant={isActive ? "default" : "outline"}
                    onClick={() => setPage(p)}
                    className={`h-9 w-9 p-0 text-xs font-bold rounded-xl transition-all duration-200 ${
                      isActive
                        ? "bg-sky-500 hover:bg-sky-600 text-white shadow-md shadow-sky-500/25 border-sky-500"
                        : "border-gray-200 dark:border-border hover:bg-sky-50 hover:border-sky-300 hover:text-sky-700 dark:hover:bg-sky-950/30 dark:hover:text-sky-400"
                    }`}
                  >
                    {p}
                  </Button>
                )
              })
            })()}

            {/* Next */}
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="h-9 w-9 p-0 rounded-xl border-gray-200 dark:border-border hover:bg-sky-50 hover:border-sky-300 dark:hover:bg-sky-950/30 transition-all duration-200 disabled:opacity-40"
              title="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {/* Last page */}
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              className="h-9 w-9 p-0 rounded-xl border-gray-200 dark:border-border hover:bg-sky-50 hover:border-sky-300 dark:hover:bg-sky-950/30 transition-all duration-200 disabled:opacity-40"
              title="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Summary Card sub-component ──────────────────────────────────────────────
function SummaryCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string
}) {
  const iconBgMap: Record<string, string> = {
    sky: "from-sky-400 to-sky-600 shadow-sky-500/25",
    blue: "from-blue-400 to-blue-600 shadow-blue-500/25",
    violet: "from-violet-400 to-violet-600 shadow-violet-500/25",
    emerald: "from-emerald-400 to-emerald-600 shadow-emerald-500/25",
    amber: "from-amber-400 to-amber-600 shadow-amber-500/25",
  }

  return (
    <div className="bg-white dark:bg-card border border-gray-100 dark:border-border rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300 group">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${iconBgMap[color] || iconBgMap.sky} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
          <div className="text-white [&>svg]:h-5 [&>svg]:w-5">{icon}</div>
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-foreground leading-none truncate">{value}</p>
      {sub && <p className="text-sm font-semibold text-gray-400 dark:text-muted-foreground mt-1.5">{sub}</p>}
    </div>
  )
}
