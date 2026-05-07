"use client"

import { MainLayout } from "@/components/layout/main-layout"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { OrdersTable } from "@/components/orders/orders-table"

export default function OrdersPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "sales", "owner"]}>
      <MainLayout>
        <OrdersTable />
      </MainLayout>
    </ProtectedRoute>
  )
}
