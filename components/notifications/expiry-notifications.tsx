"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Bell, AlertTriangle, Clock, TrendingDown, Filter, Check, ClipboardList } from "lucide-react"
import { InventoryService } from "@/services/firebase-service"
import type { InventoryItem } from "@/lib/types"
import { useAuth } from "@/hooks/use-auth"
import { useEncoderTasks } from "@/hooks/useEncoderTasks"

interface ExpiryNotification {
  item: InventoryItem
  daysUntilExpiry: number
  status: "expired" | "expiring-today" | "expiring-soon"
}

interface LowStockNotification {
  item: InventoryItem
  stockLevel: number
  productName?: string
}

type NotificationFilter = "all" | "low-stock" | "expired" | "expiring" | "pending-tasks"

export function ExpiryNotifications() {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()
  const rawUserRole = user?.role
  const userRole = rawUserRole?.toLowerCase().trim()
  const [expiryNotifications, setExpiryNotifications] = useState<ExpiryNotification[]>([])
  const [lowStockNotifications, setLowStockNotifications] = useState<LowStockNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<NotificationFilter>("all")

  // Encoder tasks for pending task notifications (encoder/admin only)
  const showEncoderTasks = ["encoder", "admin"].includes(userRole || "")
  const { tasks: pendingEncoderTasks, loading: encoderTasksLoading } = useEncoderTasks(
    showEncoderTasks ? ["ready_for_processing", "READY_FOR_PROCESSING", "processing", "PROCESSING"] : undefined
  )
  // Track read pending task IDs in localStorage
  const [readPendingTaskIds, setReadPendingTaskIds] = useState<string[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem("readPendingTaskNotifications")
      if (stored) {
        setReadPendingTaskIds(JSON.parse(stored))
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const markPendingTaskAsRead = (taskId: string) => {
    if (!readPendingTaskIds.includes(taskId)) {
      const newReadIds = [...readPendingTaskIds, taskId]
      setReadPendingTaskIds(newReadIds)
      localStorage.setItem("readPendingTaskNotifications", JSON.stringify(newReadIds))
    }
  }
  
  const [readIds, setReadIds] = useState<string[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem("readExpiryNotifications")
      if (stored) {
        setReadIds(JSON.parse(stored))
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const markAsRead = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    const cleanId = id.replace(/[\s\W]+/g, "-").toLowerCase();
    if (!readIds.includes(cleanId)) {
      const newReadIds = [...readIds, cleanId]
      setReadIds(newReadIds)
      localStorage.setItem("readExpiryNotifications", JSON.stringify(newReadIds))
    }
  }

  const markAllAsRead = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    const currentIds = [
      ...lowStockNotifications.map(n => `low-stock-${(n.productName || n.item.id).replace(/[\s\W]+/g, "-").toLowerCase()}`),
      ...expiryNotifications.map(n => `expiry-${n.status}-${n.item.id}`)
    ]
    const combined = Array.from(new Set([...readIds, ...currentIds]))
    setReadIds(combined)
    localStorage.setItem("readExpiryNotifications", JSON.stringify(combined))
  }

  useEffect(() => {
    console.log("[Notifications] Subscribing to inventory items...")
    console.log("[Notifications] Using Firebase:", process.env.NEXT_PUBLIC_USE_FIREBASE === "1")

    const unsubscribe = InventoryService.subscribeToItems(
      (items) => {
        console.log("[Notifications] Received items:", items.length)
        if (items.length === 0) {
          console.warn("[Notifications] No items received from Firebase. Check Firebase connection and permissions.")
        }

        // Normalize field names — MUST match inventory dashboard weight-based formula exactly
        // Source of truth: incoming_weight - outgoing_weight + good_return_weight - damage_return_weight
        const normalizedItems = items.map((it: any) => {
          const incomingWeight = (it as any).incoming_weight ?? (it as any).production_weight ?? 0
          const outgoingWeight = (it as any).outgoing_weight ?? 0
          const goodReturnWeight = (it as any).good_return_weight ?? 0
          const damageReturnWeight = (it as any).damage_return_weight ?? 0
          const weightLeft = Math.max(0, incomingWeight - outgoingWeight + goodReturnWeight - damageReturnWeight)
          const expiry = it.expiryDate ?? it.expirationDate ?? null

          return {
            ...it,
            _weightLeft: weightLeft, // Computed weight for aggregation
            expirationDate: expiry,
            expiryDate: expiry,
          }
        })

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // AGGREGATION STEP: Group by Product Name (Category + Subcategory)
        // Uses the same weight formula as inventory-dashboard.tsx lowStockAlertList
        const productAggregation = new Map<string, {
          productName: string,
          totalStock: number,
          items: any[]
        }>()

        normalizedItems.forEach((item: any) => {
          const weightLeft = item._weightLeft

          const productName = item.subcategory 
            ? `${item.category} - ${item.subcategory}`
            : item.category || "Unknown Product";

          const existing = productAggregation.get(productName) || { productName, totalStock: 0, items: [] as any[] };
          existing.totalStock += weightLeft;
          existing.items.push(item);
          productAggregation.set(productName, existing);
        });

        const expiredItems: ExpiryNotification[] = []
        const expiringTodayItems: ExpiryNotification[] = []
        const expiringSoonItems: ExpiryNotification[] = []
        const lowStockItems: LowStockNotification[] = []

        // Process Aggregated Low Stock
        productAggregation.forEach((data) => {
          // Trigger per product when total <= 50 kg and > 0
          if (data.totalStock <= 50 && data.totalStock > 0) {
            // Pick the oldest batch for barcode reference (FIFO)
            const sortedItems = [...data.items].sort((a, b) => {
              const dateA = a.createdAt || a.updatedAt || new Date(0)
              const dateB = b.createdAt || b.updatedAt || new Date(0)
              const timeA = dateA instanceof Date ? dateA.getTime() : (dateA?.toDate ? dateA.toDate().getTime() : new Date(dateA).getTime())
              const timeB = dateB instanceof Date ? dateB.getTime() : (dateB?.toDate ? dateB.toDate().getTime() : new Date(dateB).getTime())
              return timeA - timeB
            })

            lowStockItems.push({
              item: sortedItems[0], // Reference item from oldest batch
              stockLevel: data.totalStock,
              productName: data.productName
            });
          }
        });

        // Process Expiry per Item (stays as is)
        normalizedItems.forEach((item: any) => {
          try {

            // Check for expiry notifications - use normalized expiry field
            const expiryDate = item.expiryDate || item.expirationDate
            if (!expiryDate) {
              // Skip items without expiry date (continue to next item)
              return
            }

            // Handle Firebase Timestamp and various date formats
            let expiry: Date | null = null
            try {
              if (expiryDate && typeof expiryDate.toDate === "function") {
                // Firebase Timestamp object
                expiry = expiryDate.toDate()
              } else if (expiryDate && expiryDate.seconds) {
                // Firebase Timestamp with seconds property
                expiry = new Date(expiryDate.seconds * 1000)
              } else if (expiryDate && expiryDate._seconds) {
                // Firebase Timestamp with _seconds property
                expiry = new Date(expiryDate._seconds * 1000)
              } else if (expiryDate instanceof Date) {
                expiry = expiryDate
              } else if (typeof expiryDate === "string") {
                // Try parsing string date (handles ISO strings and other formats)
                expiry = new Date(expiryDate)
                // If parsing failed, try to extract date from string
                if (isNaN(expiry.getTime())) {
                  // Try to parse common date formats like "November 16, 2025"
                  const dateMatch = expiryDate.match(/(\w+)\s+(\d+),\s+(\d+)/)
                  if (dateMatch) {
                    expiry = new Date(expiryDate)
                  } else {
                    // Try parsing as ISO string or timestamp
                    const timestamp = Date.parse(expiryDate)
                    if (!isNaN(timestamp)) {
                      expiry = new Date(timestamp)
                    }
                  }
                }
              } else if (typeof expiryDate === "number") {
                // Handle timestamp (milliseconds or seconds)
                expiry = expiryDate > 1000000000000
                  ? new Date(expiryDate)
                  : new Date(expiryDate * 1000)
              }

              // Validate date
              if (!expiry || isNaN(expiry.getTime())) {
                console.warn("[Notifications] Invalid expiry date for item:", item.id, "Raw value:", expiryDate)
                return
              }

              expiry.setHours(0, 0, 0, 0)
              const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

              // Debug logging for expiry
              if (daysUntilExpiry <= 30 || daysUntilExpiry < 0) {
                console.log("[Notifications] Expiry item found:", {
                  id: item.id,
                  barcode: item.barcode,
                  category: item.category,
                  daysUntilExpiry,
                  expiryDate: expiry.toISOString()
                })
              }

              if (daysUntilExpiry <= 30 || daysUntilExpiry < 0) {
                if (daysUntilExpiry < 0) {
                  expiredItems.push({ item, daysUntilExpiry, status: "expired" as const })
                } else if (daysUntilExpiry === 0) {
                  expiringTodayItems.push({ item, daysUntilExpiry, status: "expiring-today" as const })
                } else {
                  expiringSoonItems.push({ item, daysUntilExpiry, status: "expiring-soon" as const })
                }
              }
            } catch (dateError) {
              console.warn("[Notifications] Error parsing expiry date:", dateError, "for item:", item.id, "Raw value:", expiryDate)
              // Continue processing other items even if this one fails
            }
          } catch (error) {
            console.warn("[Notifications] Error processing item:", item.id, error)
          }
        })

        // Sort each category
        expiredItems.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
        expiringTodayItems.sort((a, b) => {
          const nameA = (a.item as any).name || a.item.category || ""
          const nameB = (b.item as any).name || b.item.category || ""
          return nameA.localeCompare(nameB)
        })
        expiringSoonItems.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
        lowStockItems.sort((a, b) => a.stockLevel - b.stockLevel)

        // Combine all expiry notifications
        setExpiryNotifications([...expiredItems, ...expiringTodayItems, ...expiringSoonItems])
        setLowStockNotifications(lowStockItems)
        setLoading(false)

        const totalExpiry = expiredItems.length + expiringTodayItems.length + expiringSoonItems.length
        const totalLowStock = lowStockItems.length
        const grandTotal = totalExpiry + totalLowStock

        console.log("[Notifications] Summary:", {
          totalItems: normalizedItems.length,
          lowStockCount: totalLowStock,
          expiredCount: expiredItems.length,
          expiringTodayCount: expiringTodayItems.length,
          expiringSoonCount: expiringSoonItems.length,
          totalExpiryCount: totalExpiry,
          grandTotal: grandTotal
        })

        if (grandTotal === 0 && normalizedItems.length > 0) {
          console.log("[Notifications] No notifications found. Sample item:", normalizedItems[0])
          // Debug: Show why items don't match criteria
          if (normalizedItems.length > 0) {
            const sample = normalizedItems[0]
            const incomingW = Number(sample.incoming_weight ?? sample.production_weight) || 0
            const outgoingW = Number(sample.outgoing_weight) || 0
            const goodReturnW = Number(sample.good_return_weight) || 0
            const damageReturnW = Number(sample.damage_return_weight) || 0
            const total = Math.max(0, incomingW - outgoingW + goodReturnW - damageReturnW)
            const expiry = sample.expiryDate || sample.expirationDate
            console.log("[Notifications] Sample item analysis:", {
              barcode: sample.barcode,
              category: sample.category,
              incoming_weight: incomingW,
              outgoing_weight: outgoingW,
              good_return_weight: goodReturnW,
              damage_return_weight: damageReturnW,
              weightLeft: total,
              computedWeightLeft: sample._weightLeft,
              isLowStock: total <= 50,
              hasExpiryDate: !!expiry,
              expiryDate: expiry
            })
          }
        }
      },
      (error) => {
        console.error("[Notifications] Error subscribing to items:", error)
        setLoading(false)
        // Still allow the component to render even if there's an error
      }
    )

    return () => {
      console.log("[Notifications] Unsubscribing from inventory items")
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const getFilteredNotifications = () => {
    const expiredCount = expiryNotifications.filter((n) => n.status === "expired").length
    const expiringCount = expiryNotifications.filter(
      (n) => n.status === "expiring-today" || n.status === "expiring-soon",
    ).length
    const pendingTaskCount = showEncoderTasks ? pendingEncoderTasks.length : 0

    switch (filter) {
      case "low-stock":
        return {
          showLowStock: true,
          showExpired: false,
          showExpiring: false,
          showPendingTasks: false,
          filteredExpired: [],
          filteredExpiring: [],
          totalCount: lowStockNotifications.length,
        }
      case "expired":
        return {
          showLowStock: false,
          showExpired: true,
          showExpiring: false,
          showPendingTasks: false,
          filteredExpired: expiryNotifications.filter((n) => n.status === "expired"),
          filteredExpiring: [],
          totalCount: expiredCount,
        }
      case "expiring":
        return {
          showLowStock: false,
          showExpired: false,
          showExpiring: true,
          showPendingTasks: false,
          filteredExpired: [],
          filteredExpiring: expiryNotifications.filter(
            (n) => n.status === "expiring-today" || n.status === "expiring-soon",
          ),
          totalCount: expiringCount,
        }
      case "pending-tasks":
        return {
          showLowStock: false,
          showExpired: false,
          showExpiring: false,
          showPendingTasks: true,
          filteredExpired: [],
          filteredExpiring: [],
          totalCount: pendingTaskCount,
        }
      default:
        return {
          showLowStock: true,
          showExpired: true,
          showExpiring: true,
          showPendingTasks: showEncoderTasks,
          filteredExpired: expiryNotifications.filter((n) => n.status === "expired"),
          filteredExpiring: expiryNotifications.filter(
            (n) => n.status === "expiring-today" || n.status === "expiring-soon",
          ),
          totalCount: lowStockNotifications.length + expiredCount + expiringCount + pendingTaskCount,
        }
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "expired":
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case "expiring-today":
        return <Clock className="h-4 w-4 text-orange-500" />
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusText = (notification: ExpiryNotification) => {
    switch (notification.status) {
      case "expired":
        return `Expired ${Math.abs(notification.daysUntilExpiry)} day${Math.abs(notification.daysUntilExpiry) !== 1 ? "s" : ""} ago`
      case "expiring-today":
        return "Expires today"
      default:
        return `Expires in ${notification.daysUntilExpiry} day${notification.daysUntilExpiry !== 1 ? "s" : ""}`
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "expired":
        return "destructive" as const
      case "expiring-today":
        return "secondary" as const
      default:
        return "outline" as const
    }
  }

  const handleNavigateToItem = (barcode: string, productName?: string) => {
    if (pathname !== "/inventory") {
      const url = productName 
        ? `/inventory?product=${encodeURIComponent(productName)}&barcode=${barcode}`
        : `/inventory?barcode=${barcode}`
      router.push(url)
      return
    }

    // If already on inventory page, use the global handler if available
    // or set the URL search params which the dashboard will listen to
    const params = new URLSearchParams(window.location.search)
    if (productName) params.set("product", productName)
    params.set("barcode", barcode)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const totalNotifications = expiryNotifications.length + lowStockNotifications.length + (showEncoderTasks ? pendingEncoderTasks.length : 0)
  const filteredData = getFilteredNotifications()

  const unreadCount = useMemo(() => {
    let unread = 0;
    lowStockNotifications.forEach(n => {
      const idStr = `low-stock-${(n.productName || n.item.id).replace(/[\s\W]+/g, "-").toLowerCase()}`
      if (!readIds.includes(idStr)) unread++;
    });
    // Owner should not count expiry notifications
    if (userRole !== "owner") {
      expiryNotifications.forEach(n => {
        if (!readIds.includes(`expiry-${n.status}-${n.item.id}`)) unread++;
      });
    }
    // Count unread pending encoder tasks
    if (showEncoderTasks) {
      pendingEncoderTasks.forEach(t => {
        if (!readPendingTaskIds.includes(t.id)) unread++;
      });
    }
    return unread;
  }, [lowStockNotifications, expiryNotifications, readIds, userRole, pendingEncoderTasks, readPendingTaskIds, showEncoderTasks])

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="relative inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-4 min-w-[16px] rounded-full p-0 flex items-center justify-center text-[10px] pointer-events-none border-2 border-background px-1"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 border border-gray-200 dark:border-border shadow-xl rounded-xl">
          <DropdownMenuLabel className="flex items-center justify-between px-3 py-2">
            <span className="font-semibold">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => {
                    markAllAsRead(e)
                    // Also mark all pending tasks as read
                    if (showEncoderTasks) {
                      const allTaskIds = pendingEncoderTasks.map(t => t.id)
                      const combined = Array.from(new Set([...readPendingTaskIds, ...allTaskIds]))
                      setReadPendingTaskIds(combined)
                      localStorage.setItem("readPendingTaskNotifications", JSON.stringify(combined))
                    }
                  }}
                  className="h-6 text-[11px] px-2 text-gray-500 hover:text-blue-600 font-medium"
                >
                  <Check className="h-3 w-3 mr-1" /> Mark all read
                </Button>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="p-2">
            <div className="flex items-center gap-1 mb-2">
              <Filter className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Filter:</span>
            </div>
            <div className="flex gap-1">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                className="text-xs h-6 px-2"
                onClick={() => setFilter("all")}
              >
                All
              </Button>
              <Button
                variant={filter === "low-stock" ? "default" : "outline"}
                size="sm"
                className="text-xs h-6 px-2"
                onClick={() => setFilter("low-stock")}
              >
                Low Stock
              </Button>
              {userRole !== "owner" && (
              <>
              <Button
                variant={filter === "expired" ? "default" : "outline"}
                size="sm"
                className="text-xs h-6 px-2"
                onClick={() => setFilter("expired")}
              >
                Expired
              </Button>
              <Button
                variant={filter === "expiring" ? "default" : "outline"}
                size="sm"
                className="text-xs h-6 px-2"
                onClick={() => setFilter("expiring")}
              >
                Expiring
              </Button>
              </>
              )}
              {showEncoderTasks && (
                <Button
                  variant={filter === "pending-tasks" ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={() => setFilter("pending-tasks")}
                >
                  Tasks
                </Button>
              )}
            </div>
          </div>
          <DropdownMenuSeparator />
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading notifications...</div>
          ) : filteredData.totalCount === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {filter === "all" ? "No notifications" : `No ${filter.replace("-", " ")} notifications`}
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {filteredData.showLowStock && lowStockNotifications.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-xs font-medium text-red-600 flex items-center gap-2">
                    <TrendingDown className="h-3 w-3" />
                    Low Stock ({lowStockNotifications.length})
                  </DropdownMenuLabel>
                  {lowStockNotifications.map((notification) => {
                    const categoryDisplay = notification.productName || (notification.item.subcategory
                      ? `${notification.item.category} - ${notification.item.subcategory}`
                      : notification.item.category)
                    const idStr = `low-stock-${categoryDisplay.replace(/[\s\W]+/g, "-").toLowerCase()}`
                    const isRead = readIds.includes(idStr)

                    return (
                      <DropdownMenuItem 
                        key={idStr} 
                        className={`flex items-start gap-3 p-3 cursor-pointer rounded-lg m-1 transition-all ${isRead ? 'bg-transparent' : 'bg-blue-50/60 dark:bg-gray-800'}`}
                        onClick={() => {
                          markAsRead(idStr)
                          if (notification.item.barcode) {
                            handleNavigateToItem(notification.item.barcode, categoryDisplay)
                          }
                        }}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm truncate flex items-center justify-between`}>
                            <span className={`${isRead ? 'font-medium text-gray-500 dark:text-gray-400' : 'font-bold text-gray-900 dark:text-gray-100'}`}>
                               {categoryDisplay}
                            </span>
                            {!isRead && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse flex-shrink-0" />}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            Barcode: {notification.item.barcode || "N/A"}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="destructive" className="text-xs">
                              {(() => {
                                const boxes = Math.ceil(notification.stockLevel / 25)
                                return `${boxes} box${boxes > 1 ? "es" : ""} remaining (${notification.stockLevel} kg)`
                              })()}
                            </Badge>

                          </div>
                        </div>
                      </DropdownMenuItem>
                    )
                  })}
                  {(filteredData.showExpired || filteredData.showExpiring) && <DropdownMenuSeparator />}
                </>
              )}

              {userRole !== "owner" && filteredData.showExpired && filteredData.filteredExpired.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-xs font-medium text-red-600 flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3" />
                    Expired ({filteredData.filteredExpired.length})
                  </DropdownMenuLabel>
                  {filteredData.filteredExpired.map((notification) => {
                    const categoryDisplay = notification.item.subcategory
                      ? `${notification.item.category} - ${notification.item.subcategory}`
                      : notification.item.category
                    const idStr = `expiry-${notification.status}-${notification.item.id}`
                    const isRead = readIds.includes(idStr)

                    return (
                      <DropdownMenuItem 
                         key={idStr} 
                         className={`flex items-start gap-3 p-3 cursor-pointer rounded-lg m-1 transition-all ${isRead ? 'bg-transparent' : 'bg-blue-50/60 dark:bg-gray-800'}`}
                         onClick={() => {
                           markAsRead(idStr)
                           if (notification.item.barcode) {
                             handleNavigateToItem(notification.item.barcode, categoryDisplay)
                           }
                         }}
                      >
                        <div className="flex-shrink-0 mt-0.5">{getStatusIcon(notification.status)}</div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm truncate flex items-center justify-between`}>
                            <span className={`${isRead ? 'font-medium text-gray-500 dark:text-gray-400' : 'font-bold text-gray-900 dark:text-gray-100'}`}>
                               {categoryDisplay}
                            </span>
                            {!isRead && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse flex-shrink-0" />}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            Barcode: {notification.item.barcode}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={getStatusVariant(notification.status)} className="text-xs">
                              {getStatusText(notification)}
                            </Badge>

                          </div>
                        </div>
                      </DropdownMenuItem>
                    )
                  })}
                  {filteredData.showExpiring && <DropdownMenuSeparator />}
                </>
              )}

              {userRole !== "owner" && filteredData.showExpiring && filteredData.filteredExpiring.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-xs font-medium text-orange-600 flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Expiring ({filteredData.filteredExpiring.length})
                  </DropdownMenuLabel>
                  {filteredData.filteredExpiring.map((notification) => {
                    const categoryDisplay = notification.item.subcategory
                      ? `${notification.item.category} - ${notification.item.subcategory}`
                      : notification.item.category
                    const idStr = `expiry-${notification.status}-${notification.item.id}`
                    const isRead = readIds.includes(idStr)

                    return (
                      <DropdownMenuItem 
                         key={idStr} 
                         className={`flex items-start gap-3 p-3 cursor-pointer rounded-lg m-1 transition-all ${isRead ? 'bg-transparent' : 'bg-blue-50/60 dark:bg-gray-800'}`}
                         onClick={() => {
                           markAsRead(idStr)
                           if (notification.item.barcode) {
                             handleNavigateToItem(notification.item.barcode, categoryDisplay)
                           }
                         }}
                      >
                        <div className="flex-shrink-0 mt-0.5">{getStatusIcon(notification.status)}</div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm truncate flex items-center justify-between`}>
                            <span className={`${isRead ? 'font-medium text-gray-500 dark:text-gray-400' : 'font-bold text-gray-900 dark:text-gray-100'}`}>
                               {categoryDisplay}
                            </span>
                            {!isRead && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse flex-shrink-0" />}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            Barcode: {notification.item.barcode}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={getStatusVariant(notification.status)} className="text-xs">
                              {getStatusText(notification)}
                            </Badge>

                          </div>
                        </div>
                      </DropdownMenuItem>
                    )
                  })}
                </>
              )}

              {/* ── Pending Encoder Tasks Section ── */}
              {showEncoderTasks && filteredData.showPendingTasks && pendingEncoderTasks.length > 0 && (
                <>
                  {(filteredData.showLowStock || filteredData.showExpired || filteredData.showExpiring) && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-xs font-medium text-blue-600 flex items-center gap-2">
                    <ClipboardList className="h-3 w-3" />
                    Pending Tasks ({pendingEncoderTasks.length})
                  </DropdownMenuLabel>
                  {pendingEncoderTasks.map((task) => {
                    const isRead = readPendingTaskIds.includes(task.id)
                    const invoiceNo = task.salesInvoiceNo || task.salesInvoiceNumber || "N/A"
                    const timeAgo = task.createdAt?.toDate
                      ? (() => {
                          const diffMs = Date.now() - task.createdAt.toDate().getTime()
                          const diffMins = Math.floor(diffMs / 60000)
                          const diffHours = Math.floor(diffMins / 60)
                          if (diffMins < 1) return "Just now"
                          if (diffMins < 60) return `${diffMins}m ago`
                          if (diffHours < 24) return `${diffHours}h ago`
                          return task.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        })()
                      : "Just now"

                    return (
                      <DropdownMenuItem
                        key={`pending-task-${task.id}`}
                        className={`flex items-start gap-3 p-3 cursor-pointer rounded-lg m-1 transition-all ${isRead ? 'bg-transparent' : 'bg-blue-50/60 dark:bg-blue-900/20'}`}
                        onClick={() => {
                          markPendingTaskAsRead(task.id)
                          router.push("/encoder")
                        }}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <ClipboardList className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate flex items-center justify-between">
                            <span className={`${isRead ? 'font-medium text-gray-500 dark:text-gray-400' : 'font-bold text-gray-900 dark:text-gray-100'}`}>
                              {task.customerName || "New Task"}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-400 whitespace-nowrap">{timeAgo}</span>
                              {!isRead && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse flex-shrink-0" />}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            Invoice: {invoiceNo}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs border-blue-200 text-blue-600 bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:bg-blue-900/30">
                              Ready for Processing
                            </Badge>
                          </div>
                        </div>
                      </DropdownMenuItem>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
