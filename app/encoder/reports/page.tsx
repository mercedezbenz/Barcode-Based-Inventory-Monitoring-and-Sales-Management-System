"use client"

import { MainLayout } from "@/components/layout/main-layout"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { EncoderReports } from "@/components/encoder/encoder-reports"

export default function EncoderReportsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "encoder"]}>
      <MainLayout>
        <EncoderReports />
      </MainLayout>
    </ProtectedRoute>
  )
}
