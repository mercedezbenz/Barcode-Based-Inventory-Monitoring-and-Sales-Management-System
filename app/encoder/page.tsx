"use client"

import { MainLayout } from "@/components/layout/main-layout"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { EncoderDashboard } from "@/components/encoder/encoder-dashboard"

export default function EncoderPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "encoder"]}>
      <MainLayout>
        <EncoderDashboard />
      </MainLayout>
    </ProtectedRoute>
  )
}
