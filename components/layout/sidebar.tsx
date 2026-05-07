"use client"

import { useAuth } from "@/hooks/use-auth"
import { EncoderSidebar } from "@/components/sidebar/EncoderSidebar"
import { SalesSidebar } from "@/components/sidebar/SalesSidebar"
import { DefaultSidebar } from "@/components/sidebar/DefaultSidebar"

/**
 * Role-Based Sidebar Router
 *
 * Renders a completely separate sidebar component based on the
 * authenticated user's role. No menu arrays are merged — each
 * role-specific sidebar is a standalone component with its own
 * hard-coded navigation items.
 *
 * - encoder  → EncoderSidebar  (Dashboard, Inventory, Encoder Tasks, Reports, User Guide)
 * - sales    → SalesSidebar    (Dashboard, Orders, Messages, Products, Sales Reports, User Guide)
 * - others   → DefaultSidebar  (uses role-config.ts for dynamic filtering)
 */
export function Sidebar() {
  const { user } = useAuth()
  const role = user?.role

  if (role === "encoder") {
    return <EncoderSidebar />
  }

  if (role === "sales") {
    return <SalesSidebar />
  }

  // Admin, staff, purchasing, owner — use the generic sidebar with role-config filtering
  return <DefaultSidebar />
}
