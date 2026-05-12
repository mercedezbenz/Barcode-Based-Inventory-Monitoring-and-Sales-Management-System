"use client"

import { MainLayout } from "@/components/layout/main-layout"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { UserManagementDashboard } from "@/components/owner/user-management-dashboard"

export default function UserManagementPage() {
  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <MainLayout>
        <UserManagementDashboard />
      </MainLayout>
    </ProtectedRoute>
  )
}
