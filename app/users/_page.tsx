"use client"

import { useState, useEffect } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Trash2, Pencil } from "lucide-react"
import { TotalUsersIcon, AdminsIcon, StaffMembersIcon, DeliveryStaffIcon } from "@/components/users/user-icons"
import { EditUserDialog } from "@/components/users/edit-user-dialog"
import { DeleteUserDialog } from "@/components/users/delete-user-dialog"
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase-live"
import { toast } from "sonner"

interface User {
  id: string
  uid?: string
  email: string
  fullName?: string
  name?: string
  role: string
  status?: string
  profilePhotoUrl?: string
  googleDrivePhotoUrl?: string
  licenseNumber?: string
  truckPlateNumber?: string
  createdAt?: any
  updatedAt?: any
}

// Helper to convert Google Drive view URL to embeddable image URL
function getDisplayablePhotoUrl(user: User): string | undefined {
  const url = user.googleDrivePhotoUrl || user.profilePhotoUrl
  if (!url) return undefined

  // If it's already the direct format, return as-is
  if (url.includes('lh3.googleusercontent.com')) {
    return url
  }

  // If it's a Google Drive URL, convert to direct image URL
  // Example: https://drive.google.com/file/d/FILE_ID/view -> https://lh3.googleusercontent.com/d/FILE_ID
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/)
  if (driveMatch) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`
  }

  // Also handle uc?export=view format
  const ucMatch = url.match(/drive\.google\.com\/uc\?.*id=([^&]+)/)
  if (ucMatch) {
    return `https://lh3.googleusercontent.com/d/${ucMatch[1]}`
  }

  return url
}

type FilterRole = "all" | "admin" | "staff" | "delivery"

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [filterRole, setFilterRole] = useState<FilterRole>("all")
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const db = getFirebaseDb()
      const usersCollection = collection(db, "users")
      const usersSnapshot = await getDocs(usersCollection)
      const usersData = usersSnapshot.docs.map((d) => {
        const data = d.data()
        return {
          ...data,  // spread document data first
          id: d.id, // then set document ID last (ensures it's not overwritten)
        }
      }) as User[]

      console.log("[Users] Fetched users from Firebase:", usersData.length)
      // Log each user's ID and email for debugging
      usersData.forEach(u => console.log(`[Users] User: ${u.email} -> ID: ${u.id}`))
      setUsers(usersData)
    } catch (error) {
      console.error("[Users] Error fetching users:", error)
      toast.error("Failed to fetch users. Please check your Firebase connection.")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = (user: User) => {
    setDeletingUser(user)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deletingUser) return

    try {
      const db = getFirebaseDb()
      await deleteDoc(doc(db, "users", deletingUser.id))
      console.log("[Users] User deleted successfully:", deletingUser.id)

      // Update local state immediately
      setUsers((prevUsers) => prevUsers.filter((u) => u.id !== deletingUser.id))

      // Show success toast
      toast.success("User deleted successfully", {
        description: `${deletingUser.fullName || deletingUser.name || deletingUser.email} has been removed.`,
      })

      // Close dialog
      setDeleteDialogOpen(false)
      setDeletingUser(null)
    } catch (error: any) {
      console.error("[Users] Error deleting user:", error)
      toast.error("Failed to delete user", {
        description: error?.message || "Something went wrong. Please try again.",
      })
    }
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setEditDialogOpen(true)
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role?.toLowerCase()) {
      case "admin":
        return "destructive"
      case "manager":
        return "default"
      case "staff":
        return "secondary"
      default:
        return "outline"
    }
  }

  const isDeliveryStaffRole = (role: string) => {
    const r = role?.toLowerCase()
    return r === "delivery" || r === "driver" || r === "delivery staff"
  }

  const filteredUsers = users.filter((user) => {
    if (filterRole === "all") return true
    const userRole = user.role?.toLowerCase()
    if (filterRole === "admin") return userRole === "admin"
    if (filterRole === "staff") return userRole === "staff"
    if (filterRole === "delivery") return isDeliveryStaffRole(user.role)
    return true
  })

  const adminCount = users.filter((user) => user.role?.toLowerCase() === "admin").length
  const staffCount = users.filter((user) => user.role?.toLowerCase() === "staff").length
  const deliveryStaffCount = users.filter((user) => isDeliveryStaffRole(user.role)).length

  const isDeliveryTab = filterRole === "delivery"

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <MainLayout>
        <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Manage all users in the system</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="transition-all duration-300 hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <TotalUsersIcon />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
            </CardContent>
          </Card>

          <Card className="transition-all duration-300 hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admins</CardTitle>
              <AdminsIcon />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminCount}</div>
            </CardContent>
          </Card>

          <Card className="transition-all duration-300 hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Staff Members</CardTitle>
              <StaffMembersIcon />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{staffCount}</div>
            </CardContent>
          </Card>

          <Card className="transition-all duration-300 hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delivery Staff</CardTitle>
              <DeliveryStaffIcon />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{deliveryStaffCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Users</CardTitle>
                <CardDescription>
                  {filterRole === "all"
                    ? "Complete list of all users in Firebase"
                    : `Showing ${filterRole === "delivery" ? "delivery staff" : filterRole} users (${filteredUsers.length})`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Filter Tabs */}
            <Tabs value={filterRole} onValueChange={(value) => setFilterRole(value as FilterRole)}>
              <TabsList className="grid w-full grid-cols-4 h-12 p-1.5 gap-2">
                <TabsTrigger value="all" className="text-sm font-medium">All Users</TabsTrigger>
                <TabsTrigger value="admin" className="text-sm font-medium">Admin</TabsTrigger>
                <TabsTrigger value="staff" className="text-sm font-medium">Staff Member</TabsTrigger>
                <TabsTrigger value="delivery" className="text-sm font-medium">Delivery Staff</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Table */}
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">
                  No {filterRole === "all" ? "" : filterRole === "delivery" ? "delivery staff" : filterRole} users found
                </p>
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/60 hover:bg-muted/60 border-b-2">
                        {isDeliveryTab && (
                          <TableHead className="w-20 h-14 px-6 text-xs font-bold uppercase tracking-wider text-center align-middle">
                            Photo
                          </TableHead>
                        )}
                        <TableHead className="h-14 px-6 text-xs font-bold uppercase tracking-wider align-middle" style={{ minWidth: '220px' }}>
                          Email
                        </TableHead>
                        <TableHead className="h-14 px-6 text-xs font-bold uppercase tracking-wider align-middle" style={{ minWidth: '160px' }}>
                          Full Name
                        </TableHead>
                        <TableHead className="w-28 h-14 px-6 text-xs font-bold uppercase tracking-wider text-center align-middle">
                          Role
                        </TableHead>
                        {isDeliveryTab && (
                          <TableHead className="h-14 px-6 text-xs font-bold uppercase tracking-wider align-middle" style={{ minWidth: '160px' }}>
                            License #
                          </TableHead>
                        )}
                        {isDeliveryTab && (
                          <TableHead className="h-14 px-6 text-xs font-bold uppercase tracking-wider align-middle" style={{ minWidth: '140px' }}>
                            Plate #
                          </TableHead>
                        )}
                        <TableHead className="w-24 h-14 px-6 text-xs font-bold uppercase tracking-wider text-center align-middle">
                          Status
                        </TableHead>
                        <TableHead className="w-28 h-14 px-6 text-xs font-bold uppercase tracking-wider text-center align-middle">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user, index) => {
                        const displayName = user.fullName || user.name || user.email
                        const initials = displayName.substring(0, 2).toUpperCase()
                        const canEdit = isDeliveryStaffRole(user.role)
                        const isLastRow = index === filteredUsers.length - 1

                        return (
                          <TableRow
                            key={user.id}
                            className={`
                              transition-all duration-200 ease-in-out
                              hover:bg-primary/5
                              ${!isLastRow ? 'border-b' : ''}
                            `}
                          >
                            {isDeliveryTab && (
                              <TableCell className="h-20 px-6 align-middle">
                                <div className="flex justify-center">
                                  <Avatar className="h-12 w-12 border-2 border-background shadow-md ring-2 ring-primary/10">
                                    <AvatarImage src={getDisplayablePhotoUrl(user)} alt={displayName} />
                                    <AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-primary/20 to-primary/10">
                                      {initials}
                                    </AvatarFallback>
                                  </Avatar>
                                </div>
                              </TableCell>
                            )}

                            <TableCell className={`${isDeliveryTab ? 'h-20' : 'h-16'} px-6 align-middle`}>
                              <span className="font-medium text-sm">
                                {user.email || "N/A"}
                              </span>
                            </TableCell>

                            <TableCell className={`${isDeliveryTab ? 'h-20' : 'h-16'} px-6 align-middle`}>
                              <span className="text-sm text-muted-foreground">
                                {user.fullName || user.name || "Not Set"}
                              </span>
                            </TableCell>

                            <TableCell className={`${isDeliveryTab ? 'h-20' : 'h-16'} px-6 align-middle`}>
                              <div className="flex justify-center">
                                <Badge
                                  variant={getRoleBadgeVariant(user.role)}
                                  className="text-xs font-semibold px-3 py-1"
                                >
                                  {user.role || "User"}
                                </Badge>
                              </div>
                            </TableCell>

                            {isDeliveryTab && (
                              <TableCell className="h-20 px-6 align-middle">
                                <span className="text-sm font-mono tracking-wide">
                                  {user.licenseNumber || (
                                    <span className="text-muted-foreground/60 italic">Not set</span>
                                  )}
                                </span>
                              </TableCell>
                            )}

                            {isDeliveryTab && (
                              <TableCell className="h-20 px-6 align-middle">
                                <span className="text-sm font-mono tracking-wide">
                                  {user.truckPlateNumber || (
                                    <span className="text-muted-foreground/60 italic">Not set</span>
                                  )}
                                </span>
                              </TableCell>
                            )}

                            <TableCell className={`${isDeliveryTab ? 'h-20' : 'h-16'} px-6 align-middle`}>
                              <div className="flex justify-center">
                                <Badge
                                  variant={user.status === "active" ? "default" : "secondary"}
                                  className="text-xs font-semibold px-3 py-1"
                                >
                                  {user.status || "active"}
                                </Badge>
                              </div>
                            </TableCell>

                            <TableCell className={`${isDeliveryTab ? 'h-20' : 'h-16'} px-6 align-middle`}>
                              <div className="flex items-center justify-center gap-2">
                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditUser(user)}
                                    className="h-9 w-9 p-0 text-primary hover:text-primary hover:bg-primary/15 rounded-lg transition-all"
                                    title="Edit user"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteClick(user)}
                                  className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/15 rounded-lg transition-all"
                                  title="Delete user"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit User Dialog */}
        <EditUserDialog
          user={editingUser}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onUserUpdated={fetchUsers}
        />

        {/* Delete User Dialog */}
        <DeleteUserDialog
          user={deletingUser}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirmDelete={handleConfirmDelete}
        />
      </div>
      </MainLayout>
    </ProtectedRoute>
  )
}
