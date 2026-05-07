"use client"

import { usePathname } from "next/navigation"
import { useLayoutEffect } from "react"

export function ConditionalHtmlClass() {
  const pathname = usePathname()
  const isLoginRoute = pathname === "/login" || pathname?.startsWith("/login") || pathname?.startsWith("/auth")

  // Ensure login/auth routes never have the dark class.
  // For other routes, let next-themes handle theming via ThemeProvider.
  useLayoutEffect(() => {
    if (isLoginRoute) {
      const html = document.documentElement
      html.classList.remove("dark")
      html.style.colorScheme = "light"
    }
  }, [isLoginRoute])

  return null
}
