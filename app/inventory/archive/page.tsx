import { MainLayout } from "@/components/layout/main-layout"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { InventoryDashboard } from "@/components/inventory/inventory-dashboard"
import { Suspense } from "react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: 'Archived Inventory | System',
  description: 'View and restore archived inventory items',
}

export default function ArchivedInventoryPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "staff", "purchasing", "owner", "encoder"]}>
      <MainLayout>
        <Suspense fallback={<div>Loading Archive Dashboard...</div>}>
          <InventoryDashboard isArchiveView={true} />
        </Suspense>
      </MainLayout>
    </ProtectedRoute>
  )
}
