"use client"

import { usePathname } from "next/navigation"
import { ThemeProvider } from "@/components/theme-provider"
import { SidebarProvider } from "@/components/layout/sidebar-context"
import { AuthProvider } from "@/hooks/use-auth"
import { Toaster } from "@/components/ui/sonner"

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginRoute      = pathname === "/login" || pathname?.startsWith("/login") || pathname?.startsWith("/auth")
  const isPrintLabelRoute = pathname?.startsWith("/print-label")

  // For login/auth routes, return children ONLY - no wrappers at all
  // The login/layout.tsx will provide AuthProvider separately
  if (isLoginRoute) {
    return <>{children}</>
  }

  // Print-label page: bare white page — no sidebar, no header, no theme flicker
  if (isPrintLabelRoute) {
    return <>{children}</>
  }

  // For all other routes, use full layout with theme and sidebar
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <SidebarProvider>
        <AuthProvider>{children}</AuthProvider>
      </SidebarProvider>
      {/* Sonner toast notifications — mounted once at the root */}
      <Toaster />
    </ThemeProvider>
  )
}
