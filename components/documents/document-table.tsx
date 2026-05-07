"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Eye, Edit, Trash2, Clock, Truck, CheckCircle } from "lucide-react"
import { DocumentDetailsDialog } from "./document-details-dialog"
import { EditDocumentDialog } from "./edit-document-dialog"
import { DocumentService } from "@/services/firebase-service"
import type { Document } from "@/lib/types"
import { formatTimestamp } from "@/lib/utils"

interface DocumentTableProps {
  documents: Document[]
  loading: boolean
}

export function DocumentTable({ documents, loading }: DocumentTableProps) {
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null)
  const [editingDocument, setEditingDocument] = useState<Document | null>(null)

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this document?")) {
      try {
        await DocumentService.deleteDocument(id)
      } catch (error) {
        console.error("Error deleting document:", error)
      }
    }
  }

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

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded" />
        ))}
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No documents found</p>
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Document Number</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Created By</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Created Date</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((document) => (
            <TableRow key={document.id}>
              <TableCell className="font-medium">{document.number}</TableCell>
              <TableCell>{getDocumentTypeLabel(document.type)}</TableCell>
              <TableCell>{getStatusBadge(document.status)}</TableCell>
              <TableCell>{document.items.length} items</TableCell>
              <TableCell>{document.createdBy}</TableCell>
              <TableCell>{document.assignedTo || "Unassigned"}</TableCell>
              <TableCell>{formatTimestamp(document.createdAt)}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setViewingDocument(document)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditingDocument(document)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(document.id)} className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <DocumentDetailsDialog
        document={viewingDocument}
        open={!!viewingDocument}
        onOpenChange={(open) => !open && setViewingDocument(null)}
      />

      <EditDocumentDialog
        document={editingDocument}
        open={!!editingDocument}
        onOpenChange={(open) => !open && setEditingDocument(null)}
      />
    </>
  )
}
