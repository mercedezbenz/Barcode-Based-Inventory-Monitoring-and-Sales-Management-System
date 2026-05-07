"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { SalesDashboard } from "@/components/dashboard/sales-dashboard";
import { useAuth } from "@/hooks/use-auth";
import { AuthLoadingSkeleton } from "@/components/skeletons/dashboard-skeleton";
import { LoggingOutOverlay } from "@/components/auth/logging-out-overlay";

export default function HomePage() {
  const { user, loading, isLoggingOut } = useAuth()
  const router = useRouter()

  // Redirect if NOT authenticated at all (but not during logout)
  useEffect(() => {
    if (!loading && !user && !isLoggingOut) {
      console.log("[HomePage] No user found, redirecting to /login")
      router.replace("/login")
    }
  }, [user, loading, isLoggingOut, router])

  // Show clean logout overlay — no dashboard flicker
  if (isLoggingOut) {
    return <LoggingOutOverlay />
  }

  // Show loading while checking auth
  if (loading) {
    return <AuthLoadingSkeleton />
  }

  // Not authenticated
  if (!user) {
    return <AuthLoadingSkeleton />
  }

  // ─── Role-Based Dashboard Switching ───
  // Each role sees the dashboard relevant to them.
  // No "Access Denied" screens — just the right content.

  const role = user.role

  // Sales users see the Sales Dashboard
  if (role === "sales") {
    return (
      <MainLayout>
        <SalesDashboard />
      </MainLayout>
    )
  }

  // All other roles (admin, staff, purchasing, guest) see the inventory dashboard
  return (
    <MainLayout>
      <DashboardOverview />
    </MainLayout>
  );
}
