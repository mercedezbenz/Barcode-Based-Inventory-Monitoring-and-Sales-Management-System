"use client"

import { useEffect, useState } from "react"
import { getFirebaseDb } from "@/lib/firebase-live"
import {
  collection as fbCollection,
  onSnapshot as fbOnSnapshot,
  query as fbQuery,
  where as fbWhere,
  doc as fbDoc,
  getDoc as fbGetDoc,
  getDocs as fbGetDocs,
} from "firebase/firestore"

export interface OrderItem {
  id?: string
  productId?: string
  name: string
  quantity: number
  unit?: string
  imageUrl?: string
  price?: number // ✅ ADD THIS
}

export interface ShippingAddress {
  fullName: string
  phoneNumber: string
  street?: string
  barangay?: string
  city?: string
  province?: string
  postalCode?: string
}

export interface Order {
  id: string
  customerName: string
  customerPhone: string
  customerAddress: string
  shippingAddress: ShippingAddress
  items: OrderItem[]
  status: "pending" | "ready_for_processing" | "processing" | "ready_for_delivery" | "completed" | "delivered" | "cancelled"
  salesInvoiceNo?: string
  deliveryReceiptNo?: string
  isInvoiceConfirmed?: boolean
  createdAt: Date | any
  userId?: string
}

/**
 * Parse a Firestore timestamp into a JS Date for sorting.
 */
function parseTimestamp(ts: any): Date {
  if (!ts) return new Date(0)
  if (ts instanceof Date) return ts
  if (typeof ts === "string") return new Date(ts)
  if (ts?.toDate) return ts.toDate()
  if (ts?.seconds) return new Date(ts.seconds * 1000)
  return new Date(0)
}

function mapDocToOrder(docId: string, d: any): Order {
  if (!d) return { id: docId } as Order; // Extreme fallback
  
  const shipping = d.shippingAddress || d.shipping || {};
  const userFallback = d.user || d.customer || {};
  
  // Ensure items is always an array
  let rawItems = [];
  if (Array.isArray(d.items)) {
    rawItems = d.items;
  } else if (d.items && typeof d.items === "object") {
    rawItems = Object.values(d.items);
  }

  // Update items to include unit
  const items: OrderItem[] = rawItems.map((p: any) => ({
  ...(typeof p === "object" && p !== null ? p : {}),
  id: p?.id || p?.productId || "",
  productId: p?.productId || p?.id || "",
  name: p?.name || p?.productName || p?.title || "Unnamed",
  quantity: Number(p?.quantity ?? p?.qty ?? p?.count ?? 1) || 1,
  unit: p?.unit || "unit",
  imageUrl: p?.imageUrl || p?.image || "",
  price: Number(p?.price ?? 0) 
}))

  const getAddress = () => {
    // 1. Check for the new shippingAddress schema
    const newSchemaParts = [
      shipping.address, // Sometimes legacy address is here
      shipping.barangay,
      shipping.city,
      shipping.province,
      shipping.zipCode
    ].filter(Boolean);

    if (newSchemaParts.length > 0) {
      // Remove duplicates if barangay and address are exactly the same
      return Array.from(new Set(newSchemaParts)).join(", ");
    }
    
    // 2. Fallbacks for old orders
    return d.customerAddress || d.address || userFallback.address || "";
  }

  return {
    id: docId,
    // Try multiple possible locations for customer info
    customerName: shipping.fullName || d.customerName || d.fullName || d.name || userFallback.name || userFallback.fullName || "Unknown",
    customerPhone: shipping.phone || shipping.phoneNumber || d.customerPhone || d.phone || d.phoneNumber || userFallback.phone || "N/A",
    customerAddress: getAddress(),
    shippingAddress: {
  fullName: shipping.fullName || d.customerName || d.fullName || d.name || "Unknown",
  phoneNumber: shipping.phone || shipping.phoneNumber || d.customerPhone || d.phone || "N/A",

  street: shipping.street || "",
  barangay: shipping.barangay || "",
  city: shipping.city || "",
  province: shipping.province || "",
  postalCode: shipping.postalCode || shipping.zipCode || "",
},
    items,
    // Normalize status to lowercase, fallback to pending
    status: (d.status ? String(d.status).toLowerCase().replace(/\s+/g, '_') : "pending") as Order["status"],
    salesInvoiceNo: d.salesInvoiceNo || d.invoiceNo || "",
    deliveryReceiptNo: d.deliveryReceiptNo || d.receiptNo || "",
    isInvoiceConfirmed: Boolean(d.isInvoiceConfirmed || d.confirmed),
    createdAt: d.createdAt || d.timestamp || d.date || null,
    userId: d.userId || d.customerId || d.uid || userFallback.id || "",
  }
}

/**
 * Custom hook that subscribes to the `orders` Firestore collection
 * in real-time using `onSnapshot`.
 *
 * IMPORTANT: We do NOT use orderBy() to avoid requiring a Firestore index
 * and to ensure documents without a createdAt field are not silently excluded.
 * Sorting is done client-side instead.
 *
 * Returns:
 *  - orders: Order[]   — all orders, newest first
 *  - loading: boolean  — true while the initial snapshot is loading
 */
export function useOrders(filterStatus?: "pending" | "ready_for_processing" | "processing" | "ready_for_delivery" | "completed" | "delivered" | "cancelled") {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    console.log("[useOrders] Initializing Firestore subscription...")

    try {
      const db = getFirebaseDb()

      if (!db) {
        console.error("[useOrders] Firebase DB is null/undefined — Firebase not initialized yet")
        setOrders([])
        setLoading(false)
        return
      }

      // Subscribe to the "orders" collection
      const ordersRef = fbCollection(db, "orders")
      
      let q = ordersRef as any
      if (filterStatus) {
        console.log(`[useOrders] Filtering by status: ${filterStatus}`)
        q = fbQuery(ordersRef, fbWhere("status", "==", filterStatus))
      }

      console.log("[useOrders] Subscribing to 'orders' collection (no orderBy)...")

      unsubscribe = fbOnSnapshot(
        q,
        async (snapshot: any) => {
          console.log(`[useOrders] ✅ Snapshot received — ${snapshot.docs.length} documents`)

          // Log raw data for debugging
          if (snapshot.docs.length > 0) {
            console.log("[useOrders] First doc raw data:", JSON.stringify(snapshot.docs[0].data(), null, 2))
          } else {
            console.warn("[useOrders] ⚠️ Collection 'orders' is empty — no documents found")
          }

          const data: Order[] = snapshot.docs.map((doc: any) =>
            mapDocToOrder(doc.id, doc.data())
          )

          // Batch fetch products to get image URLs
          const productMap: Record<string, string> = {}
          try {
            const productsSnapshot = await fbGetDocs(fbCollection(db, "products"))
            productsSnapshot.forEach(doc => {
              productMap[doc.id] = doc.data().imageUrl || ""
            })
          } catch (err) {
            console.error("[useOrders] Error fetching products for images:", err)
          }

          // Step 1: Fetch phone numbers from users collection if missing and attach images
          const resolvedData = await Promise.all(data.map(async (order) => {
            // Attach images to items
            const itemsWithImages = order.items.map(item => ({
              ...item,
              imageUrl: productMap[item.id || item.productId || ""] || ""
            }))
            
            const processedOrder = { ...order, items: itemsWithImages }

            // Fetch missing user data (phone, address) from users collection if userId exists
            if (processedOrder.userId && (!processedOrder.customerPhone || processedOrder.customerPhone === "N/A" || !processedOrder.customerAddress)) {
              try {
                const userDoc = await fbGetDoc(fbDoc(db, "users", processedOrder.userId))
                if (userDoc.exists()) {
                  const userData = userDoc.data()
                  return {
                    ...processedOrder,
                    customerPhone: (!processedOrder.customerPhone || processedOrder.customerPhone === "N/A") ? (userData.phoneNumber || "") : processedOrder.customerPhone,
                    customerAddress: !processedOrder.customerAddress ? (userData.address || "") : processedOrder.customerAddress
                  }
                }
              } catch (err) {
                console.error(`[useOrders] Error fetching user data for ${processedOrder.userId}:`, err)
              }
            }
            return processedOrder
          }))

          // Sort client-side: newest first by createdAt
          resolvedData.sort((a, b) => {
            const dateA = parseTimestamp(a.createdAt)
            const dateB = parseTimestamp(b.createdAt)
            return dateB.getTime() - dateA.getTime()
          })

          console.log(`[useOrders] Mapped ${resolvedData.length} orders with phone resolution`)

          setOrders(resolvedData)
          setLoading(false)
        },
        (error: any) => {
          console.error("[useOrders] ❌ Snapshot error:", error)
          console.error("[useOrders] Error code:", (error as any)?.code)
          console.error("[useOrders] Error message:", (error as any)?.message)
          setOrders([])
          setLoading(false)
        }
      )
    } catch (error) {
      console.error("[useOrders] ❌ Failed to initialize subscription:", error)
      setOrders([])
      setLoading(false)
    }

    return () => {
      console.log("[useOrders] Unsubscribing from orders collection")
      unsubscribe?.()
    }
  }, [])

  return { orders, loading }
}

export { mapDocToOrder }
