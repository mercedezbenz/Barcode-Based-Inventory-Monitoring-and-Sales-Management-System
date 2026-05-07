"use client"

import { useRef, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { doc, updateDoc, collection, addDoc, serverTimestamp, getDocs, query, where, limit } from "firebase/firestore"
import { getFirebaseDb, auth } from "@/lib/firebase-live"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import {
  ArrowLeft, User, MapPin, Phone, Mail, Package, CheckCircle2,
  XCircle, Clock, Printer, Receipt, FileText,
} from "lucide-react"
import { useOrderDetails } from "@/hooks/useOrderDetails"
import { ReceiptView } from "./receipt-view"
import { AuthLoadingSkeleton } from "@/components/skeletons/dashboard-skeleton"
import { useAuth } from "@/hooks/use-auth"
import { updateOrderStatus } from "@/lib/order-utils"

// ─── Helpers ───
const parseDate = (d: any): Date | null => {
  if (!d) return null
  if (typeof d === "string") return new Date(d)
  if (d instanceof Date) return d
  if (d?.toDate) return d.toDate()
  if (d?.seconds) return new Date(d.seconds * 1000)
  return null
}

const formatDate = (d: any): string => {
  const date = parseDate(d)
  if (!date || isNaN(date.getTime())) return "N/A"
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

const formatTime = (d: any): string => {
  const date = parseDate(d)
  if (!date || isNaN(date.getTime())) return ""
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
}

// Status badge
const StatusBadge = ({ status }: { status: string }) => {
  let cls = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase "
  let icon = null
  let statusLabel = status

  switch (status) {
    case "pending":
      cls += "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
      icon = <Clock className="h-3.5 w-3.5" />
      break
    case "in_production":
    case "ready_for_processing":
    case "PROCESSING":
      cls += "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800"
      icon = <Clock className="h-3.5 w-3.5" />
      statusLabel = "In Production"
      break
    case "in_transit":
      cls += "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800"
      icon = <Package className="h-3.5 w-3.5" />
      statusLabel = "In Transit"
      break
    case "out_for_delivery":
      cls += "bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800"
      icon = <Package className="h-3.5 w-3.5" />
      statusLabel = "Out for Delivery"
      break
    case "delivered":
    case "completed":
      cls += "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
      icon = <CheckCircle2 className="h-3.5 w-3.5" />
      break
    case "cancelled":
      cls += "bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
      icon = <XCircle className="h-3.5 w-3.5" />
      break
    default:
      cls += "bg-gray-50 text-gray-600 border border-gray-200"
      statusLabel = status.replace(/_/g, ' ')
  }

  return <span className={cls}>{icon}{statusLabel}</span>
}

interface OrderDetailsProps {
  orderId: string
}

export function OrderDetails({ orderId }: OrderDetailsProps) {
  const router = useRouter()
  const { order, loading, updateStatus } = useOrderDetails(orderId)
  const { user, isReadOnly } = useAuth()
  const isSales = user?.role?.toLowerCase() === "sales"
  const receiptRef = useRef<HTMLDivElement>(null)

  const [confirmAction, setConfirmAction] = useState<"pending" | "PROCESSING" | "completed" | "cancelled" | null>(null)
  const [updating, setUpdating] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  
  // Fulfillment Fields
  const [invoiceNo, setInvoiceNo] = useState("")
  const [receiptNo, setReceiptNo] = useState("")

  useEffect(() => {
    if (order) {
      setInvoiceNo(order.salesInvoiceNo || "")
      setReceiptNo(order.deliveryReceiptNo || "")
      console.log("READ STATUS →", order.status)
    }
  }, [order])

  const handleFieldBlur = async (field: "salesInvoiceNo" | "deliveryReceiptNo", value: string) => {
    if (!order) return
    // Only update if changed
    if (order[field] === value) return
    
    try {
      const db = getFirebaseDb()
      await updateDoc(doc(db, "orders", orderId), { [field]: value })
      toast.success("Order details saved")
    } catch (error: any) {
      toast.error("Failed to save: " + error.message)
    }
  }

  // Primary workflow action
  const handleConfirmAndSend = async () => {
    if (!order) return;
    if (!invoiceNo.trim() || !receiptNo.trim()) {
      toast.error("Both fields are required before confirming");
      return;
    }
    
    setUpdating(true)
    try {
      console.log("🔥 BUTTON CLICKED:", orderId);
      
      const db = getFirebaseDb()
      
      const updateData: any = { 
        salesInvoiceNo: invoiceNo,
        deliveryReceiptNo: receiptNo,
        isInvoiceConfirmed: true,
        updatedAt: serverTimestamp(),
        processedAt: serverTimestamp()
      }
      
      // STEP 1: Update order details (without touching status directly)
      await updateDoc(doc(db, "orders", orderId), updateData)
      await updateOrderStatus(orderId, "in_production")
      console.log("✅ Order updated");
      
      // STEP 2: Prevent duplicate encoder tasks
      const encoderTasksRef = collection(db, "encoder_tasks");
      const q = query(
        encoderTasksRef, 
        where("orderId", "==", orderId)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // Fallback sanity for Firestore items array
        const safeItems = (order.items || []).map(item => {
          const cleanItem: any = {};
          for (const key in item) {
            if ((item as any)[key] !== undefined) {
              cleanItem[key] = (item as any)[key];
            }
          }
          return cleanItem;
        });

        // STEP 3: Create encoder task
        await addDoc(encoderTasksRef, {
          orderId: orderId,
          customerName: order.shippingAddress?.fullName || order.customerName || "N/A",
          items: safeItems,
          salesInvoiceNo: invoiceNo,
          deliveryReceiptNo: receiptNo,
          
          // ⚠️ IMPORTANT: mapped from order status
          status: "PROCESSING",
          encoderStatus: "pending",
          
          createdAt: serverTimestamp()
        });

        // Backend Notification System - Check if exists first
        const existingNotifQuery = query(
          collection(db, "notifications"),
          where("orderId", "==", orderId),
          where("type", "==", "order"),
          limit(1)
        );
        const existingNotifSnap = await getDocs(existingNotifQuery);

        if (existingNotifSnap.empty) {
          await addDoc(collection(db, "notifications"), {
            title: "Ready for Processing",
            message: `Order #${orderId.slice(-6).toUpperCase()} is ready for processing.`,
            targetRole: "encoder",
            userId: null,
            type: "order",
            isRead: false,
            orderId: orderId,
            createdAt: serverTimestamp()
          });
        }

        console.log("✅ Encoder task created");
        toast.success("Order confirmed and sent to Encoder");
      } else {
        console.log("⚠️ Encoder task already exists");
        toast.success("Order marked as ready (Encoder task already exists)");
      }
    } catch (error: any) {
      console.error("❌ ERROR:", error);
      toast.error("Failed to process request: " + error.message);
    } finally {
      setUpdating(false)
    }
  }

  // Fallback for cancellation/reopening (Left in for state safety)
  const handleOtherStatusChange = async () => {
    if (!confirmAction) return;
    setUpdating(true);
    try {
      const db = getFirebaseDb();
      if (confirmAction === "cancelled" || confirmAction === "pending") {
         await updateDoc(doc(db, "orders", orderId), {
           status: confirmAction,
           updatedAt: serverTimestamp()
         });
      } else {
         await updateOrderStatus(orderId, confirmAction);
      }
      toast.success(`Order marked as ${confirmAction}`);
    } catch (error: any) {
      toast.error("Failed: " + error.message);
    } finally {
      setUpdating(false);
      setConfirmAction(null);
    }
  }

  const handlePrint = () => {
    setShowReceipt(true)
    setTimeout(() => {
      window.print()
    }, 300)
  }

  const totalAmount = order?.items?.reduce((sum, item) => {
    return sum + ((item.price || 0) * (item.quantity || 0))
  }, 0) ?? 0

  if (loading) {
    return <AuthLoadingSkeleton />
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-secondary/50 flex items-center justify-center mb-4">
          <Package className="h-7 w-7 text-gray-300" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-foreground mb-1">Order Not Found</h2>
        <p className="text-sm text-gray-400 mb-6">This order may have been deleted or doesn&apos;t exist.</p>
        <Button variant="outline" onClick={() => router.push("/orders")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Orders
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6 pb-12 animate-in fade-in duration-500">
        {/* Header Ribbon */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/orders")}
            className="h-9 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-secondary/80 text-gray-600 dark:text-gray-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Orders
          </Button>
          <div className="flex-1">
            <h1 className="text-[28px] font-bold text-gray-900 dark:text-foreground tracking-tight leading-tight">
              Order #{order.id}
            </h1>
          </div>
        </div>

        {/* 2-Column Layout */}
        <div className="flex flex-col xl:flex-row gap-6 items-start">
          
          {/* LEFT: Order Info (Customer, Items) */}
          <div className="flex-1 w-full space-y-6">
            
            {/* Customer Information Card */}
            <Card className="rounded-2xl border border-gray-100 dark:border-border shadow-sm bg-white dark:bg-card">
              <CardHeader className="px-6 pt-6 pb-4 border-b border-gray-50 dark:border-border/50">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center">
                    <User className="h-4 w-4 text-sky-500" />
                  </div>
                  Customer Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Full Name</p>
                    <p className="text-[15px] font-medium text-gray-900 dark:text-foreground">{order.shippingAddress?.fullName || order.customerName}</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Phone className="h-3 w-3" /> Phone Number
                    </p>
                    <p className="text-[15px] text-gray-600 dark:text-foreground/80">{order.customerPhone || "N/A"}</p>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" /> Delivery Address
                    </p>
                    <p className="text-[15px] text-gray-600 dark:text-foreground/80 leading-relaxed">
  {[
    order.shippingAddress?.street,
    order.shippingAddress?.barangay,
    order.shippingAddress?.city,
    order.shippingAddress?.province,
    order.shippingAddress?.postalCode,
  ]
    .filter(Boolean)
    .join(", ") || "N/A"}
</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Items Card */}
            <Card className="rounded-2xl border border-gray-100 dark:border-border shadow-sm bg-white dark:bg-card overflow-hidden">
              <CardHeader className="px-6 pt-6 pb-4 border-b border-gray-50 dark:border-border/50 bg-gray-50/50 dark:bg-secondary/20">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center">
                      <Package className="h-4 w-4 text-indigo-500" />
                    </div>
                    Order Items
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 bg-gray-100 dark:bg-secondary text-gray-600 dark:text-gray-300 rounded-full">
                    {order.items?.length || 0} Products
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {order.items && order.items.length > 0 ? (
                  <div className="w-full">
                    {/* Header Row */}
                    <div className="grid grid-cols-[3fr_1fr_1fr_1fr] gap-4 px-6 py-3 bg-gray-50/80 dark:bg-secondary/30 text-[11px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-border">
                      <div>Product</div>
                      <div className="text-center">Quantity</div>
                      <div className="text-right">Price</div>
                      <div className="text-right">Subtotal</div>
                    </div>
                    {/* Items */}
                    <div className="divide-y divide-gray-50 dark:divide-border/50">
                      {order.items.map((item, idx) => {
                        const hasPrice = item.price !== undefined && item.price !== null
                        const subtotal = hasPrice ? (item.price! * (item.quantity || 0)) : null
                        return (
                          <div key={idx} className="grid grid-cols-[3fr_1fr_1fr_1fr] gap-4 px-6 py-4 items-center hover:bg-gray-50/50 dark:hover:bg-secondary/20 transition-colors">
                            <p className="text-[14px] font-semibold text-gray-900 dark:text-foreground">{item.name || "Unnamed Item"}</p>
                            <div className="flex justify-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
                                {item.quantity} {item.unit || "unit"}
                              </span>
                            </div>
                            <p className="text-[13px] text-gray-600 dark:text-foreground/80 text-right">
                              {hasPrice ? `₱ ${item.price!.toLocaleString()}` : <span className="text-gray-300 dark:text-gray-600">N/A</span>}
                            </p>
                            <p className="text-[13px] font-semibold text-gray-800 dark:text-foreground text-right">
                              {subtotal !== null ? `₱ ${subtotal.toLocaleString()}` : <span className="text-gray-300 dark:text-gray-600">N/A</span>}
                            </p>
                          </div>
                        )
                      })}
                         {/* Total Row */}
<div className="grid grid-cols-[3fr_1fr_1fr_1fr] gap-4 px-6 py-4 bg-gray-50/80 dark:bg-secondary/30 border-t-2 border-gray-200 dark:border-border font-bold">
  
  {/* Empty */}
  <div></div>
  <div></div>

  {/* Label */}
  <div className="text-right text-gray-700 dark:text-foreground uppercase text-sm">
    Total
  </div>

  {/* Value */}
  <div className="text-right text-[#2787b4] text-lg font-extrabold">
  ₱ {totalAmount.toLocaleString()}
</div>

</div>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center text-gray-400">
                    <FileText className="h-8 w-8 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">No items found in this order</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Minor Actions (Cancel / Revert) - Placed below items to keep main CTA completely focused */}
            <div className="flex justify-start gap-3">
               {isSales && !isReadOnly && order.status === "pending" && (
                  <Button
                    variant="outline"
                    onClick={() => setConfirmAction("cancelled")}
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30 rounded-xl px-5"
                  >
                    Cancel Order
                  </Button>
               )}
               {isSales && !isReadOnly && order.status === "cancelled" && (
                  <Button
                    onClick={() => setConfirmAction("pending")}
                    variant="outline"
                    className="border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 rounded-xl px-5"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Revert to Pending
                  </Button>
               )}
            </div>

          </div>

          {/* RIGHT: Action & Summary Panel (Sticky) */}
          <div className="w-full xl:w-[420px] shrink-0 space-y-6 xl:sticky xl:top-6">
            
            {/* Status Card */}
            <Card className="rounded-2xl border border-gray-100 dark:border-border shadow-sm bg-white dark:bg-card">
              <CardContent className="p-6 flex items-center justify-between">
                <span className="text-[13px] font-bold text-gray-400 uppercase tracking-widest">Current Status</span>
                <StatusBadge status={order.status} />
              </CardContent>
            </Card>

            {/* Sales Documents Input */}
            <Card className="rounded-2xl border-2 border-blue-50 dark:border-blue-900/30 shadow-sm bg-white dark:bg-card overflow-hidden">
              <div className="bg-blue-50/50 dark:bg-blue-950/20 px-6 py-4 border-b border-blue-50 dark:border-blue-900/30">
                 <h3 className="text-sm font-bold text-blue-900 dark:text-blue-400 flex items-center gap-2">
                   <FileText className="h-4 w-4" /> Required Documentation
                 </h3>
                 <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1 font-medium">Both fields are required before confirming</p>
              </div>
              <CardContent className="p-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Sales Invoice No.</label>
                  <Input 
                    placeholder="e.g. INV-2023-001" 
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    onBlur={(e) => handleFieldBlur("salesInvoiceNo", e.target.value)}
                    readOnly={isReadOnly || !isSales || order.status !== "pending"}
                    className="h-11 rounded-xl bg-gray-50/50 dark:bg-secondary focus-visible:ring-blue-500 border-gray-200 dark:border-border font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Delivery Receipt No.</label>
                  <Input 
                    placeholder="e.g. DR-2023-094" 
                    value={receiptNo}
                    onChange={(e) => setReceiptNo(e.target.value)}
                    onBlur={(e) => handleFieldBlur("deliveryReceiptNo", e.target.value)}
                    readOnly={isReadOnly || !isSales || order.status !== "pending"}
                    className="h-11 rounded-xl bg-gray-50/50 dark:bg-secondary focus-visible:ring-blue-500 border-gray-200 dark:border-border font-medium"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Order Summary & Primary Action */}
            <Card className="rounded-2xl border border-gray-100 dark:border-border shadow-lg shadow-sky-500/5 bg-white dark:bg-card overflow-hidden">
              <CardHeader className="px-6 pt-6 pb-4">
                <CardTitle className="text-base font-bold">Date of Order </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="px-6 pb-6 space-y-4">
                  <div className="flex justify-between items-center text-sm pt-4 mt-2 border-t border-gray-100 dark:border-border">
                    <span className="text-gray-500 dark:text-gray-400">Date Placed</span>
                    <span className="font-medium text-gray-900 dark:text-foreground">{formatDate(order.createdAt)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Time Placed</span>
                    <span className="font-medium text-gray-900 dark:text-foreground">{formatTime(order.createdAt)}</span>
                  </div>
               
                </div>

                {isSales && !isReadOnly && order.status === "pending" && (
                  <div className="p-4 bg-gray-50 dark:bg-secondary/30 border-t border-gray-100 dark:border-border">
                    <Button
                      onClick={handleConfirmAndSend}
                      disabled={updating || !invoiceNo.trim() || !receiptNo.trim()}
                      className={`w-full h-12 text-[15px] font-bold rounded-xl shadow-md transition-all duration-300 ${
                        (!invoiceNo.trim() || !receiptNo.trim() || updating) 
                        ? "bg-gray-200 text-gray-400 dark:bg-secondary dark:text-muted-foreground shadow-none" 
                        : "bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white shadow-blue-500/20 hover:shadow-blue-500/40"
                      }`}
                    >
                      {updating ? "Processing..." : "Confirm & Send to Encoder"}
                    </Button>
                  </div>
                )}
                
                {/* Visual marker if already processed */}
                {order.status !== "pending" && order.status !== "cancelled" && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-100 dark:border-blue-900/30 text-center">
                    <p className="text-sm font-bold text-blue-700 dark:text-blue-400 flex items-center justify-center gap-2">
                       <CheckCircle2 className="h-4 w-4" /> This order has been processed
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Fallback actions (Cancel/Revert) */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent className="sm:max-w-[400px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">
              {confirmAction === "cancelled" && "Cancel Order"}
              {confirmAction === "pending" && "Revert to Pending"}
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2 text-[15px] leading-relaxed text-gray-500">
              {confirmAction === "cancelled" && "Are you sure you want to cancel this order? This action can be undone."}
              {confirmAction === "pending" && "This will reopen the order as pending and remove any finalized states."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-xl font-semibold border-gray-200 h-11 px-6">Go Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleOtherStatusChange}
              disabled={updating}
              className={`rounded-xl font-bold h-11 px-6 ${
                confirmAction === "cancelled" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-amber-600 hover:bg-amber-700 text-white"
              }`}
            >
              {updating ? "Updating..." : "Yes, Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
