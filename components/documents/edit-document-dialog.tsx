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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DocumentService } from "@/services/firebase-service"
import type { Document } from "@/lib/types"

interface EditDocumentDialogProps {
  document: Document | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditDocumentDialog({ document, open, onOpenChange }: EditDocumentDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    status: "",
    assignedTo: "",
  })

  useEffect(() => {
    if (document) {
      setFormData({
        status: document.status,
        assignedTo: document.assignedTo || "",
      })
    }
  }, [document])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!document) return

    setLoading(true)
    try {
      await DocumentService.updateDocument(document.id, {
        status: formData.status as "pending" | "on_delivery" | "delivered",
        assignedTo: formData.assignedTo || undefined,
        updatedAt: new Date(),
      })

      onOpenChange(false)
    } catch (error) {
      console.error("Error updating document:", error)
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
          <DialogTitle>Edit Document</DialogTitle>
          <DialogDescription>Update the document status and assignment information.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Document Number</Label>
              <div className="text-sm font-medium text-muted-foreground">{document?.number}</div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
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

            <div className="grid gap-2">
              <Label htmlFor="assignedTo">Assigned To</Label>
              <Input
                id="assignedTo"
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                placeholder="Driver or staff member ID"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
