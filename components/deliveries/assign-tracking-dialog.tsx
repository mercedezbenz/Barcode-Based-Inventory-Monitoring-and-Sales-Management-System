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
import { MapPin } from "lucide-react"

interface AssignTrackingDialogProps {
  delivery: Delivery | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AssignTrackingDialog({ delivery, open, onOpenChange }: AssignTrackingDialogProps) {
  const [loading, setLoading] = useState(false)
  const [deviceId, setDeviceId] = useState("")

  useEffect(() => {
    if (delivery) {
      setDeviceId(delivery.sinotackDeviceId || "")
    }
  }, [delivery])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!delivery || !deviceId.trim()) return

    setLoading(true)
    try {
      await DeliveryService.updateDelivery(delivery.id, {
        sinotackDeviceId: deviceId,
        updatedAt: new Date(),
      })

      onOpenChange(false)
    } catch (error) {
      console.error("Error assigning tracking device:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async () => {
    if (!delivery) return

    setLoading(true)
    try {
      await DeliveryService.updateDelivery(delivery.id, {
        sinotackDeviceId: undefined,
        updatedAt: new Date(),
      })

      setDeviceId("")
      onOpenChange(false)
    } catch (error) {
      console.error("Error removing tracking device:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Assign Sinotrack Device
          </DialogTitle>
          <DialogDescription>
            Link a Sinotrack GPS tracking device to enable real-time vehicle tracking.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Delivery ID</Label>
              <div className="text-sm font-medium text-muted-foreground">{delivery?.id}</div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="deviceId">Sinotrack Device ID</Label>
              <Input
                id="deviceId"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder="Enter Sinotrack device ID (e.g., ST-123456)"
              />
              <p className="text-xs text-muted-foreground">
                Enter the unique device ID from your Sinotrack GPS tracker
              </p>
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-0">
            {delivery?.sinotackDeviceId && (
              <Button type="button" variant="destructive" onClick={handleRemove} disabled={loading}>
                Remove Device
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !deviceId.trim()}>
              {loading ? "Assigning..." : "Assign Device"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
