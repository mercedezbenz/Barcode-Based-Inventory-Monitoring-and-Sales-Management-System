"use client"

import type React from "react"

import { useState } from "react"
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
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"
import { DeliveryService } from "@/services/firebase-service"
import type { Document } from "@/lib/types"

interface CreateDeliveryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documents: Document[]
}

export function CreateDeliveryDialog({ open, onOpenChange, documents }: CreateDeliveryDialogProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    documentId: "",
    assignedDriver: "",
    assignedTruck: "",
  })

  // Filter documents that don't already have deliveries
  const availableDocuments = documents.filter((doc) => doc.status === "pending")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !formData.documentId) return

    setLoading(true)
    try {
      await DeliveryService.addDelivery({
        documentId: formData.documentId,
        status: "pending",
        assignedDriver: formData.assignedDriver || undefined,
        assignedTruck: formData.assignedTruck || undefined,
        createdBy: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Reset form
      setFormData({
        documentId: "",
        assignedDriver: "",
        assignedTruck: "",
      })
      onOpenChange(false)
    } catch (error) {
      console.error("Error creating delivery:", error)
    } finally {
      setLoading(false)
    }
  }

  const getDocumentTypeLabel = (type: string) => {
    switch (type) {
      case "transfer_slip":
        return "Transfer Slip"
      case "invoice":
        return "Invoice"
      case "delivery_receipt":
        return "Delivery Receipt"
      default:
        return type
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Delivery</DialogTitle>
          <DialogDescription>Create a delivery assignment for a document.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="document">Select Document</Label>
              <Select
                value={formData.documentId}
                onValueChange={(value) => setFormData({ ...formData, documentId: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a document" />
                </SelectTrigger>
                <SelectContent>
                  {availableDocuments.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">No pending documents available</div>
                  ) : (
                    availableDocuments.map((document) => (
                      <SelectItem key={document.id} value={document.id}>
                        {document.number} - {getDocumentTypeLabel(document.type)} ({document.items.length} items)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="driver">Assigned Driver (Optional)</Label>
              <Input
                id="driver"
                value={formData.assignedDriver}
                onChange={(e) => setFormData({ ...formData, assignedDriver: e.target.value })}
                placeholder="Driver name or ID"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="truck">Assigned Truck (Optional)</Label>
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
            <Button type="submit" disabled={loading || !formData.documentId}>
              {loading ? "Creating..." : "Create Delivery"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
