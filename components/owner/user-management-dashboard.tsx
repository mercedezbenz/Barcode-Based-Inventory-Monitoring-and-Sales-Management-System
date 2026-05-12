"use client"

import { useState, useEffect, useMemo } from "react"
import { collection, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase-live"
import { useAuth } from "@/hooks/use-auth"
import { logActivity } from "@/lib/activity-logger"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import {
  Users, UserCheck, UserX, ShieldCheck, Search, Filter,
  ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, Clock, CheckCircle2, XCircle,
  RefreshCw, Trash2, KeyRound, ShieldAlert, UserCog
} from "lucide-react"

// ─── Types ──────────────────────────────────────────────────────────────────
interface UserDoc {
  uid: string
  name?: string
  fullName?: string
  email: string
  role: "pending" | "sales" | "encoder" | "owner" | "admin" | "staff" | "customer"
  status?: "active" | "inactive"
  createdAt?: any
  approvedAt?: any
  approvedBy?: string | null
}

type ActionType = "approve" | "changeRole" | "deactivate" | "reactivate" | "remove" | "resetPassword"

interface PendingAction {
  type: ActionType
  user: UserDoc
  newRole?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatDate(ts: any): string {
  if (!ts) return "—"
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function getUserDisplayName(u: UserDoc) {
  return u.name || u.fullName || u.email?.split("@")[0] || "Unknown"
}

const ROLE_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  sales: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  encoder: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  owner: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  admin: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  staff: "bg-gray-100 text-gray-800 dark:bg-gray-800/60 dark:text-gray-300 border-gray-200 dark:border-gray-700",
  customer: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border-teal-200 dark:border-teal-800",
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  inactive: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
}

// ─── Component ──────────────────────────────────────────────────────────────
export function UserManagementDashboard() {
  const { user: currentUser } = useAuth()
  const { toast } = useToast()
  const [users, setUsers] = useState<UserDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({})
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<PendingAction | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // ─── Realtime Listener ──────────────────────────────────────────────────
  useEffect(() => {
    const db = getFirebaseDb()
    if (!db) return
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"))
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserDoc))
      setUsers(data)
      setLoading(false)
    }, (err) => {
      console.error("[UserMgmt] Snapshot error:", err)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // ─── Filtered Users ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (u.role === "owner") return false // Don't show owner in the list
      const normalizedRole = u.role?.toLowerCase().trim()
      const q = searchQuery.toLowerCase()
      const nameMatch = getUserDisplayName(u).toLowerCase().includes(q)
      const emailMatch = u.email?.toLowerCase().includes(q)
      if (q && !nameMatch && !emailMatch) return false
      if (roleFilter !== "all" && normalizedRole !== roleFilter) return false
      const userStatus = normalizedRole === "pending" ? "pending" : (u.status || "active")
      if (statusFilter !== "all" && userStatus !== statusFilter) return false
      return true
    })
  }, [users, searchQuery, roleFilter, statusFilter])

  // ─── Pagination ─────────────────────────────────────────────────────────
  useEffect(() => { setCurrentPage(1) }, [searchQuery, roleFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedUsers = filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage)
  const startIndex = filtered.length > 0 ? (safePage - 1) * rowsPerPage + 1 : 0
  const endIndex = Math.min(safePage * rowsPerPage, filtered.length)

  // ─── KPI Stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const nonOwner = users.filter((u) => u.role !== "owner")
    const employees = nonOwner.filter((u) => u.role?.toLowerCase().trim() !== "customer")
    return {
      total: employees.length,
      pending: employees.filter((u) => u.role === "pending").length,
      sales: employees.filter((u) => u.role === "sales").length,
      encoder: employees.filter((u) => u.role === "encoder").length,
      customers: nonOwner.filter((u) => u.role?.toLowerCase().trim() === "customer").length,
    }
  }, [users])

  // ─── Actions ────────────────────────────────────────────────────────────
  async function executeAction(action: PendingAction) {
    const db = getFirebaseDb()
    if (!db || !currentUser) return
    setActionLoading(action.user.uid)
    try {
      const ref = doc(db, "users", action.user.uid)
      const displayName = getUserDisplayName(action.user)

      // ─── SAFETY: Block any role modification on customer accounts ─────
      const currentRole = action.user.role?.toLowerCase().trim()
      if (currentRole === "customer" && (action.type === "approve" || action.type === "changeRole")) {
        toast({ title: "Blocked", description: "Customer accounts cannot be reassigned.", variant: "destructive" })
        setActionLoading(null)
        return
      }

      switch (action.type) {
        case "approve": {
          const rawRole = action.newRole || selectedRoles[action.user.uid]
          if (!rawRole) return
          // Normalize role to lowercase to prevent role detection bugs
          const role = rawRole.toLowerCase().trim()
          await updateDoc(ref, {
            role,
            status: "active",
            approvedAt: serverTimestamp(),
            approvedBy: currentUser.uid,
            updatedAt: new Date().toISOString(),
          })
          await logActivity({ type: "user_approved", message: `Owner approved ${displayName} as ${role}`, performedBy: currentUser.uid, role: "owner" })
          toast({ title: "User Approved", description: `${displayName} is now ${role}` })
          break
        }
        case "changeRole": {
          const rawRole = action.newRole || selectedRoles[action.user.uid]
          if (!rawRole) return
          // Normalize role to lowercase to prevent role detection bugs
          const role = rawRole.toLowerCase().trim()
          await updateDoc(ref, { role, updatedAt: new Date().toISOString() })
          await logActivity({ type: "role_changed", message: `Owner changed ${displayName} role to ${role}`, performedBy: currentUser.uid, role: "owner" })
          toast({ title: "Role Updated", description: `${displayName} is now ${role}` })
          break
        }
        case "deactivate": {
          await updateDoc(ref, { status: "inactive", updatedAt: new Date().toISOString() })
          await logActivity({ type: "user_deactivated", message: `Owner deactivated ${displayName}`, performedBy: currentUser.uid, role: "owner" })
          toast({ title: "User Deactivated", description: `${displayName} has been deactivated` })
          break
        }
        case "reactivate": {
          await updateDoc(ref, { status: "active", updatedAt: new Date().toISOString() })
          await logActivity({ type: "user_reactivated", message: `Owner reactivated ${displayName}`, performedBy: currentUser.uid, role: "owner" })
          toast({ title: "User Reactivated", description: `${displayName} is now active` })
          break
        }
        case "remove": {
          await deleteDoc(ref)
          await logActivity({ type: "user_removed", message: `Owner removed ${displayName}`, performedBy: currentUser.uid, role: "owner" })
          toast({ title: "User Removed", description: `${displayName} has been removed`, variant: "destructive" })
          break
        }
        case "resetPassword": {
          toast({ title: "Password Reset", description: `Password reset link sent to ${action.user.email}` })
          break
        }
      }
    } catch (err) {
      console.error("[UserMgmt] Action error:", err)
      toast({ title: "Error", description: "Something went wrong. Try again.", variant: "destructive" })
    } finally {
      setActionLoading(null)
      setConfirmAction(null)
    }
  }

  function requestAction(type: ActionType, user: UserDoc, newRole?: string) {
    // Block role changes on customer accounts at the UI level
    const normalizedRole = user.role?.toLowerCase().trim()
    if (normalizedRole === "customer" && (type === "approve" || type === "changeRole")) {
      toast({ title: "Blocked", description: "Customer accounts cannot be reassigned.", variant: "destructive" })
      return
    }
    if (type === "approve" || type === "resetPassword") {
      executeAction({ type, user, newRole })
    } else {
      setConfirmAction({ type, user, newRole })
    }
  }

  // ─── KPI Cards ──────────────────────────────────────────────────────────
  const kpiCards = [
    { label: "Total Users", value: stats.total, icon: Users, gradient: "from-sky-500 to-blue-600", bg: "bg-sky-50 dark:bg-sky-950/30" },
    { label: "Pending Approvals", value: stats.pending, icon: Clock, gradient: "from-amber-500 to-orange-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
    { label: "Sales Users", value: stats.sales, icon: ShieldCheck, gradient: "from-blue-500 to-indigo-600", bg: "bg-blue-50 dark:bg-blue-950/30" },
    { label: "Encoder Users", value: stats.encoder, icon: KeyRound, gradient: "from-purple-500 to-violet-600", bg: "bg-purple-50 dark:bg-purple-950/30" },
  ]

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 select-none">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg">
              <UserCog className="h-6 w-6" />
            </div>
            User Management
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage user accounts, roles, and approvals</p>
        </div>
        <Badge variant="outline" className="text-xs px-3 py-1.5 border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 w-fit">
          <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" style={{ animationDuration: "3s" }} />
          Live Sync
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-5">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))
        ) : (
          kpiCards.map((card, i) => (
            <div
              key={card.label}
              className={`kpi-card-enter relative overflow-hidden rounded-xl border bg-card p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 group select-none cursor-pointer ${card.bg}`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</span>
                <div className={`p-2 rounded-lg bg-gradient-to-br ${card.gradient} text-white shadow-md group-hover:scale-110 transition-transform`}>
                  <card.icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground">{card.value}</p>
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${card.gradient} opacity-60`} />
            </div>
          ))
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-card"
          />
        </div>
        <div className="flex gap-2 select-none">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[140px] h-10 bg-card">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="sales">Sales</SelectItem>
              <SelectItem value="encoder">Encoder</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-10 bg-card">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 select-none">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden xl:table-cell">Registered</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-4"><Skeleton className="h-5 w-32" /></td>
                    <td className="px-4 py-4 hidden md:table-cell"><Skeleton className="h-5 w-40" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-5 w-20" /></td>
                    <td className="px-4 py-4 hidden lg:table-cell"><Skeleton className="h-5 w-16" /></td>
                    <td className="px-4 py-4 hidden xl:table-cell"><Skeleton className="h-5 w-24" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-8 w-24 ml-auto" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground font-medium">No users found</p>
                    <p className="text-muted-foreground/60 text-xs mt-1">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => {
                  const normalizedRole = u.role?.toLowerCase().trim()
                  const isPending = normalizedRole === "pending"
                  const isCustomer = normalizedRole === "customer"
                  const isInactive = u.status === "inactive"
                  const userStatus = isPending ? "pending" : (u.status || "active")
                  const isActioning = actionLoading === u.uid

                  return (
                    <tr key={u.uid} className={`transition-colors hover:bg-muted/30 select-none cursor-default ${isActioning ? "opacity-60 pointer-events-none" : ""}`}>
                      {/* Name */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-md bg-gradient-to-br ${isPending ? "from-amber-400 to-orange-500" : isCustomer ? "from-teal-400 to-emerald-500" : "from-sky-400 to-blue-500"}`}>
                            {getUserDisplayName(u).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{getUserDisplayName(u)}</p>
                            <p className="text-xs text-muted-foreground md:hidden">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      {/* Email */}
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <span className="text-muted-foreground">{u.email}</span>
                      </td>
                      {/* Role */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border select-none cursor-default ${ROLE_COLORS[u.role] || ROLE_COLORS.staff}`}>
                          {isPending && <Clock className="h-3 w-3" />}
                          {u.role}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium select-none cursor-default ${STATUS_COLORS[userStatus]}`}>
                          {userStatus === "active" && <CheckCircle2 className="h-3 w-3" />}
                          {userStatus === "inactive" && <XCircle className="h-3 w-3" />}
                          {userStatus === "pending" && <Clock className="h-3 w-3" />}
                          {userStatus}
                        </span>
                      </td>
                      {/* Registered */}
                      <td className="px-4 py-3.5 text-muted-foreground text-xs hidden xl:table-cell">
                        {formatDate(u.createdAt)}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {isCustomer ? (
                            /* ── Customer accounts are view-only ── */
                            <Badge variant="outline" className="text-xs px-3 py-1 border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 cursor-default select-none">
                              Customer Account
                            </Badge>
                          ) : isPending ? (
                            <>
                              <Select
                                value={selectedRoles[u.uid] || undefined}
                                onValueChange={(v) => setSelectedRoles((prev) => ({ ...prev, [u.uid]: v }))}
                              >
                                <SelectTrigger className="w-[130px] h-8 text-xs bg-card">
                                  <SelectValue placeholder="Role Selection" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sales">Sales</SelectItem>
                                  <SelectItem value="encoder">Encoder</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                className="h-8 text-xs bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-sm"
                                onClick={() => requestAction("approve", u, selectedRoles[u.uid])}
                                disabled={isActioning || !selectedRoles[u.uid]}
                              >
                                <UserCheck className="h-3.5 w-3.5 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                onClick={() => requestAction("remove", u)}
                                disabled={isActioning}
                                title="Remove"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Select
                                value={u.role}
                                onValueChange={(v) => requestAction("changeRole", u, v)}
                              >
                                <SelectTrigger className="w-[120px] h-8 text-xs bg-card">
                                  <SelectValue placeholder="Role Selection" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sales">Sales</SelectItem>
                                  <SelectItem value="encoder">Encoder</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                onClick={() => requestAction("remove", u)}
                                title="Remove user"
                                disabled={isActioning}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3 select-none">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Rows per page:</span>
              <Select value={String(rowsPerPage)} onValueChange={(v) => { setRowsPerPage(Number(v)); setCurrentPage(1) }}>
                <SelectTrigger className="w-[70px] h-7 text-xs bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <span>Showing {startIndex}–{endIndex} of {filtered.length} users</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Prev
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                Page {safePage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Confirm Action
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.type === "changeRole" && `Change ${getUserDisplayName(confirmAction.user)}'s role to "${confirmAction.newRole}"?`}
              {confirmAction?.type === "deactivate" && `Deactivate ${getUserDisplayName(confirmAction.user)}'s account? They will not be able to log in.`}
              {confirmAction?.type === "reactivate" && `Reactivate ${getUserDisplayName(confirmAction.user)}'s account?`}
              {confirmAction?.type === "remove" && `Permanently remove ${getUserDisplayName(confirmAction.user)}? This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant={confirmAction?.type === "remove" ? "destructive" : "default"}
              onClick={() => confirmAction && executeAction(confirmAction)}
              disabled={!!actionLoading}
            >
              {actionLoading ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
