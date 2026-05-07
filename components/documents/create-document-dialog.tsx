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
import { Checkbox } from "@/components/ui/checkbox"
import { useAuth } from "@/hooks/use-auth"
import { DocumentService, InventoryService } from "@/services/firebase-service"
import type { InventoryItem } from "@/lib/types"

interface CreateDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateDocumentDialog({ open, onOpenChange }: CreateDocumentDialogProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [formData, setFormData] = useState({
    type: "",
    assignedTo: "",
  })

  useEffect(() => {
    const loadInventoryItems = async () => {
      try {
        const items = await InventoryService.getItems()
        setInventoryItems(items)
      } catch (error) {
        console.error("Error loading inventory items:", error)
      }
    }

    if (open) {
      loadInventoryItems()
    }
  }, [open])

  const generateDocumentNumber = (type: string, existingCount: number) => {
    const prefixes = {
      transfer_slip: "TS",
      invoice: "INV",
      delivery_receipt: "DR",
    }
    const prefix = prefixes[type as keyof typeof prefixes] || "DOC"
    return `${prefix}-${String(existingCount + 1).padStart(3, "0")}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || selectedItems.length === 0) return

    setLoading(true)
    try {
      // Get existing documents to generate number
      const existingDocs = await DocumentService.getDocuments()
      const sameTypeCount = existingDocs.filter((doc) => doc.type === formData.type).length
      const documentNumber = generateDocumentNumber(formData.type, sameTypeCount)

      // Get selected inventory items
      const selectedInventoryItems = inventoryItems.filter((item) => selectedItems.includes(item.id))

      await DocumentService.addDocument({
        type: formData.type as "transfer_slip" | "invoice" | "delivery_receipt",
        number: documentNumber,
        status: "pending",
        items: selectedInventoryItems,
        createdBy: user.uid,
        assignedTo: formData.assignedTo || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Reset form
      setFormData({ type: "", assignedTo: "" })
      setSelectedItems([])
      onOpenChange(false)
    } catch (error) {
      console.error("Error creating document:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleItemToggle = (itemId: string) => {
    setSelectedItems((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]))
  }

  const documentTypes = [
    { value: "transfer_slip", label: "Transfer Slip" },
    { value: "invoice", label: "Invoice" },
    { value: "delivery_receipt", label: "Delivery Receipt" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Document</DialogTitle>
          <DialogDescription>Create a new transfer slip, invoice, or delivery receipt.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="type">Document Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="assignedTo">Assigned To (Optional)</Label>
              <Input
                id="assignedTo"
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                placeholder="Driver or staff member ID"
              />
            </div>

            <div className="grid gap-2">
              <Label>Select Inventory Items</Label>
              <div className="border rounded-md p-4 max-h-60 overflow-y-auto">
                {inventoryItems.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No inventory items available</p>
                ) : (
                  <div className="space-y-2">
                    {inventoryItems.map((item) => (
                      <div key={item.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={item.id}
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={() => handleItemToggle(item.id)}
                        />
                        <Label htmlFor={item.id} className="flex-1 cursor-pointer">
                          <div className="flex justify-between">
                            <span>{item.name}</span>
                            <span className="text-muted-foreground text-sm">
                              {item.category} - Stock: {item.total}
                            </span>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{selectedItems.length} items selected</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || selectedItems.length === 0}>
              {loading ? "Creating..." : "Create Document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
