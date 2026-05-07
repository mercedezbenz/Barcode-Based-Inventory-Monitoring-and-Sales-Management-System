"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Clock, Truck, CheckCircle, FileText, User, Calendar } from "lucide-react"
import type { Document } from "@/lib/types"
import { formatTimestamp } from "@/lib/utils"

interface DocumentDetailsDialogProps {
  document: Document | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DocumentDetailsDialog({ document, open, onOpenChange }: DocumentDetailsDialogProps) {
  if (!document) return null

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        )
      case "on_delivery":
        return (
          <Badge variant="default" className="flex items-center gap-1 bg-blue-500">
            <Truck className="h-3 w-3" />
            On Delivery
          </Badge>
        )
      case "delivered":
        return (
          <Badge variant="default" className="flex items-center gap-1 bg-green-500">
            <CheckCircle className="h-3 w-3" />
            Delivered
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
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
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {document.number}
          </DialogTitle>
          <DialogDescription>{getDocumentTypeLabel(document.type)} Details</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Document Info */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Document Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span>{getDocumentTypeLabel(document.type)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  {getStatusBadge(document.status)}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items:</span>
                  <span>{document.items.length} items</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Assignment Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created By:</span>
                  <span>{document.createdBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assigned To:</span>
                  <span>{document.assignedTo || "Unassigned"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="text-sm">{formatTimestamp(document.createdAt)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Items Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Document Items
              </CardTitle>
              <CardDescription>{document.items.length} items in this document</CardDescription>
            </CardHeader>
            <CardContent>
              {document.items.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No items in this document</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Subcategory</TableHead>
                      <TableHead className="text-right">Stock Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {document.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{item.subcategory}</TableCell>
                        <TableCell className="text-right">{item.total.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
