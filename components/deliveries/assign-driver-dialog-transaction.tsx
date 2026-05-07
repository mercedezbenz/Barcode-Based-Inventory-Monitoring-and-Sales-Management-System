"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { CustomerTransactionService, UserService } from "@/services/firebase-service"
import type { DriverUser, CustomerTransaction } from "@/lib/types"
import { Loader2 } from "lucide-react"

interface AssignDriverDialogTransactionProps {
  transaction: CustomerTransaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function AssignDriverDialogTransaction({
  transaction,
  open,
  onOpenChange,
  onSuccess,
}: AssignDriverDialogTransactionProps) {
  const [drivers, setDrivers] = useState<DriverUser[]>([])
  const [selectedDriverId, setSelectedDriverId] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [loadingDrivers, setLoadingDrivers] = useState(true)

  useEffect(() => {
    if (open && transaction) {
      // When dialog opens, we need to find the driver by email (assignedDriverId is now email)
      // But we'll set it after drivers are loaded
      loadDrivers()
    }
  }, [open, transaction])

  // Set selected driver after drivers are loaded (match by email since assignedDriverId is email)
  useEffect(() => {
    if (transaction?.assignedDriverId && drivers.length > 0) {
      const matchingDriver = drivers.find((d) => d.email === transaction.assignedDriverId)
      if (matchingDriver) {
        setSelectedDriverId(matchingDriver.id)
      } else {
        setSelectedDriverId("")
      }
    } else if (!transaction?.assignedDriverId) {
      setSelectedDriverId("")
    }
  }, [transaction?.assignedDriverId, drivers])

  const loadDrivers = async () => {
    try {
      setLoadingDrivers(true)
      console.log("[AssignDriverDialog] Loading drivers from Firestore...")
      
      const driverList = await UserService.getDrivers()
      console.log("[AssignDriverDialog] Raw drivers from Firestore:", driverList)
      
      // Normalize driver data
      const normalizedDrivers = driverList.map((driver: any) => ({
        id: driver.id || driver.uid,
        fullName: driver.fullName || driver.name || driver.displayName || driver.email || "Unknown",
        email: driver.email || "",
        role: driver.role || "DELIVERY",
        displayName: driver.displayName || driver.name || driver.fullName, // optional alias
        name: driver.name || driver.fullName, // optional alias
      })).filter((d) => d.email) // Only include drivers with email
      
      setDrivers(normalizedDrivers)
      console.log("[AssignDriverDialog] ✅ Loaded and normalized drivers:", normalizedDrivers.length)
      console.log("[AssignDriverDialog] Driver details:", normalizedDrivers)
    } catch (error: any) {
      console.error("[AssignDriverDialog] ❌ Error loading drivers:", error)
      console.error("[AssignDriverDialog] Error details:", {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
      })
    } finally {
      setLoadingDrivers(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transaction || !selectedDriverId) {
      console.warn("[AssignDriverDialog] Missing transaction or driver ID", {
        transaction: transaction?.id,
        selectedDriverId,
      })
      return
    }

    setLoading(true)
    try {
      const selectedDriver = drivers.find((d) => d.id === selectedDriverId)
      if (!selectedDriver) {
        throw new Error(`Selected driver with ID "${selectedDriverId}" not found in drivers list`)
      }

      // Verify transaction has a valid ID (Firestore document ID)
      if (!transaction.id || transaction.id.trim() === "") {
        console.error("[AssignDriverDialog] Transaction missing ID", transaction)
        alert("Cannot assign driver: transaction ID is missing.")
        return
      }

      // Verify driver has email (required for assignedDriverId)
      if (!selectedDriver.email || selectedDriver.email.trim() === "") {
        alert("Cannot assign driver: driver email is missing.")
        return
      }

      console.log("[AssignDriverDialog] Attempting to assign driver:", {
        transactionId: transaction.id,
        driverId: selectedDriver.id,
        driverEmail: selectedDriver.email,
        driverName: selectedDriver.fullName,
        updateData: {
          assignedDriverId: selectedDriver.email, // Store EMAIL, not ID
          assignedDriverName: selectedDriver.fullName,
        },
      })

      // Update the customer_transactions document
      // Using transaction.id as the Firestore document ID (from d.id, never empty)
      // assignedDriverId MUST be driver.email (not driver.id)
      await CustomerTransactionService.updateTransaction(transaction.id, {
        assignedDriverId: selectedDriver.email, // Store EMAIL
        assignedDriverName: selectedDriver.fullName ?? selectedDriver.email,
      })

      console.log("[AssignDriverDialog] ✅ Driver assigned successfully to transaction:", transaction.id)
      onOpenChange(false)
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error("[AssignDriverDialog] ❌ Error assigning driver:", error)
      console.error("[AssignDriverDialog] Error details:", {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
        transactionId: transaction?.id,
        selectedDriverId,
        driversCount: drivers.length,
      })
      
      // More detailed error message
      const errorMessage =
        error?.message || error?.code || "Unknown error occurred"
      alert(
        `Failed to assign driver. ${errorMessage}\n\nCheck the browser console (F12) for more details.`
      )
    } finally {
      setLoading(false)
    }
  }

  const handleUnassign = async () => {
    if (!transaction) return

    setLoading(true)
    try {
      await CustomerTransactionService.updateTransaction(transaction.id, {
        assignedDriverId: null,
        assignedDriverName: null,
      })

      console.log("[AssignDriverDialog] Driver unassigned successfully")
      onOpenChange(false)
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error("[AssignDriverDialog] Error unassigning driver:", error)
      alert("Failed to unassign driver. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (!transaction) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {transaction.assignedDriverId ? "Change Driver" : "Assign Driver"}
          </DialogTitle>
          <DialogDescription>
            Select a driver to assign to this delivery. Customer: {transaction.customerName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="driver">Driver</Label>
              {loadingDrivers ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading drivers...
                </div>
              ) : (
                <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                  <SelectTrigger id="driver">
                    <SelectValue placeholder="Select a driver">
                      {selectedDriverId
                        ? drivers.find((d) => d.id === selectedDriverId)?.fullName || "Select a driver"
                        : "Select a driver"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No drivers available
                      </SelectItem>
                    ) : (
                      drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.fullName}
                          {driver.email && ` (${driver.email})`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <DialogFooter>
            {transaction.assignedDriverId && (
              <Button
                type="button"
                variant="outline"
                onClick={handleUnassign}
                disabled={loading}
              >
                Unassign
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !selectedDriverId || loadingDrivers}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

