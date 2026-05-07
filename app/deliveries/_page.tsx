import { MainLayout } from "@/components/layout/main-layout"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { DeliveryDashboard } from "@/components/deliveries/delivery-dashboard"

export default function DeliveriesPage() {
  return (
    <ProtectedRoute>
      <MainLayout>
        <DeliveryDashboard />
      </MainLayout>
    </ProtectedRoute>
  )
}
