"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Bell, Package, Truck, CheckCircle2, XCircle, ShoppingCart, Settings, Check } from "lucide-react"
import { useNotifications } from "@/hooks/useNotifications"
import { useRouter } from "next/navigation"

const parseTimestamp = (ts: any): Date => {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  if (typeof ts === "string") return new Date(ts)
  if (ts?.toDate) return ts.toDate()
  if (ts?.seconds) return new Date(ts.seconds * 1000)
  return new Date()
}

const formatRelativeTime = (date: Date) => {
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInMins = Math.floor(diffInMs / 60000)
  const diffInHours = Math.floor(diffInMins / 60)

  if (diffInMins < 1) return "Just now"
  if (diffInMins < 60) return `${diffInMins}m ago`
  if (diffInHours < 24) return `${diffInHours}h ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const getStatusConfig = (title: string, message: string) => {
  const lTitle = title.toLowerCase();
  if (lTitle.includes("new order") || lTitle.includes("pending")) {
    return { color: "text-purple-600 bg-purple-100 border-purple-200 dark:text-purple-400 dark:bg-purple-900/40 dark:border-purple-800", icon: <ShoppingCart className="h-4 w-4" /> }
  }
  if (lTitle.includes("processing")) {
    return { color: "text-yellow-600 bg-yellow-100 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/40 dark:border-yellow-800", icon: <Settings className="h-4 w-4" /> }
  }
  if (lTitle.includes("delivery")) {
    return { color: "text-emerald-600 bg-emerald-100 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/40 dark:border-emerald-800", icon: <Truck className="h-4 w-4" /> }
  }
  if (lTitle.includes("completed")) {
    return { color: "text-teal-600 bg-teal-100 border-teal-200 dark:text-teal-400 dark:bg-teal-900/40 dark:border-teal-800", icon: <CheckCircle2 className="h-4 w-4" /> }
  }
  if (lTitle.includes("failed") || lTitle.includes("issue")) {
    return { color: "text-red-600 bg-red-100 border-red-200 dark:text-red-400 dark:bg-red-900/40 dark:border-red-800", icon: <XCircle className="h-4 w-4" /> }
  }
  return { color: "text-gray-600 bg-gray-100 border-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:border-gray-700", icon: <Package className="h-4 w-4" /> }
}

export function SalesNotifications({ userRole }: { userRole?: string }) {
  const { notifications, loading, markAsRead, markAllAsRead } = useNotifications(userRole)
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  // 1. Normalize all notification types to lowercase
  const normalizedNotifications = useMemo(() => {
    return notifications.map(n => ({
      ...n,
      type: typeof n.type === "string" ? n.type.toLowerCase() : String(n.type || "").toLowerCase(),
    }));
  }, [notifications]);

  const unreadCount = normalizedNotifications.filter(n => !n.isRead).length

  // 2. Group by Today and Earlier
  const groupedNotifications = useMemo(() => {
    const today: typeof notifications = []
    const earlier: typeof notifications = []

    const todayDate = new Date()
    todayDate.setHours(0,0,0,0)

    normalizedNotifications.forEach(n => {
      const d = parseTimestamp(n.createdAt)
      d.setHours(0,0,0,0)
      if (d.getTime() === todayDate.getTime()) {
        today.push(n as any)
      } else {
        earlier.push(n as any)
      }
    })

    return { today, earlier }
  }, [normalizedNotifications])

  const handleView = (orderId?: string | any, notifId?: string) => {
    if (notifId) markAsRead(notifId)
    setIsOpen(false)
      
    if (!orderId) {
      console.warn("No route attached to this notification")
      return
    }
    router.push(`/orders/details?id=${orderId}`)
  }

  const Section = ({ title, items }: { title: string, items: typeof notifications }) => {
    if (items.length === 0) return null
    return (
      <div className="mb-4 last:mb-0">
        <h4 className="text-[11px] font-bold text-gray-400 dark:text-muted-foreground uppercase tracking-widest px-3 mb-2">
          {title}
        </h4>
        <div className="space-y-1.5 px-1.5">
          {items.map(notif => {
            const config = getStatusConfig(notif.title, notif.message)
            return (
              <DropdownMenuItem 
                key={notif.id} 
                className={`flex flex-col items-start p-3 cursor-pointer rounded-xl transition-all duration-200 border bg-white dark:bg-card
                  hover:shadow-md hover:border-gray-300 dark:hover:border-border
                  ${notif.isRead ? 'border-gray-100 opacity-75' : 'border-gray-200 shadow-sm'}
                `}
                onClick={() => handleView((notif as any).orderId, notif.id)}
              >
                <div className="flex w-full items-start gap-3">
                  {/* Icon */}
                  <div className={`mt-0.5 flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full border ${config.color}`}>
                    {config.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-semibold text-sm ${notif.isRead ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-foreground'}`}>
                          {notif.title}
                        </span>
                        {!notif.isRead && (
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                        )}
                      </div>
                      <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap">
                        {formatRelativeTime(parseTimestamp(notif.createdAt))}
                      </span>
                    </div>

                    <p className="text-[13px] text-gray-600 dark:text-gray-400 mb-2.5 truncate">
                      {notif.message}
                    </p>

                    <div className="flex items-center justify-between mt-auto">
                      <Badge variant="outline" className={`text-[10px] px-2 py-0.5 border ${config.color}`}>
                        {notif.type}
                      </Badge>
                      
                      {(notif as any).orderId && (
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="h-6 text-[11px] px-2.5 rounded-md hover:bg-gray-200 dark:hover:bg-secondary/80 font-semibold"
                          onClick={(e) => { e.stopPropagation(); handleView((notif as any).orderId, notif.id); }}
                        >
                          View Order
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="relative inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0"
          >
            <Bell className={unreadCount > 0 ? "h-5 w-5 animate-pulse" : "h-5 w-5"} />
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
        <DropdownMenuContent align="end" className="w-[360px] rounded-2xl p-0 overflow-hidden border border-gray-200 dark:border-border shadow-xl">
          <div className="bg-gray-50/80 dark:bg-card px-4 py-3 border-b border-gray-100 dark:border-border flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
            <span className="font-bold text-gray-900 dark:text-foreground flex items-center gap-2 text-sm text-[15px]">
              {userRole?.toLowerCase() === "encoder" ? "Encoder Notifications" : userRole?.toLowerCase() === "admin" ? "Admin Notifications" : "Sales Notifications"}
              {unreadCount > 0 && (
                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-200 border-0 h-5 px-1.5 text-[11px]">
                  {unreadCount} new
                </Badge>
              )}
            </span>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); markAllAsRead(); }}
                className="h-7 text-[11px] px-2 text-gray-500 hover:text-gray-900 dark:hover:text-foreground font-medium"
              >
                <Check className="h-3 w-3 mr-1" /> Mark all read
              </Button>
            )}
          </div>
          
          <div className="max-h-[420px] overflow-y-auto p-1.5 pt-3 custom-scrollbar bg-gray-50/30 dark:bg-background/50">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center">
                <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-blue-500 animate-spin mb-3" />
                Loading {userRole?.toLowerCase() === "encoder" ? "tasks" : "updates"}...
              </div>
            ) : normalizedNotifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 flex flex-col items-center">
                 <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-secondary/50 flex items-center justify-center mb-3">
                    <CheckCircle2 className="h-6 w-6 text-gray-400" />
                 </div>
                 <p className="font-medium text-gray-900 dark:text-foreground">You&apos;re all caught up!</p>
                 <p className="text-xs mt-1">No pending notifications.</p>
              </div>
            ) : (
              <>
                <Section title="Today" items={groupedNotifications.today} />
                <Section title="Earlier" items={groupedNotifications.earlier} />
              </>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
