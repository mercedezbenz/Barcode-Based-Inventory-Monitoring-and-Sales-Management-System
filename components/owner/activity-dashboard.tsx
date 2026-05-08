"use client"

import { useState, useEffect, useMemo } from "react"
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from "firebase/firestore"
import { getFirebaseDb, auth } from "@/lib/firebase-live"
import { ActivityLog, logActivity } from "@/lib/activity-logger"
import { formatDistanceToNow, format, isToday } from "date-fns"
import { Search, Activity, ShoppingCart, Truck, CheckCircle2, XCircle, Package, User, Clock, ArrowRight, TrendingUp } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

// Types
type FilterType = "All Activities" | "Sales" | "Encoder" | "Completed" | "Cancelled" | "Deliveries" | "Barcode Scans"

export function ActivityDashboard() {
  const [logs, setLogs] = useState<(ActivityLog & { id: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterType>("All Activities")

  // Real-time listener
  useEffect(() => {
    const db = getFirebaseDb()
    if (!db) return

    const q = query(
      collection(db, "activity_logs"),
      orderBy("createdAt", "desc"),
      limit(200) // Fetching a bit more to calculate daily stats accurately
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (ActivityLog & { id: string })[]
      
      setLogs(newLogs)
      setLoading(false)
    })
    
    // Log dashboard viewed
    if (auth.currentUser) {
      logActivity({
        type: "dashboard viewed",
        message: "Owner viewed the Activity Dashboard",
        performedBy: auth.currentUser?.displayName || auth.currentUser?.email || "Owner",
        role: "owner"
      });
    }

    return () => unsubscribe()
  }, [])

  // Filters
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Search
      const searchMatch = 
        log.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.orderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.performedBy?.toLowerCase().includes(searchTerm.toLowerCase())
      
      if (!searchMatch) return false

      // Filter Toggle
      switch (activeFilter) {
        case "Sales": return log.role === "sales"
        case "Encoder": return log.role === "encoder"
        case "Completed": return log.type === "completed_order"
        case "Cancelled": return log.type === "cancelled_order"
        case "Deliveries": return log.type === "on_delivery"
        case "Barcode Scans": return log.type === "barcode_scan"
        case "All Activities":
        default: return true
      }
    }).slice(0, 50) // Limit to 50 for the feed as requested
  }, [logs, searchTerm, activeFilter])

  // Statistics Calculation (from today's logs)
  const stats = useMemo(() => {
    const todaysLogs = logs.filter(log => {
      if (!log.createdAt) return false
      const date = log.createdAt instanceof Timestamp ? log.createdAt.toDate() : new Date(log.createdAt)
      return isToday(date)
    })

    return {
      confirmed: todaysLogs.filter(l => l.type === "order_created" || l.type === "order_confirmed").length,
      completed: todaysLogs.filter(l => l.type === "completed_order").length,
      scans: todaysLogs.filter(l => l.type === "barcode_scan").length,
      cancelled: todaysLogs.filter(l => l.type === "cancelled_order").length,
      activePending: logs.filter(l => l.type === "order_created" || l.type === "order_confirmed").length - logs.filter(l => l.type === "completed_order" || l.type === "cancelled_order").length // Rough estimate
    }
  }, [logs])

  // Leaderboard Calculation
  const leaderboards = useMemo(() => {
    const todaysLogs = logs.filter(log => {
      if (!log.createdAt) return false
      const date = log.createdAt instanceof Timestamp ? log.createdAt.toDate() : new Date(log.createdAt)
      return isToday(date)
    })

    const encoderStats: Record<string, { processed: number, scans: number, deliveries: number }> = {}
    const salesStats: Record<string, { confirmed: number, cancelled: number }> = {}

    todaysLogs.forEach(log => {
      const user = log.performedBy || "Unknown"
      if (log.role === "encoder") {
        if (!encoderStats[user]) encoderStats[user] = { processed: 0, scans: 0, deliveries: 0 }
        if (log.type === "stock_selected") encoderStats[user].processed++
        if (log.type === "barcode_scan") encoderStats[user].scans++
        if (log.type === "completed_order") encoderStats[user].deliveries++
      } else if (log.role === "sales") {
        if (!salesStats[user]) salesStats[user] = { confirmed: 0, cancelled: 0 }
        if (log.type === "order_confirmed" || log.type === "order_created") salesStats[user].confirmed++
        if (log.type === "cancelled_order") salesStats[user].cancelled++
      }
    })

    return { encoderStats, salesStats }
  }, [logs])

  // Timelines grouped by Order ID
  const orderTimelines = useMemo(() => {
    const timelines: Record<string, any[]> = {}
    logs.forEach(log => {
      if (log.orderId) {
        if (!timelines[log.orderId]) timelines[log.orderId] = []
        timelines[log.orderId].push(log)
      }
    })
    
    // Sort timeline events chronologically (oldest first)
    Object.keys(timelines).forEach(id => {
      timelines[id].sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0
        const timeB = b.createdAt?.seconds || 0
        return timeA - timeB
      })
    })

    return timelines
  }, [logs])

  const getLogIcon = (type: string, role: string) => {
    if (type.includes("confirm") || type.includes("creat")) return <ShoppingCart className="h-4 w-4 text-emerald-500" />
    if (type.includes("cancel")) return <XCircle className="h-4 w-4 text-red-500" />
    if (type.includes("scan") || type.includes("stock")) return <Package className="h-4 w-4 text-blue-500" />
    if (type.includes("delivery") || type.includes("complet")) return <Truck className="h-4 w-4 text-violet-500" />
    return <Activity className="h-4 w-4 text-gray-500" />
  }

  const getLogColor = (role: string) => {
    switch(role) {
      case "sales": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "encoder": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
            Owner Activity Dashboard
          </h1>
          <p className="text-gray-500 dark:text-muted-foreground mt-1 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Real-time Enterprise Monitoring
          </p>
        </div>
      </div>

      {/* Section 2: Today&apos;s Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          <Card className="shadow-sm border-blue-100 dark:border-blue-900/30">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardDescription className="text-xs font-semibold text-blue-600 uppercase">Orders Confirmed Today</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-bold text-gray-900 dark:text-foreground">{stats.confirmed}</div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
          <Card className="shadow-sm border-violet-100 dark:border-violet-900/30">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardDescription className="text-xs font-semibold text-violet-600 uppercase">Orders Completed Today</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-bold text-gray-900 dark:text-foreground">{stats.completed}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
          <Card className="shadow-sm border-sky-100 dark:border-sky-900/30">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardDescription className="text-xs font-semibold text-sky-600 uppercase">Barcodes Scanned Today</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-bold text-gray-900 dark:text-foreground">{stats.scans}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
          <Card className="shadow-sm border-red-100 dark:border-red-900/30">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardDescription className="text-xs font-semibold text-red-600 uppercase">Cancelled Orders</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-bold text-gray-900 dark:text-foreground">{stats.cancelled}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
          <Card className="shadow-sm border-amber-100 dark:border-amber-900/30">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardDescription className="text-xs font-semibold text-amber-600 uppercase">Active Pending Est.</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-bold text-gray-900 dark:text-foreground">{Math.max(0, stats.activePending)}</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN: Activity Feed & Filters */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-md rounded-2xl border-gray-100 dark:border-border h-[800px] flex flex-col">
            <CardHeader className="border-b border-gray-50 dark:border-border/50 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-500" />
                  Live Activity Feed
                </CardTitle>
                
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input 
                    placeholder="Search logs..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-gray-50 dark:bg-secondary border-gray-200 dark:border-gray-800 rounded-full h-10"
                  />
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-2 pt-4">
                {["All Activities", "Sales", "Encoder", "Completed", "Cancelled", "Deliveries", "Barcode Scans"].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter as FilterType)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                      activeFilter === filter
                        ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-card dark:text-gray-400 dark:border-gray-800"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </CardHeader>
            
            <CardContent className="flex-1 overflow-y-auto p-0">
              <div className="divide-y divide-gray-50 dark:divide-border/50">
                <AnimatePresence>
                  {filteredLogs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="p-5 hover:bg-gray-50/50 dark:hover:bg-secondary/20 transition-colors flex gap-4 items-start"
                    >
                      {/* Avatar/Icon */}
                      <div className="relative shrink-0 mt-1">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${
                          log.role === "sales" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {log.performedBy ? log.performedBy.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-background rounded-full p-0.5 border shadow-sm">
                          {getLogIcon(log.type, log.role)}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-foreground">
                            {log.performedBy || "Unknown User"} 
                            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold ${getLogColor(log.role)}`}>
                              {log.role}
                            </span>
                          </p>
                          <span className="text-xs text-gray-400 whitespace-nowrap shrink-0 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {log.createdAt ? formatDistanceToNow(log.createdAt instanceof Timestamp ? log.createdAt.toDate() : new Date(log.createdAt), { addSuffix: true }) : "Just now"}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5 leading-relaxed">
                          {log.message}
                        </p>

                        {/* Metadata Pills */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {log.orderId && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 px-2 py-1 rounded">
                              Order #{log.orderId.slice(-6).toUpperCase()}
                            </span>
                          )}
                          {log.customerName && log.customerName !== "N/A" && (
                            <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2 py-1 rounded">
                              <User className="h-3 w-3" /> {log.customerName}
                            </span>
                          )}
                          {log.metadata?.barcode && (
                            <span className="inline-flex items-center gap-1 text-[11px] bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 px-2 py-1 rounded">
                              Barcode: {log.metadata.barcode}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {filteredLogs.length === 0 && !loading && (
                  <div className="p-12 text-center text-gray-400">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p className="font-medium">No activity logs found</p>
                    <p className="text-sm mt-1">Try adjusting your filters or search term</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Leaderboards & Timeline */}
        <div className="space-y-6">
          {/* Section 3: Employee Performance */}
          <Card className="shadow-md rounded-2xl border-gray-100 dark:border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-indigo-500" />
                Today&apos;s Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Encoder Leaderboard */}
              <div>
                <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">Encoder Activity</h4>
                <div className="space-y-3">
                  {Object.entries(leaderboards.encoderStats).sort((a, b) => b[1].processed - a[1].processed).slice(0, 3).map(([user, stats], idx) => (
                    <div key={user} className="flex items-center justify-between bg-gray-50 dark:bg-secondary/30 p-2.5 rounded-lg border border-gray-100 dark:border-border">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                          {idx + 1}
                        </div>
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{user}</span>
                      </div>
                      <div className="text-right text-xs">
                        <div className="font-bold text-gray-900 dark:text-foreground">{stats.processed} <span className="text-gray-400 font-normal">tasks</span></div>
                        <div className="text-emerald-600 dark:text-emerald-400 font-medium">{stats.scans} scans</div>
                      </div>
                    </div>
                  ))}
                  {Object.keys(leaderboards.encoderStats).length === 0 && (
                    <div className="text-xs text-gray-400 text-center py-2">No encoder activity today</div>
                  )}
                </div>
              </div>

              {/* Sales Leaderboard */}
              <div>
                <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">Sales Activity</h4>
                <div className="space-y-3">
                  {Object.entries(leaderboards.salesStats).sort((a, b) => b[1].confirmed - a[1].confirmed).slice(0, 3).map(([user, stats], idx) => (
                    <div key={user} className="flex items-center justify-between bg-gray-50 dark:bg-secondary/30 p-2.5 rounded-lg border border-gray-100 dark:border-border">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">
                          {idx + 1}
                        </div>
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{user}</span>
                      </div>
                      <div className="text-right text-xs">
                        <div className="font-bold text-gray-900 dark:text-foreground">{stats.confirmed} <span className="text-gray-400 font-normal">confirmed</span></div>
                        {stats.cancelled > 0 && <div className="text-red-500 font-medium">{stats.cancelled} cancelled</div>}
                      </div>
                    </div>
                  ))}
                  {Object.keys(leaderboards.salesStats).length === 0 && (
                    <div className="text-xs text-gray-400 text-center py-2">No sales activity today</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Order Timeline (Recent active orders) */}
          <Card className="shadow-md rounded-2xl border-gray-100 dark:border-border h-[400px] flex flex-col">
            <CardHeader className="pb-4 border-b border-gray-50">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                Active Order Timelines
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-6">
              {Object.entries(orderTimelines)
                .sort((a, b) => {
                  // Sort by most recently updated order
                  const lastA = a[1][a[1].length - 1].createdAt?.seconds || 0
                  const lastB = b[1][b[1].length - 1].createdAt?.seconds || 0
                  return lastB - lastA
                })
                .slice(0, 3) // Show top 3 most active orders
                .map(([orderId, events]) => (
                <div key={orderId} className="relative pl-2">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 mb-3 bg-gray-100 dark:bg-gray-800 inline-block px-2 py-1 rounded">
                    Order #{orderId.slice(-6).toUpperCase()}
                  </h4>
                  
                  <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[9px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                    {events.map((event, i) => (
                      <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-emerald-500 text-slate-500 group-[.is-active]:text-emerald-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                           <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                        </div>
                        
                        <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] bg-white dark:bg-secondary/50 p-2.5 rounded border border-slate-200 dark:border-border shadow-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-gray-900 dark:text-foreground text-[11px] capitalize">{event.type.replace("order", "").trim()}</span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              {event.createdAt ? format(event.createdAt instanceof Timestamp ? event.createdAt.toDate() : new Date(event.createdAt), 'h:mm a') : ''}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-600 dark:text-gray-400 truncate">{event.performedBy}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {Object.keys(orderTimelines).length === 0 && (
                <div className="text-center text-sm text-gray-400 py-8">
                  No order timelines available
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
