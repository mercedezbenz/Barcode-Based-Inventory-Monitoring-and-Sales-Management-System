import { BarChart3, Package, FileText, ShoppingCart, KeyRound, FileBarChart2, TrendingUp } from "lucide-react"
import { MessageCircle } from "lucide-react"
/**
 * Centralized role-based access configuration.
 *
 * Every menu item and route guard references this single source of truth
 * so adding a new role or page only requires editing this file.
 */

// ─── Supported Roles ─────────────────────────────────────────────────────────
export type AppRole = "admin" | "staff" | "sales" | "purchasing" | "owner" | "encoder"

// ─── Sidebar Menu Items ──────────────────────────────────────────────────────
export interface MenuItem {
  label: string
  href: string
  icon: any
  /** Which roles can see this menu item */
  roles: AppRole[]
}

export const MENU_ITEMS: MenuItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: BarChart3,
    roles: ["admin", "staff", "sales", "purchasing", "owner", "encoder"],
  },
  {
    label: "Inventory",
    href: "/inventory",
    icon: Package,
    roles: ["admin", "staff", "purchasing", "owner", "encoder"],
  },
  {
    label: "Orders",
    href: "/orders",
    icon: ShoppingCart,
    roles: ["sales"],
  },
  {
    label: "Encoder Tasks",
    href: "/encoder",
    icon: KeyRound,
    roles: ["admin", "encoder"],
  },
  {
    label: "Reports",
    href: "/encoder/reports",
    icon: FileBarChart2,
    roles: ["admin", "encoder"],
  },

  // ✅ NEW
  {
    label: "Messages",
    href: "/messages",
    icon: MessageCircle,
    roles: ["sales"],
  },
  {
    label: "Sales Reports",
    href: "/orders/reports",
    icon: TrendingUp,
    roles: ["sales",]
  },
  {
    label: "Products",
    href: "/products",
    icon: Package, 
    roles: ["sales"], 
  },
]

// ─── Route Access Map ────────────────────────────────────────────────────────
// Maps each route prefix to the roles that can access it.
// If a user navigates to a route they don't have access to,
// they get silently redirected to "/" (dashboard).
export const ROUTE_ACCESS: Record<string, AppRole[]> = {
  "/":           ["admin", "staff", "sales", "purchasing", "owner", "encoder"],
  "/inventory":  ["admin", "staff", "purchasing", "owner", "encoder"],

  "/stock-logs": ["admin", "staff", "purchasing"],
  "/deliveries": ["admin", "staff"],
  "/users":      ["admin"],
  "/orders":     ["sales"],
  "/orders/reports": ["sales", "admin", "owner"],
  "/encoder":    ["admin", "encoder"],
  "/encoder/reports": ["admin", "encoder"],

  // ✅ NEW
  "/messages":   ["sales"],
  "/products":   ["sales"], 
}

/**
 * Check whether a role can access a given pathname.
 * Falls back to `true` for unregistered routes (e.g. /login, /print-label).
 */
export function canAccessRoute(role: string | undefined, pathname: string): boolean {
  if (!role) return false

  // Find the most specific matching route prefix
  const matchingRoutes = Object.keys(ROUTE_ACCESS)
    .filter((route) => pathname === route || (route !== "/" && pathname.startsWith(route)))
    .sort((a, b) => b.length - a.length) // most specific first

  if (matchingRoutes.length === 0) {
    // Route not in ROUTE_ACCESS — allow (e.g. /login, /print-label, /setup)
    return true
  }

  const allowedRoles = ROUTE_ACCESS[matchingRoutes[0]]
  return allowedRoles.includes(role as AppRole)
}

/**
 * Return only the menu items the given role can see.
 */
export function getMenuItemsForRole(role: string | undefined): MenuItem[] {
  if (!role) return []
  return MENU_ITEMS.filter((item) => item.roles.includes(role as AppRole))
}
