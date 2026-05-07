"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DeliveryService } from "@/services/firebase-service"
import type { Delivery } from "@/lib/types"

interface EditDeliveryDialogProps {
  delivery: Delivery | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditDeliveryDialog({ delivery, open, onOpenChange }: EditDeliveryDialogProps) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")

  useEffect(() => {
    if (delivery) {
      setStatus(delivery.status)
    }
  }, [delivery])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!delivery) return

    setLoading(true)
    try {
      await DeliveryService.updateDelivery(delivery.id, {
        status: status as "pending" | "on_delivery" | "delivered",
        updatedAt: new Date(),
      })

      onOpenChange(false)
    } catch (error) {
      console.error("Error updating delivery:", error)
    } finally {
      setLoading(false)
    }
  }

  const statusOptions = [
    { value: "pending", label: "Pending" },
    { value: "on_delivery", label: "On Delivery" },
    { value: "delivered", label: "Delivered" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Delivery Status</DialogTitle>
          <DialogDescription>Update the delivery status to track progress.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Delivery ID</Label>
              <div className="text-sm font-medium text-muted-foreground">{delivery?.id}</div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
