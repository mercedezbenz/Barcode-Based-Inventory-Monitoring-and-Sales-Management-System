"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LogOut, Moon, Sun, Menu, HelpCircle } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { ExpiryNotifications } from "@/components/notifications/expiry-notifications"
import { SalesNotifications } from "@/components/notifications/sales-notifications"
import { ChatNotifications } from "@/components/notifications/chat-notifications"
import { useTheme } from "next-themes"
import { useSidebar } from "./sidebar-context"

export function Header() {
  const { user, logout } = useAuth()
  console.log("[Header] Current User Role:", user?.role)
  const { setTheme, theme } = useTheme()
  const { toggleSidebar, setShowManual, setIsWelcomeManual } = useSidebar()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  // Auto-open manual on first visit (per user)
  useEffect(() => {
    if (!user?.email) return
    const key = `seenManual_${user.email}`
    const seen = localStorage.getItem(key)
    if (!seen) {
      setIsWelcomeManual(true)
      setShowManual(true)
    }
  }, [user?.email, setIsWelcomeManual, setShowManual])

  const handleManualOpen = useCallback(() => {
    setIsWelcomeManual(false)
    setShowManual(true)
  }, [setIsWelcomeManual, setShowManual])

  const handleLogout = async () => {
    try {
      await logout()
      // Logout function handles redirect internally
    } catch (error) {
      console.error("[Header] Logout error:", error)
      // Logout function will still redirect even on error
    }
  }

  const getUserInitials = (email: string) => {
    return email
      .split("@")[0]
      .split(".")
      .map((part) => part.charAt(0).toUpperCase())
      .join("")
      .slice(0, 2)
  }

  return (
    <>
      <header className="bg-card border-b border-border px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 relative z-10">
        <div className="flex items-center justify-between">
          {/* Left side - Sidebar toggle (Desktop only, hamburger handles mobile) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="hidden md:flex h-8 w-8"
            title="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Spacer for mobile to push right-side items */}
          <div className="md:hidden flex-1" />

          {/* Right side */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Notifications based on role */}
            {(() => {
              const normalizedRole = user?.role?.toLowerCase().trim()
              return (
                <>
                  {normalizedRole === "sales" && (
                    <>
                      <SalesNotifications userRole={normalizedRole} />
                      <ChatNotifications userRole={normalizedRole} />
                    </>
                  )}
                  {normalizedRole === "encoder" && (
                    <ExpiryNotifications />
                  )}
                  {["admin", "inventory", "purchasing", "owner"].includes(normalizedRole || "") && (
                    <ExpiryNotifications />
                  )}
                </>
              )
            })()}

            {/* User Manual button */}
            <button
              onClick={handleManualOpen}
              className="relative inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0 text-gray-500 dark:text-gray-400"
              title="User Manual"
            >
              <HelpCircle className="h-5 w-5" />
            </button>


            {/* User menu */}
            <div className="relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="relative inline-flex items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{user?.email ? getUserInitials(user.email) : "AD"}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-[280px] p-4 rounded-xl shadow-lg border border-gray-100 dark:border-border bg-white dark:bg-gray-900 animate-in fade-in slide-in-from-top-2 duration-200 ease-in-out"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="h-10 w-10 border border-gray-100 dark:border-gray-800">
                    <AvatarFallback className="bg-primary/5 text-primary text-sm font-bold">
                       {user?.email ? getUserInitials(user.email) : "AD"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-none truncate mb-1">
                      {(user as any)?.name || (user as any)?.displayName || (user?.role === "admin" ? "Admin User" : user?.role === "sales" ? "Sales User" : user?.role === "purchasing" ? "Purchasing User" : user?.role === "owner" ? "Owner" : user?.role === "encoder" ? "Encoder" : user?.role || "User")}
                    </p>
                    <p className="text-xs text-muted-foreground leading-none truncate mb-2">
                       {user?.email || "No email"}
                    </p>
                    {user?.role && (
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 text-[10px] font-semibold tracking-wide uppercase w-fit">
                        {user.role}
                      </span>
                    )}
                  </div>
                </div>
                
                <DropdownMenuSeparator className="bg-gray-100 dark:bg-gray-800 my-2"/>
                
                <DropdownMenuItem 
                  onClick={(e) => {
                     e.preventDefault()
                     setTheme(theme === "light" ? "dark" : "light")
                  }} 
                  className="flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-gray-50 focus:bg-gray-50 dark:hover:bg-gray-800 dark:focus:bg-gray-800 transition-colors my-1"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                       {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Appearance</span>
                  </div>
                  
                  {/* Toggle Switch UI */}
                  <div className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${theme === 'dark' ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem 
                  onClick={handleManualOpen} 
                  className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 focus:bg-gray-50 dark:hover:bg-gray-800 dark:focus:bg-gray-800 transition-colors my-1"
                >
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                    <HelpCircle className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">User Guide</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-gray-100 dark:bg-gray-800 my-2"/>
                
                <DropdownMenuItem 
                  onClick={() => setShowLogoutConfirm(true)} 
                  className="w-full flex items-center gap-3 p-2.5 cursor-pointer rounded-lg font-medium text-gray-600 dark:text-gray-300 hover:bg-red-50 hover:text-red-600 focus:bg-red-50 focus:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 dark:focus:bg-red-900/30 dark:focus:text-red-400 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="text-sm">Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* ── Logout Confirmation Modal ── */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent className="sm:max-w-[420px]">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
                <LogOut className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg">Confirm Logout</AlertDialogTitle>
              </div>
            </div>
            <AlertDialogDescription className="pt-2 text-sm text-muted-foreground">
              Are you sure you want to log out? You will need to sign in again to access the dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel className="rounded-lg">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="rounded-lg bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  )
}
