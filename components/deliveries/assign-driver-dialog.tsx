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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DeliveryService } from "@/services/firebase-service"
import type { Delivery } from "@/lib/types"

interface AssignDriverDialogProps {
  delivery: Delivery | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AssignDriverDialog({ delivery, open, onOpenChange }: AssignDriverDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    assignedDriver: "",
    assignedTruck: "",
  })

  useEffect(() => {
    if (delivery) {
      setFormData({
        assignedDriver: delivery.assignedDriver || "",
        assignedTruck: delivery.assignedTruck || "",
      })
    }
  }, [delivery])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!delivery) return

    setLoading(true)
    try {
      await DeliveryService.updateDelivery(delivery.id, {
        assignedDriver: formData.assignedDriver || undefined,
        assignedTruck: formData.assignedTruck || undefined,
        updatedAt: new Date(),
      })

      onOpenChange(false)
    } catch (error) {
      console.error("Error assigning driver:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assign Driver & Truck</DialogTitle>
          <DialogDescription>Assign a driver and truck to this delivery.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Delivery ID</Label>
              <div className="text-sm font-medium text-muted-foreground">{delivery?.id}</div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="driver">Assigned Driver</Label>
              <Input
                id="driver"
                value={formData.assignedDriver}
                onChange={(e) => setFormData({ ...formData, assignedDriver: e.target.value })}
                placeholder="Driver name or ID"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="truck">Assigned Truck</Label>
              <Input
                id="truck"
                value={formData.assignedTruck}
                onChange={(e) => setFormData({ ...formData, assignedTruck: e.target.value })}
                placeholder="Truck number or license plate"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
