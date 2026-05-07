"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Menu, X, ChevronLeft, ChevronRight, HelpCircle, BarChart3, ShoppingCart, MessageCircle, Package, TrendingUp } from "lucide-react"
import Image from "next/image"
import { useSidebar } from "../layout/sidebar-context"
import { useNotifications } from "@/hooks/useNotifications"

// ─── Sales-Only Navigation Items ─────────────────────────────────────────────
const SALES_NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: BarChart3 },
  { label: "Orders", href: "/orders", icon: ShoppingCart },
  { label: "Messages", href: "/messages", icon: MessageCircle },
  { label: "Products", href: "/products", icon: Package },
  { label: "Sales Reports", href: "/orders/reports", icon: TrendingUp },
]

export function SalesSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { isCollapsed, toggleSidebar, setShowManual, setIsWelcomeManual } = useSidebar()
  const { notifications } = useNotifications("sales")

  const handleManualOpen = () => {
    setIsWelcomeManual(false)
    setShowManual(true)
    setIsOpen(false)
  }

  const hasUnreadOrders = notifications.some(n =>
    !n.isRead &&
    (n.type?.toLowerCase() === "new_order" || n.title?.toLowerCase().includes("new order"))
  )
  const showOrdersBadge = hasUnreadOrders && !pathname?.startsWith("/orders")

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden h-10 w-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm shadow-md border border-border/40 rounded-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 bg-white dark:bg-sidebar border-r border-gray-200 dark:border-sidebar-border transform transition-all duration-200 ease-in-out md:translate-x-0 shadow-lg w-72 sm:w-72",
          isOpen ? "translate-x-0" : "-translate-x-full",
          isCollapsed ? "md:w-16" : "md:w-64",
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className={cn(
            "flex items-center border-b border-gray-200 dark:border-sidebar-border transition-all duration-200",
            isCollapsed ? "px-2 py-4 justify-center" : "px-6 py-6"
          )}>
            {isCollapsed ? (
              <div className="relative">
                <Image
                  src="/logo.png"
                  alt="DPE Logo"
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
            ) : (
              <div className="flex items-center">
                <div className="mr-3 relative">
                  <Image
                    src="/logo.png"
                    alt="DPE Logo"
                    width={60}
                    height={60}
                    className="object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-800 dark:text-sidebar-foreground">
                    Deckta<span className="text-sky-500">GO</span>
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-muted-foreground">Pacific Equities</p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation — Sales items ONLY */}
          <nav className={cn(
            "flex-1 py-6 space-y-2 transition-all duration-200",
            isCollapsed ? "px-2" : "px-4"
          )}>
            {SALES_NAV_ITEMS.map((item) => {
              const isActive = (() => {
                if (item.href === "/") return pathname === "/"
                if (!pathname?.startsWith(item.href)) return false
                const hasMoreSpecificMatch = SALES_NAV_ITEMS.some(
                  (other) =>
                    other.href !== item.href &&
                    other.href.startsWith(item.href) &&
                    pathname?.startsWith(other.href)
                )
                return !hasMoreSpecificMatch
              })()
              const isOrdersTab = item.label === "Orders"

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center text-sm font-medium rounded-lg transition-all duration-200 relative",
                    isCollapsed ? "px-2 py-3 justify-center" : "px-4 py-3",
                    isActive
                      ? "bg-sky-500 text-white shadow-md"
                      : "text-gray-600 dark:text-sidebar-foreground hover:bg-gray-100 dark:hover:bg-sidebar-accent/10 hover:text-gray-800 dark:hover:text-sidebar-accent",
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <div className="relative flex items-center justify-center">
                    <item.icon className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
                    {isOrdersTab && showOrdersBadge && (
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white dark:border-gray-900"></span>
                      </span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <div className="flex flex-1 items-center justify-between">
                      <span>{item.label}</span>
                      {isOrdersTab && showOrdersBadge && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                          !
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              )
            })}

            {/* Help/User Guide */}
            <button
              onClick={handleManualOpen}
              className={cn(
                "w-full flex items-center text-sm font-medium rounded-lg transition-all duration-200 relative",
                isCollapsed ? "px-2 py-3 justify-center" : "px-4 py-3",
                "text-gray-600 dark:text-sidebar-foreground hover:bg-gray-100 dark:hover:bg-sidebar-accent/10 hover:text-gray-800 dark:hover:text-sidebar-accent",
              )}
              title={isCollapsed ? "User Guide" : undefined}
            >
              <HelpCircle className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
              {!isCollapsed && <span>User Guide</span>}
            </button>
          </nav>

          {/* Collapse Toggle Button (Desktop only) */}
          <div className="hidden md:block border-t border-gray-200 dark:border-sidebar-border p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="w-full justify-center"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div className="fixed inset-0 z-30 bg-black bg-opacity-50 md:hidden" onClick={() => setIsOpen(false)} />
      )}
    </>
  )
}
