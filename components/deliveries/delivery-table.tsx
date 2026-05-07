"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Edit, Trash2, Clock, Truck, CheckCircle, Eye, UserCheck, MapPin } from "lucide-react"
import { DeliveryDetailsDialog } from "./delivery-details-dialog"
import { EditDeliveryDialog } from "./edit-delivery-dialog"
import { AssignDriverDialog } from "./assign-driver-dialog"
import { AssignTrackingDialog } from "./assign-tracking-dialog"
import { DeliveryService } from "@/services/firebase-service"
import { useAuth } from "@/hooks/use-auth"
import type { Delivery, Document } from "@/lib/types"
import { formatTimestamp } from "@/lib/utils"

interface DeliveryTableProps {
  deliveries: Delivery[]
  documents: Document[]
  loading: boolean
}

export function DeliveryTable({ deliveries, documents, loading }: DeliveryTableProps) {
  const [viewingDelivery, setViewingDelivery] = useState<Delivery | null>(null)
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null)
  const [assigningDelivery, setAssigningDelivery] = useState<Delivery | null>(null)
  const [assigningTracking, setAssigningTracking] = useState<Delivery | null>(null)
  const { isReadOnly } = useAuth()

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this delivery?")) {
      try {
        await DeliveryService.deleteDelivery(id)
      } catch (error) {
        console.error("Error deleting delivery:", error)
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

  const getRelatedDocument = (documentId: string) => {
    return documents.find((doc) => doc.id === documentId)
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

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Document</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Driver</TableHead>
            <TableHead>Truck</TableHead>
            <TableHead className="text-center">Tracking</TableHead>
            <TableHead>Created Date</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deliveries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8">
                <p className="text-muted-foreground">No deliveries found</p>
              </TableCell>
            </TableRow>
          ) : (
            deliveries.map((delivery) => {
              const relatedDocument = getRelatedDocument(delivery.documentId)
              return (
                <TableRow key={delivery.id}>
                  <TableCell className="font-medium">{relatedDocument?.number || "Unknown"}</TableCell>
                  <TableCell>{getStatusBadge(delivery.status)}</TableCell>
                  <TableCell>{delivery.assignedDriver || "Unassigned"}</TableCell>
                  <TableCell>{delivery.assignedTruck || "No truck"}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      {delivery.sinotackDeviceId ? (
                        <>
                          <Badge variant="default" className="flex items-center gap-1 justify-center bg-green-500">
                            <MapPin className="h-3 w-3" />
                            Active
                          </Badge>
                          <a
                            href={`https://sinotrackpro.com/#/login?account=${encodeURIComponent(
                              process.env.NEXT_PUBLIC_SINOTRACK_ACCOUNT || "",
                            )}&password=${encodeURIComponent(
                              process.env.NEXT_PUBLIC_SINOTRACK_PASSWORD || "",
                            )}&device=${encodeURIComponent(delivery.sinotackDeviceId)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" variant="outline">Track Delivery</Button>
                          </a>
                        </>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1 justify-center">
                          <MapPin className="h-3 w-3" />
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatTimestamp(delivery.createdAt)}</TableCell>
                  <TableCell>
                    {!isReadOnly && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewingDelivery(delivery)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAssigningDelivery(delivery)}>
                            <UserCheck className="mr-2 h-4 w-4" />
                            Assign Driver
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAssigningTracking(delivery)}>
                            <MapPin className="mr-2 h-4 w-4" />
                            Assign Tracking
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingDelivery(delivery)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Status
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(delivery.id)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>

      <DeliveryDetailsDialog
        delivery={viewingDelivery}
        document={viewingDelivery ? (getRelatedDocument(viewingDelivery.documentId) || null) : null}
        open={!!viewingDelivery}
        onOpenChange={(open) => !open && setViewingDelivery(null)}
      />

      <EditDeliveryDialog
        delivery={editingDelivery}
        open={!!editingDelivery}
        onOpenChange={(open) => !open && setEditingDelivery(null)}
      />

      <AssignDriverDialog
        delivery={assigningDelivery}
        open={!!assigningDelivery}
        onOpenChange={(open) => !open && setAssigningDelivery(null)}
      />

      <AssignTrackingDialog
        delivery={assigningTracking}
        open={!!assigningTracking}
        onOpenChange={(open) => !open && setAssigningTracking(null)}
      />
    </>
  )
}
