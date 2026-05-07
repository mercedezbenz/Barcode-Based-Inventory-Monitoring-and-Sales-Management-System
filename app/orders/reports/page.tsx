"use client"

import { MainLayout } from "@/components/layout/main-layout"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { SalesReports } from "@/components/orders/sales-reports"

export default function SalesReportsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "sales", "owner"]}>
      <MainLayout>
        <SalesReports />
      </MainLayout>
    </ProtectedRoute>
  )
}
