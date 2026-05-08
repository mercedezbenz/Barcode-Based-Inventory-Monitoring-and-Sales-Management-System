"use client"

import { MainLayout } from "@/components/layout/main-layout"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { ActivityDashboard } from "@/components/owner/activity-dashboard"

export default function ActivityLogsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "owner"]}>
      <MainLayout>
        <ActivityDashboard />
      </MainLayout>
    </ProtectedRoute>
  )
}
