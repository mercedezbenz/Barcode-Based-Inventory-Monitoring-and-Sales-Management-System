"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clock, Truck, CheckCircle, Package, AlertCircle } from "lucide-react"
import { TotalDeliveriesIcon, PendingDeliveriesIcon, OnDeliveryIcon, CompletedDeliveriesIcon } from "./delivery-icons"
import { TransactionsTable } from "./transactions-table"
import { CreateDeliveryDialog } from "./create-delivery-dialog"
import { AssignDriverDialogTransaction } from "./assign-driver-dialog-transaction"
import { DocumentService, InventoryService, DeliveryLogService } from "@/services/firebase-service"
import type { Document, CustomerTransaction, InventoryItem, DeliveryLog } from "@/lib/types"
import { useAuth } from "@/hooks/use-auth"
import { getFirebaseDb } from "@/lib/firebase-live"
import { collection, query, where, onSnapshot, DocumentData, Query } from "firebase/firestore"
import { calculateWeeklyCountChange, formatWeeklyChange, parseFirestoreDate } from "@/lib/weekly-change-utils"
import { formatDeliveryTime } from "@/lib/utils"
import { DeliveryDashboardSkeleton } from "@/components/skeletons/dashboard-skeleton"

export function DeliveryDashboard() {
  const { user, firebaseUser } = useAuth()
  const currentEmail = firebaseUser?.email ?? null

  const rawRole = user?.role ?? ""
  const normalizedRole = rawRole.toString().toLowerCase()

  const currentUserRole = normalizedRole
  const isDriver = normalizedRole === "delivery"
  const isAdmin = normalizedRole === "admin"
  const isStaff = normalizedRole === "staff"

  const [documents, setDocuments] = useState<Document[]>([])

  // Three separate states for customer_transactions based on transactionType
  const [pending, setPending] = useState<CustomerTransaction[]>([])
  const [onDelivery, setOnDelivery] = useState<CustomerTransaction[]>([])
  const [completed, setCompleted] = useState<CustomerTransaction[]>([])
  const [activeDeliveryLogs, setActiveDeliveryLogs] = useState<(DeliveryLog & { scannedTimestamp: Date | null })[]>([])

  // Driver assignment modal state
  const [assigningTransaction, setAssigningTransaction] = useState<CustomerTransaction | null>(null)
  const [showAssignDriverDialog, setShowAssignDriverDialog] = useState(false)

  const [activeTab, setActiveTab] = useState<"pending" | "delivery" | "completed">("pending")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [loading, setLoading] = useState(true)

  const parseLogTimestamp = (value: any): number | null => {
    if (!value) return null
    if (typeof value === "number") return value
    if (typeof value === "string") {
      const parsed = Date.parse(value)
      return isNaN(parsed) ? null : parsed
    }
    if (value instanceof Date) return value.getTime()
    if (value && typeof value.toDate === "function") return value.toDate().getTime()
    if (value && typeof value.seconds === "number") return value.seconds * 1000
    if (value && typeof value._seconds === "number") return value._seconds * 1000
    return null
  }

  const toDate = (value: any): Date | null => {
    if (value instanceof Date) return value
    const timestamp = parseLogTimestamp(value)
    return timestamp !== null ? new Date(timestamp) : null
  }
  useEffect(() => {
    // Subscribe to all delivery logs - we'll filter by status in the mapping
    // Note: Firestore may have "DELIVERED" status, but TypeScript type uses "COMPLETED"
    const unsubscribeLogs = DeliveryLogService.subscribeToDeliveryLogs(
      (logs) => {
        const normalized: (DeliveryLog & { scannedTimestamp: Date | null })[] = (logs || []).map((log: any) => {
          const timestampMs = parseLogTimestamp(log.timestamp)
          // Handle both "DELIVERED" (from Firestore) and "COMPLETED" (from type)
          let normalizedStatus = log.status || "PICKED_UP"
          if (normalizedStatus === "DELIVERED") {
            normalizedStatus = "COMPLETED"
          }
          return {
            ...log,
            status: normalizedStatus as DeliveryLog["status"],
            timestamp: timestampMs ?? Date.now(),
            scannedTimestamp: timestampMs ? new Date(timestampMs) : null,
          }
        })
        setActiveDeliveryLogs(normalized)
      },
      (error) => {
        console.error("[Delivery Dashboard] Error loading delivery logs:", error)
      },
      // Don't filter by status here - we need all logs to match properly
      undefined,
    )

    return () => {
      if (typeof unsubscribeLogs === "function") {
        unsubscribeLogs()
      }
    }
  }, [])

  // Load customer_transactions with query-level filter
  useEffect(() => {
    if (!currentEmail || !currentUserRole) return


    const db = getFirebaseDb()
    const base = collection(db, "customer_transactions")

    // Helper function to map Firestore documents to CustomerTransaction
    const mapTransaction = (d: any): CustomerTransaction => {
      const data = d.data() as any
      delete data.id // ignore any id field inside document

      // Debug: warn if barcode is missing (scanning will fail)
      if (!data.productBarcode) {
        console.warn(`[Delivery] ⚠️ Transaction ${d.id} ("${data.productName}") has NO productBarcode — scanning will not work!`, {
          docId: d.id,
          productId: data.productId,
          productBarcode: data.productBarcode,
          productName: data.productName,
        })
      }

      // Debug: warn if productId equals productBarcode (unexpected, they should differ)
      if (data.productId && data.productBarcode && data.productId === data.productBarcode) {
        console.log(`[Delivery] ℹ️ Transaction ${d.id}: productId === productBarcode (both: ${data.productId})`)
      }

      return {
        ...data,
        id: d.id, // doc id overrides everything
      }
    }

    // Helper function to process snapshot and update state
    const processSnapshot = (snap: any, transactionType: string) => {
      const txs: CustomerTransaction[] = snap.docs.map(mapTransaction)

      console.log("DELIVERIES SNAPSHOT DEBUG", {
        total: txs.length,
        sample: txs.slice(0, 3),
      })

      // Update appropriate state based on transactionType
      // Note: queries already filter by transactionType, so we don't need to filter again
      if (transactionType === "PRODUCT_OUT") {
        setPending(txs)
      } else if (transactionType === "IN_PROGRESS") {
        setOnDelivery(txs)
      } else if (transactionType === "DELIVERED") {
        setCompleted(txs)
      }

      setLoading(false)
    }

    // Build queries with role-based filtering
    let qPending: Query<DocumentData>
    let qInProgress: Query<DocumentData>
    let qDelivered: Query<DocumentData>

    if (isDriver) {
      // DRIVER: only documents where assignedDriverId == currentEmail
      qPending = query(
        base,
        where("transactionType", "==", "PRODUCT_OUT"),
        where("assignedDriverId", "==", currentEmail),
      )
      qInProgress = query(
        base,
        where("transactionType", "==", "IN_PROGRESS"),
        where("assignedDriverId", "==", currentEmail),
      )
      qDelivered = query(
        base,
        where("transactionType", "==", "DELIVERED"),
        where("assignedDriverId", "==", currentEmail),
      )
    } else {
      // ADMIN / STAFF / GUEST: see all deliveries
      qPending = query(base, where("transactionType", "==", "PRODUCT_OUT"))
      qInProgress = query(base, where("transactionType", "==", "IN_PROGRESS"))
      qDelivered = query(base, where("transactionType", "==", "DELIVERED"))
    }

    // Subscribe to all three queries
    const unsubPending = onSnapshot(qPending, (snap) => processSnapshot(snap, "PRODUCT_OUT"))
    const unsubInProgress = onSnapshot(qInProgress, (snap) => processSnapshot(snap, "IN_PROGRESS"))
    const unsubDelivered = onSnapshot(qDelivered, (snap) => processSnapshot(snap, "DELIVERED"))

    return () => {
      unsubPending()
      unsubInProgress()
      unsubDelivered()
    }
  }, [currentUserRole, isDriver, normalizedRole, currentEmail])

  // Load inventory items for category lookup
  useEffect(() => {
    const unsubscribeItems = InventoryService.subscribeToItems(
      (items) => {
        setInventoryItems(items)
      },
      (error) => {
        console.error("[Delivery Dashboard] Error loading inventory:", error)
      }
    )

    return () => {
      unsubscribeItems()
    }
  }, [])

  // Subscribe to documents for delivery creation dialog
  useEffect(() => {
    const unsubscribeDocuments = DocumentService.subscribeToDocuments((updatedDocuments) => {
      console.log("[Delivery Dashboard] Received documents from Firebase:", updatedDocuments.length)
      setDocuments(updatedDocuments)
    })

    return () => {
      unsubscribeDocuments()
    }
  }, [])

  // Helper function to get product category from inventory
  const getProductCategory = (tx: CustomerTransaction): string | null => {
    // Try to find the product in inventory by productBarcode (primary) or productId (fallback)
    const inventoryItem = inventoryItems.find(
      (item) => item.barcode === tx.productBarcode || item.barcode === tx.productId || item.id === tx.productId
    )
    return inventoryItem?.category || null
  }

  // Apply email-based filter and category filter at table rendering level
  const filterTransactions = (transactions: CustomerTransaction[]) => {
    let filtered = transactions

    // First apply driver email filter (safety measure)
    if (isDriver && currentEmail) {
      filtered = filtered.filter((tx) => tx.assignedDriverId === currentEmail)
    }

    // Then apply category filter if not "all"
    if (selectedCategory !== "all") {
      filtered = filtered.filter((tx) => {
        const category = getProductCategory(tx)
        if (!category) return false

        // Case-insensitive category matching
        const categoryNormalized = category.toUpperCase().trim()
        const selectedCategoryNormalized = selectedCategory.toUpperCase().trim()

        // Handle categories with " - " separator
        if (category.includes(" - ")) {
          const mainCategory = category.split(" - ")[0].trim().toUpperCase()
          return mainCategory === selectedCategoryNormalized
        }

        return categoryNormalized === selectedCategoryNormalized
      })
    }

    return filtered
  }

  const latestDeliveryLogsByProduct = useMemo(() => {
    const map = new Map<string, (DeliveryLog & { scannedTimestamp: Date | null })>()
    activeDeliveryLogs.forEach((log) => {
      // Debug: log the productId from delivery_logs (this is what the mobile app scanned)
      console.log(`[Delivery Log] productId: "${log.productId}" | status: ${log.status} | timestamp: ${log.timestamp}`)

      const existing = map.get(log.productId)
      // Prioritize COMPLETED/DELIVERED logs, or use the most recent timestamp
      if (!existing) {
        map.set(log.productId, log)
      } else {
        const isCompleted = log.status === "COMPLETED"
        const existingIsCompleted = existing.status === "COMPLETED"
        if (isCompleted && !existingIsCompleted) {
          map.set(log.productId, log)
        } else if (isCompleted === existingIsCompleted && log.timestamp > existing.timestamp) {
          map.set(log.productId, log)
        }
      }
    })
    return map
  }, [activeDeliveryLogs])

  const visiblePending = filterTransactions(pending)
  const filteredOnDelivery = filterTransactions(onDelivery)
  const baseCompleted = filterTransactions(completed)

  const visibleOnDelivery = filteredOnDelivery
    .map((transaction) => {
      // Match by productBarcode (primary — barcode is the scan source of truth)
      // then fall back to productId (legacy Firestore doc ID)
      const log =
        (transaction.productBarcode ? latestDeliveryLogsByProduct.get(transaction.productBarcode) : undefined) ||
        latestDeliveryLogsByProduct.get(transaction.productId)

      if (!log || (log.status !== "PICKED_UP" && log.status !== "ON_DELIVERY")) {
        return null
      }

      return {
        ...transaction,
        deliveryStatus: log.status,
        scannedTimestamp: log.scannedTimestamp ?? null,
      }
    })
    .filter((transaction): transaction is (CustomerTransaction & { deliveryStatus: any; scannedTimestamp: Date | null }) => transaction !== null)
    .sort((a, b) => {
      const aTime = a.scannedTimestamp ? a.scannedTimestamp.getTime() : 0
      const bTime = b.scannedTimestamp ? b.scannedTimestamp.getTime() : 0
      return bTime - aTime
    })

  const visibleCompleted = baseCompleted
    .map((transaction) => {
      // Match delivery_logs by productBarcode (primary — barcode is the scan source of truth)
      // then fall back to productId (legacy Firestore doc ID)
      const log =
        (transaction.productBarcode ? latestDeliveryLogsByProduct.get(transaction.productBarcode) : undefined) ||
        latestDeliveryLogsByProduct.get(transaction.productId)

      // Check if log has COMPLETED status (normalized from DELIVERED)
      const isDeliveredLog = log && log.status === "COMPLETED"

      let deliveryStatus: DeliveryLog["status"] = "COMPLETED"
      let completedTime: string | undefined = undefined
      let scannedTimestamp: Date | null = null

      // Priority 1: Use delivery_logs with COMPLETED status (from DELIVERED in Firestore)
      if (isDeliveredLog && log.timestamp) {
        deliveryStatus = "COMPLETED"
        scannedTimestamp = log.scannedTimestamp ?? (log.timestamp ? new Date(log.timestamp) : null)
        if (log.timestamp) {
          completedTime = formatDeliveryTime(log.timestamp)
        }
      }
      // Priority 2: Check if transaction document has timestamp field
      else if ((transaction as any).timestamp) {
        const timestampValue = (transaction as any).timestamp
        const timestampMs = parseLogTimestamp(timestampValue)
        if (timestampMs !== null) {
          scannedTimestamp = new Date(timestampMs)
          completedTime = formatDeliveryTime(timestampMs)
          deliveryStatus = "COMPLETED"
        }
      }
      // Priority 3: Fallback to deliveredAt
      else if (transaction.deliveredAt) {
        const deliveredDate = toDate(transaction.deliveredAt)
        if (deliveredDate) {
          scannedTimestamp = deliveredDate
          completedTime = formatDeliveryTime(deliveredDate.getTime())
          deliveryStatus = "COMPLETED"
        }
      }

      // If no timestamp found, completedTime remains undefined (will show "No timestamp" in UI)

      return {
        ...transaction,
        deliveryStatus,
        scannedTimestamp,
        completedTime,
      }
    })
    .sort((a, b) => {
      const aTime = a.scannedTimestamp ? a.scannedTimestamp.getTime() : 0
      const bTime = b.scannedTimestamp ? b.scannedTimestamp.getTime() : 0
      return bTime - aTime
    })

  // Calculate stats from filtered customer_transactions
  const totalDeliveries = visiblePending.length + visibleOnDelivery.length + visibleCompleted.length
  const pendingCount = visiblePending.length
  const inProgressCount = visibleOnDelivery.length
  const deliveredCount = visibleCompleted.length

  // Get all transactions for weekly change calculations
  const allTransactions = useMemo(() => {
    return [...pending, ...onDelivery, ...completed]
  }, [pending, onDelivery, completed])

  // Calculate weekly changes
  const totalDeliveriesWeeklyChange = useMemo(() => {
    return calculateWeeklyCountChange({
      items: allTransactions,
      getDate: (tx) => parseFirestoreDate(tx.transactionDate || (tx as any).createdAt),
    })
  }, [allTransactions])

  const pendingWeeklyChange = useMemo(() => {
    return calculateWeeklyCountChange({
      items: allTransactions,
      getDate: (tx) => parseFirestoreDate(tx.transactionDate || (tx as any).createdAt),
      filter: (tx) => tx.transactionType === "PRODUCT_OUT",
    })
  }, [allTransactions])

  const inProgressWeeklyChange = useMemo(() => {
    return calculateWeeklyCountChange({
      items: allTransactions,
      getDate: (tx) => parseFirestoreDate(tx.transactionDate || (tx as any).createdAt),
      filter: (tx) => tx.transactionType === "IN_PROGRESS",
    })
  }, [allTransactions])

  const completedWeeklyChange = useMemo(() => {
    return calculateWeeklyCountChange({
      items: allTransactions,
      getDate: (tx) => parseFirestoreDate(tx.transactionDate || (tx as any).createdAt || (tx as any).deliveredAt),
      filter: (tx) => tx.transactionType === "DELIVERED",
    })
  }, [allTransactions])

  // Handler for driver assignment
  const handleAssignDriver = (transaction: CustomerTransaction) => {
    setAssigningTransaction(transaction)
    setShowAssignDriverDialog(true)
  }

  // Admin / Staff check
  const canManage = isAdmin || isStaff

  // Safe guard: wait for auth data before rendering (unless guest)
  if (!loading && (!currentEmail || !currentUserRole)) {
    // If we've timed out or reached a state where user exists but role/email are missing, show an error instead of hanging
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-white text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">User Profile Error</h1>
        <p className="text-muted-foreground mb-4">We found your account but couldn&apos;t load your permissions. Please try logging in again.</p>
        <Button onClick={() => window.location.href = "/login"} variant="outline">
          Back to Login
        </Button>
      </div>
    )
  }


  if (loading) {
    return <DeliveryDashboardSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-balance">Delivery Tracking</h1>
          <p className="text-muted-foreground">Track and manage delivery assignments and status</p>
        </div>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
            <TotalDeliveriesIcon />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDeliveries}</div>
            <p className="text-xs text-muted-foreground">
              {formatWeeklyChange(totalDeliveriesWeeklyChange)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <PendingDeliveriesIcon />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">
              {formatWeeklyChange(pendingWeeklyChange)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Delivery</CardTitle>
            <OnDeliveryIcon />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inProgressCount}</div>
            <p className="text-xs text-muted-foreground">
              {formatWeeklyChange(inProgressWeeklyChange)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CompletedDeliveriesIcon />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{deliveredCount}</div>
            <p className="text-xs text-muted-foreground">
              {formatWeeklyChange(completedWeeklyChange)}
            </p>
          </CardContent>
        </Card>
      </div>


      {/* Tabs for Pending, Delivery, Completed */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Deliveries</CardTitle>
              <CardDescription>
                Manage and track delivery orders by status
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="CHICKEN">Chicken</SelectItem>
                  <SelectItem value="BEEF">Beef</SelectItem>
                  <SelectItem value="PORK">Pork</SelectItem>
                  <SelectItem value="GROUND BEEF">Ground Beef</SelectItem>
                  <SelectItem value="CHICKEN PRODUCTS">Chicken Products</SelectItem>
                  <SelectItem value="PORK PRODUCTS">Pork Products</SelectItem>
                  <SelectItem value="RETAIL PRODUCTS">Retail Products</SelectItem>
                  <SelectItem value="SAWDUST">Sawdust</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "pending" | "delivery" | "completed")} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending" className="gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                Pending ({pendingCount})
              </TabsTrigger>
              <TabsTrigger value="delivery" className="gap-2">
                <Truck className="h-4 w-4 text-blue-500" />
                Delivery ({inProgressCount})
              </TabsTrigger>
              <TabsTrigger value="completed" className="gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Completed ({deliveredCount})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4">
              <TransactionsTable
                transactions={visiblePending}
                emptyMessage="No pending transactions found"
                onAssignDriver={handleAssignDriver}
              />
            </TabsContent>

            <TabsContent value="delivery" className="mt-4">
              <TransactionsTable
                transactions={visibleOnDelivery as CustomerTransaction[]}
                emptyMessage="No in-progress transactions found"
                onAssignDriver={handleAssignDriver}
                logColumnLabel="Pickup Time"
                showStatusBadge
              />
            </TabsContent>

            <TabsContent value="completed" className="mt-4">
              <TransactionsTable
                transactions={visibleCompleted as CustomerTransaction[]}
                emptyMessage="No delivered transactions found"
                onAssignDriver={handleAssignDriver}
                logColumnLabel="Completed Time"
                showStatusBadge
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <CreateDeliveryDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} documents={documents} />

      {/* Driver Assignment Dialog */}
      <AssignDriverDialogTransaction
        transaction={assigningTransaction}
        open={showAssignDriverDialog}
        onOpenChange={setShowAssignDriverDialog}
        onSuccess={() => {
          // Dialog will close automatically, data will update via onSnapshot
          setAssigningTransaction(null)
        }}
      />
    </div>
  )
}
