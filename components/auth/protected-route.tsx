"use client"

import type React from "react"
import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"

import { useAuth } from "@/hooks/use-auth"
import { canAccessRoute } from "@/lib/role-config"
import { AuthLoadingSkeleton } from "@/components/skeletons/dashboard-skeleton"
import { LoggingOutOverlay } from "@/components/auth/logging-out-overlay"

interface ProtectedRouteProps {
  children: React.ReactNode
  /** Optional: restrict to specific roles (overrides role-config) */
  allowedRoles?: string[]
}

/**
 * ProtectedRoute — Role-based route guard.
 *
 * Instead of showing "Access Denied" or "No Access" pages,
 * users are **silently redirected** to the dashboard ("/")
 * if they try to access a route their role doesn't allow.
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading, isLoggingOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // ONLY redirect to /login if NOT authenticated (and not during logout)
    if (!loading && !user && !isLoggingOut) {
      console.log("[ProtectedRoute] No user found, redirecting to /login")
      router.push("/login")
      return
    }

    // Role-based access check — redirect to dashboard if not allowed
    if (!loading && user && pathname) {
      const role = user.role

      // If explicit allowedRoles prop is provided, use that
      if (allowedRoles && allowedRoles.length > 0) {
        if (!allowedRoles.includes(role)) {
          console.log(`[ProtectedRoute] Role "${role}" not in allowedRoles [${allowedRoles}], redirecting to /`)
          router.replace("/")
          return
        }
      }

      // Otherwise, use the centralized role-config
      if (!canAccessRoute(role, pathname)) {
        console.log(`[ProtectedRoute] Role "${role}" cannot access "${pathname}", redirecting to /`)
        router.replace("/")
        return
      }
    }
  }, [user, loading, isLoggingOut, router, pathname, allowedRoles])

  // Show clean logout overlay — no dashboard flicker
  if (isLoggingOut) {
    return <LoggingOutOverlay />
  }

  // Show loading spinner while auth is initializing
  if (loading) {
    return <AuthLoadingSkeleton />
  }

  // Not authenticated — show skeleton while redirect happens
  if (!user) {
    return <AuthLoadingSkeleton />
  }

  // Check role access before rendering (prevents flash of restricted content)
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <AuthLoadingSkeleton />
  }

  if (pathname && !canAccessRoute(user.role, pathname)) {
    return <AuthLoadingSkeleton />
  }

  return <>{children}</>
}
