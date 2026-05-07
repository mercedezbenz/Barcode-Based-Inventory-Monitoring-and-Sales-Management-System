"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, FileText, Clock, Truck, CheckCircle } from "lucide-react"
import { DocumentTable } from "./document-table"
import { CreateDocumentDialog } from "./create-document-dialog"
import { DocumentService } from "@/services/firebase-service"
import type { Document } from "@/lib/types"

export function DocumentDashboard() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Subscribe to real-time document updates
    const unsubscribe = DocumentService.subscribeToDocuments((updatedDocuments) => {
      setDocuments(updatedDocuments)
      setLoading(false)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.type.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter
    const matchesType = typeFilter === "all" || doc.type === typeFilter
    return matchesSearch && matchesStatus && matchesType
  })

  const totalDocuments = documents.length
  const pendingDocuments = documents.filter((doc) => doc.status === "pending").length
  const onDeliveryDocuments = documents.filter((doc) => doc.status === "on_delivery").length
  const deliveredDocuments = documents.filter((doc) => doc.status === "delivered").length

  const documentTypes = [
    { value: "transfer_slip", label: "Transfer Slip", prefix: "TS" },
    { value: "invoice", label: "Invoice", prefix: "INV" },
    { value: "delivery_receipt", label: "Delivery Receipt", prefix: "DR" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-balance">Document Management</h1>
          <p className="text-muted-foreground">Manage transfer slips, invoices, and delivery receipts</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Document
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDocuments}</div>
            <p className="text-xs text-muted-foreground">All document types</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingDocuments}</div>
            <p className="text-xs text-muted-foreground">Awaiting processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Delivery</CardTitle>
            <Truck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{onDeliveryDocuments}</div>
            <p className="text-xs text-muted-foreground">In transit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{deliveredDocuments}</div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
              >
                All Status
              </Button>
              <Button
                variant={statusFilter === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("pending")}
              >
                Pending
              </Button>
              <Button
                variant={statusFilter === "on_delivery" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("on_delivery")}
              >
                On Delivery
              </Button>
              <Button
                variant={statusFilter === "delivered" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("delivered")}
              >
                Delivered
              </Button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap mt-4">
            <Button
              variant={typeFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setTypeFilter("all")}
            >
              All Types
            </Button>
            {documentTypes.map((type) => (
              <Button
                key={type.value}
                variant={typeFilter === type.value ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter(type.value)}
              >
                {type.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>
            {filteredDocuments.length} of {totalDocuments} documents
            {statusFilter !== "all" && ` with status: ${statusFilter}`}
            {typeFilter !== "all" && ` of type: ${typeFilter}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentTable documents={filteredDocuments} loading={loading} />
        </CardContent>
      </Card>

      <CreateDocumentDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </div>
  )
}
