"use client"

import { useState } from "react"
import { useEncoderTasks } from "@/hooks/useEncoderTasks"
import { AuthLoadingSkeleton } from "@/components/skeletons/dashboard-skeleton"
import { Search, FileText, CheckCircle2, Factory } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EncoderTaskProcessingModal } from "./encoder-task-processing-modal"
import { updateOrderStatus } from "@/lib/order-utils"

const formatCurrency = (amount: number): string =>
  `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const STATUS_FILTER = [
  "ready_for_processing", "READY_FOR_PROCESSING", 
  "processing", "PROCESSING",
  "for_verification", "FOR_VERIFICATION", 
  "for_delivery", "FOR_DELIVERY",
  "on_delivery", "ON_DELIVERY",
  "delivered", "DELIVERED",
  "completed", "COMPLETED"
]

const StatusBadge = ({ status }: { status?: string }) => {
  if (!status) return <span className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-full bg-gray-100 text-gray-600 border border-gray-200">Unknown</span>

  const normalized = status.toLowerCase()
  let label = status
  let classes = "bg-gray-100 text-gray-700 border-gray-200"

  switch (normalized) {
    case "pending":
    case "ready_for_processing":
    case "processing":
      label = "Pending"
      classes = "bg-blue-50 text-blue-700 border-blue-200"
      break
    case "verified":
    case "for_verification":
    case "for_delivery":
      label = "Verified & Ready"
      classes = "bg-emerald-50 text-emerald-700 border-emerald-200"
      break
    case "on_delivery":
      label = "On Delivery"
      classes = "bg-orange-50 text-orange-700 border-orange-200"
      break
    case "delivered":
    case "completed":
      label = "Delivered"
      classes = "bg-green-50 text-green-700 border-green-200"
      break
    case "cancelled":
      label = "Cancelled"
      classes = "bg-red-50 text-red-700 border-red-200"
      break
    default:
      label = status.replace(/_/g, " ")
      break
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-full border ${classes}`}>
      {label}
    </span>
  )
}

export function EncoderDashboard() {
  const { tasks: orders, loading } = useEncoderTasks(STATUS_FILTER)
  const [search, setSearch] = useState("")
  const [selectedTask, setSelectedTask] = useState<any | null>(null)
  const [activeTab, setActiveTab] = useState<"pending" | "verification" | "delivery" | "on_delivery" | "completed">("pending")
  const [processingId, setProcessingId] = useState<string | null>(null)

  const tabOrders = orders.filter(o => {
    const s = (o.status || "").toUpperCase()
    if (activeTab === "pending") return s === "READY_FOR_PROCESSING" || s === "PROCESSING"
    if (activeTab === "verification") return s === "FOR_VERIFICATION"
    if (activeTab === "delivery") return s === "FOR_DELIVERY"
    if (activeTab === "on_delivery") return s === "ON_DELIVERY"
    if (activeTab === "completed") return s === "COMPLETED" || s === "DELIVERED"
    return false
  })

  const filteredOrders = tabOrders.filter((order) => {
    const term = search.toLowerCase()
    return (
      order.customerName?.toLowerCase().includes(term) ||
      order.salesInvoiceNo?.toLowerCase().includes(term) ||
      order.salesInvoiceNumber?.toLowerCase().includes(term) ||
      order.deliveryReceiptNo?.toLowerCase().includes(term) ||
      order.deliveryReceiptNumber?.toLowerCase().includes(term)
    )
  })

  const handleMarkOnDelivery = async (order: any) => {
    setProcessingId(order.id)
    try {
      const { doc, updateDoc, serverTimestamp, getFirestore } = await import("firebase/firestore")
      const db = getFirestore()
      
      // Update order status
      if (order.orderId) {
        await updateOrderStatus(order.orderId, "out_for_delivery")
      }
      
      // Update encoder task status
      await updateDoc(doc(db, "encoder_tasks", order.id), {
        status: "ON_DELIVERY",
        onDeliveryAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      
      const { toast } = await import("sonner")
      toast.success("Order dispatched for delivery!")
      
    } catch (err) {
      console.error(err)
    } finally {
      setProcessingId(null)
    }
  }

  const handleDeliverOrder = async (order: any) => {
    if (!window.confirm("Are you sure this order has been delivered?")) return;
    
    setProcessingId(order.id)
    try {
      const { doc, updateDoc, serverTimestamp, getFirestore } = await import("firebase/firestore")
      const db = getFirestore()
      
      // Update order status
      if (order.orderId) {
        await updateOrderStatus(order.orderId, "delivered")
      }
      
      // Update encoder task status
      await updateDoc(doc(db, "encoder_tasks", order.id), {
        status: "COMPLETED",
        deliveredAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      
      const { toast } = await import("sonner")
      toast.success("Order marked as delivered!")
      
    } catch (err) {
      console.error(err)
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) {
    return <AuthLoadingSkeleton />
  }

  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-gray-900 dark:text-foreground tracking-tight">Encoder Tasks</h1>
          <p className="text-sm text-gray-500 dark:text-muted-foreground mt-1">
            View pending encoder tasks and process stock deductions via FIFO.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-card border border-gray-100 dark:border-border rounded-xl shadow-sm text-sm">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-border">
          <button
            onClick={() => setActiveTab("pending")}
            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors border-b-2 ${
              activeTab === "pending"
                ? "border-blue-600 text-blue-700 dark:border-blue-500 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            Pending Tasks
          </button>
          <button
            onClick={() => setActiveTab("verification")}
            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors border-b-2 ${
              activeTab === "verification"
                ? "border-emerald-600 text-emerald-700 dark:border-emerald-500 dark:text-emerald-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            Verification
          </button>
          <button
            onClick={() => setActiveTab("delivery")}
            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors border-b-2 ${
              activeTab === "delivery"
                ? "border-violet-600 text-violet-700 dark:border-violet-500 dark:text-violet-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            For Delivery
          </button>
          <button
            onClick={() => setActiveTab("on_delivery")}
            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors border-b-2 ${
              activeTab === "on_delivery"
                ? "border-orange-600 text-orange-700 dark:border-orange-500 dark:text-orange-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            On Delivery
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors border-b-2 ${
              activeTab === "completed"
                ? "border-green-600 text-green-700 dark:border-green-500 dark:text-green-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            Completed
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100 dark:border-border">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by customer, invoice, or DR number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-secondary/30 border border-gray-200 dark:border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all text-gray-800 dark:text-foreground placeholder:text-gray-400"
            />
          </div>
          <div className={`flex items-center gap-2 ml-auto text-sm font-medium px-3 py-1.5 rounded-full border ${
            activeTab === 'pending' 
              ? 'text-blue-600 bg-blue-50 border-blue-100' 
              : activeTab === 'verification'
                ? 'text-emerald-600 bg-emerald-50 border-emerald-100'
                : activeTab === 'delivery'
                ? 'text-violet-600 bg-violet-50 border-violet-100'
                : activeTab === 'on_delivery'
                ? 'text-orange-600 bg-orange-50 border-orange-100'
                : 'text-green-600 bg-green-50 border-green-100'
          }`}>
            <CheckCircle2 className="h-4 w-4" />
            {filteredOrders.length} {activeTab === "pending" ? "Pending" : activeTab === "verification" ? "To Verify" : activeTab === "delivery" ? "To Dispatch" : activeTab === "on_delivery" ? "In Transit" : "Completed"}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[400px]">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[350px] text-gray-400">
              <div className="h-14 w-14 rounded-full bg-gray-50 dark:bg-secondary/50 flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-gray-300" />
              </div>
              <p className="font-medium text-gray-500 dark:text-foreground">No pending tasks found</p>
              <p className="text-xs mt-1">Tasks will appear here once marked as ready by sales</p>
            </div>
          ) : (
            <div className="min-w-[900px] w-full">
              {/* Header */}
              <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_1fr] gap-3 px-6 py-3 bg-gray-50/50 dark:bg-secondary/20 border-b border-gray-100 dark:border-border text-[11px] font-semibold text-gray-400 uppercase tracking-wider sticky top-0 z-10">
                <div>Customer Info</div>
                <div>Items</div>
                <div>Sales Invoice No.</div>
                <div>Delivery Receipt No.</div>
                <div>Status</div>
                <div className="text-right">Action</div>
              </div>

              {/* Body */}
              <div className="divide-y divide-gray-50 dark:divide-border/50">
                {filteredOrders.map((order) => {
                  
                  // For Verification Tab, calculate scanned progress dynamically if we need it
                  const totalItems = order.selectedStocks ? order.selectedStocks.length : 0;
                  const scannedItems = order.selectedStocks ? order.selectedStocks.filter((s: any) => s.scanned === true || (s.scannedWeight >= s.requiredWeight && s.requiredWeight > 0)).length : 0;
                  
                  return (
                  <div
                    key={order.id}
                    className={`grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_1fr] gap-3 py-4 px-6 items-center transition-all duration-200 hover:bg-sky-50/40 dark:hover:bg-secondary/30 group border-l-[3px] rounded-r-md -ml-px ${
                      activeTab === "pending" ? "border-blue-400" : activeTab === "verification" ? "border-emerald-400" : activeTab === "delivery" ? "border-violet-400" : activeTab === "on_delivery" ? "border-orange-400" : "border-green-400"
                    }`}
                  >
                    {/* Customer */}
                    <div className="min-w-0 pr-4">
                      <div className="font-bold text-gray-900 dark:text-foreground text-[14px] truncate">
                        {order.customerName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-muted-foreground truncate mt-0.5">
                        Order #{order.orderId}
                      </div>
                    </div>

                    {/* Items or Selected Stocks depending on tab */}
                    <div className="min-w-0 pr-4">
                      {activeTab === "pending" ? (
                        order.items && order.items.length > 0 ? (
                          <ul className="text-[13px] text-gray-600 dark:text-foreground space-y-1">
                            {order.items.map((item: any, idx: number) => {
                              const weight = item.quantity || 0;
                              const boxes = Math.ceil(weight / 25);
                              return (
                                <li key={idx} className="truncate">
                                  • {item.name} <span className="text-gray-400">({weight} kg • {boxes} boxes)</span>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No items</span>
                        )
                      ) : (
                        order.selectedStocks && order.selectedStocks.length > 0 ? (
                          <ul className="text-[13px] text-gray-600 dark:text-foreground space-y-1">
                            {order.selectedStocks.map((stock: any, idx: number) => {
                              const weight = stock.requiredWeight || stock.allocatedWeight || stock.selectedWeight || 0;
                              const boxes = Math.ceil(weight / 25);
                              return (
                                <li key={idx} className="truncate">
                                  • {stock.itemName} 
                                  <span className={activeTab === "delivery" || activeTab === "on_delivery" || activeTab === "completed" ? "text-violet-600 font-bold ml-1 text-[11px]" : "text-gray-500 font-mono ml-1 text-[11px]"}>
                                    ({weight} kg • {boxes} boxes)
                                    {activeTab === "verification" && ` • ${stock.barcode}`}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <span className="text-xs text-red-500 italic">No stock selected</span>
                        )
                      )}
                    </div>

                    {/* Invoice */}
                    <div className="min-w-0 flex flex-col justify-center">
                      <span className="font-mono text-sm text-gray-800 dark:text-foreground bg-gray-100 dark:bg-secondary px-2 py-1 rounded inline-block w-fit border border-gray-200 dark:border-border">
                        {order.salesInvoiceNo || order.salesInvoiceNumber || "N/A"}
                      </span>
                    </div>

                    {/* Receipt */}
                    <div className="min-w-0 flex flex-col justify-center">
                      <span className="font-mono text-sm text-gray-800 dark:text-foreground bg-gray-100 dark:bg-secondary px-2 py-1 rounded inline-block w-fit border border-gray-200 dark:border-border">
                        {order.deliveryReceiptNo || order.deliveryReceiptNumber || "N/A"}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="min-w-0 flex flex-col justify-center items-start">
                      <StatusBadge status={order.status} />
                      {activeTab === "verification" && totalItems > 0 && (
                        <div className="text-[10px] font-medium text-muted-foreground mt-1.5 ml-1">
                          {scannedItems === totalItems ? "All items scanned" : `${scannedItems}/${totalItems} items scanned`}
                        </div>
                      )}
                    </div>

                    {/* Action */}
                    <div className="min-w-0 flex justify-end">
                      {activeTab === "delivery" ? (
                        <Button
                          size="sm"
                          onClick={() => handleMarkOnDelivery(order)}
                          disabled={processingId === order.id}
                          className="rounded-lg shadow-sm font-medium bg-violet-600 hover:bg-violet-700 text-white"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          {processingId === order.id ? "Dispatching..." : "Mark as On Delivery"}
                        </Button>
                      ) : activeTab === "on_delivery" ? (
                        <Button
                          size="sm"
                          onClick={() => handleDeliverOrder(order)}
                          disabled={processingId === order.id}
                          className="rounded-lg shadow-sm font-medium bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          {processingId === order.id ? "Processing..." : "Mark as Delivered"}
                        </Button>
                      ) : activeTab === "completed" ? (
                        <Button
                          size="sm"
                          disabled
                          className="rounded-lg shadow-sm font-medium bg-green-50 text-green-700 border border-green-200 opacity-100"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Delivery Completed
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setSelectedTask(order)}
                          className={`rounded-lg shadow-sm font-medium ${
                            activeTab === "pending" 
                              ? "bg-blue-600 hover:bg-blue-700 text-white" 
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                          }`}
                        >
                          {activeTab === "pending" ? (
                            <>
                              <Factory className="h-4 w-4 mr-2" />
                              Select Stock
                            </>
                          ) : (
                            <>
                              <FileText className="h-4 w-4 mr-2" />
                              Ready to Scan
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                )})}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Processing Modal */}
      {selectedTask && (
        <EncoderTaskProcessingModal 
          task={selectedTask} 
          isOpen={true} 
          onClose={() => setSelectedTask(null)} 
        />
      )}
    </div>
  )
}
