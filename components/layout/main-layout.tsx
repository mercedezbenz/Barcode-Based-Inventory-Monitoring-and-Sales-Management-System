"use client"

import type React from "react"
import { Sidebar } from "./sidebar"
import { Header } from "./header"
import { useSidebar } from "./sidebar-context"
import { GlobalChatListener } from "../chat/global-chat-listener"
import { GlobalOrderListener } from "../notifications/global-order-listener"
import { EncoderTaskListener } from "../notifications/encoder-task-listener"
import { UserManualModal } from "./user-manual-modal"
import { useAuth } from "@/hooks/use-auth"
import { useCallback } from "react"

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { isCollapsed, showManual, setShowManual, isWelcomeManual, setIsWelcomeManual } = useSidebar()
  const { user } = useAuth()

  const handleManualClose = useCallback(() => {
    setShowManual(false)
    if (isWelcomeManual && user?.email) {
      localStorage.setItem(`seenManual_${user.email}`, "true")
      setIsWelcomeManual(false)
    }
  }, [isWelcomeManual, user?.email, setShowManual, setIsWelcomeManual])

  return (
  <div className="min-h-screen bg-background">
    <GlobalChatListener />
    <GlobalOrderListener />

    <EncoderTaskListener />

    <Sidebar />
      <div className={isCollapsed ? "md:ml-16" : "md:ml-64"} style={{ transition: "margin-left 200ms ease-in-out" }}>
        <Header />
        <main className="p-3 sm:p-4 md:p-6 pt-16 md:pt-3">{children}</main>
      </div>

      {/* User Manual Modal */}
      <UserManualModal
        open={showManual}
        onClose={handleManualClose}
        isWelcome={isWelcomeManual}
        defaultTab={
          isWelcomeManual
            ? (() => {
                const r = user?.role?.toLowerCase().trim()
                return r === "sales" ? "sales"
                  : r === "encoder" ? "encoder"
                  : r === "owner" ? "owner"
                  : "general"
              })()
            : undefined
        }
      />
    </div>
  )
}
