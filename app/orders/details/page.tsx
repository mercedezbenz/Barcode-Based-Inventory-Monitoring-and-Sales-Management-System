"use client"

import { useSearchParams } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { OrderDetails } from "@/components/orders/order-details"
import { Suspense } from "react"

function OrderDetailContent() {
  const searchParams = useSearchParams()
  const orderId = searchParams?.get("id") as string

  if (!orderId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No order ID provided</p>
      </div>
    )
  }

  return <OrderDetails orderId={orderId} />
}

export default function OrderDetailPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "sales", "owner"]}>
      <MainLayout>
        <Suspense fallback={<div>Loading order...</div>}>
          <OrderDetailContent />
        </Suspense>
      </MainLayout>
    </ProtectedRoute>
  )
}
