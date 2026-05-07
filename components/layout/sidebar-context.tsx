"use client"

import { createContext, useContext, useState, useEffect } from "react"

interface SidebarContextType {
  isCollapsed: boolean
  toggleSidebar: () => void
  showManual: boolean
  setShowManual: (open: boolean) => void
  isWelcomeManual: boolean
  setIsWelcomeManual: (isWelcome: boolean) => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

// Function to get initial state from localStorage (safe for SSR)
function getInitialSidebarState(): boolean {
  if (typeof window === "undefined") return false
  try {
    const saved = localStorage.getItem("sidebar-collapsed")
    return saved !== null ? JSON.parse(saved) : false
  } catch {
    return false
  }
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Initialize state from localStorage immediately
  const [isCollapsed, setIsCollapsed] = useState(getInitialSidebarState)
  const [isMounted, setIsMounted] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [isWelcomeManual, setIsWelcomeManual] = useState(false)

  // Mark as mounted after first render
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Sync with localStorage when state changes (only after mount)
  useEffect(() => {
    if (isMounted) {
      try {
        localStorage.setItem("sidebar-collapsed", JSON.stringify(isCollapsed))
      } catch (error) {
        console.error("[Sidebar] Failed to save state to localStorage:", error)
      }
    }
  }, [isCollapsed, isMounted])

  const toggleSidebar = () => {
    setIsCollapsed((prev) => !prev)
  }

  return (
    <SidebarContext.Provider 
      value={{ 
        isCollapsed, 
        toggleSidebar, 
        showManual, 
        setShowManual, 
        isWelcomeManual, 
        setIsWelcomeManual 
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}
