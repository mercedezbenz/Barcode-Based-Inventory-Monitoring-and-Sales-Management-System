import { doc, serverTimestamp, runTransaction, updateDoc, getDoc } from "firebase/firestore"
import { getFirebaseDb } from "./firebase-live"

/**
 * updateOrderStatus
 * 
 * Updates the order status in the `orders` collection with flow-guard protection.
 * Prevents status downgrades within the normal flow.
 * Logs errors clearly instead of failing silently.
 */
export const updateOrderStatus = async (orderId: string, newStatus: string) => {
  if (!orderId) {
    console.error("[updateOrderStatus] ❌ Called with empty/null orderId — aborting")
    return
  }

  const db = getFirebaseDb()
  if (!db) {
    console.error("[updateOrderStatus] ❌ Firebase DB not initialized — aborting")
    return
  }

  const ref = doc(db, "orders", orderId)

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists()) {
        console.error(`[updateOrderStatus] ❌ Order document "orders/${orderId}" does NOT exist in Firestore! Cannot update status to "${newStatus}".`)
        console.error(`[updateOrderStatus] This means the orderId on the encoder task does not match any document in the orders collection.`)
        return
      }

      const current = snap.data().status || "pending"

      // Comprehensive flow covering ALL known statuses
      const flow = [
        "pending",
        "ready_for_processing",
        "processing",
        "in_production",
        "for_verification",
        "in_transit",
        "for_delivery",
        "ready_for_delivery",
        "out_for_delivery",
        "on_delivery",
        "delivered",
        "completed",
      ]

      // Normalize both statuses for comparison
      const currentNorm = current.toLowerCase().replace(/[\s\-]+/g, "_")
      const newNorm = newStatus.toLowerCase().replace(/[\s\-]+/g, "_")

      const currentIndex = flow.indexOf(currentNorm)
      const newIndex = flow.indexOf(newNorm)

      // Log for debugging
      console.log(`[updateOrderStatus] Order: ${orderId}`)
      console.log(`[updateOrderStatus] Current status: "${current}" (normalized: "${currentNorm}", index: ${currentIndex})`)
      console.log(`[updateOrderStatus] New status: "${newStatus}" (normalized: "${newNorm}", index: ${newIndex})`)

      // Prevent downgrade only if both statuses are in the flow
      if (newIndex !== -1 && currentIndex !== -1 && newIndex < currentIndex) {
        console.warn(`[updateOrderStatus] ⚠️ Downgrade blocked: "${current}" → "${newStatus}"`)
        return
      }

      tx.update(ref, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      })

      console.log(`[updateOrderStatus] ✅ Successfully queued update: "${current}" → "${newStatus}"`)
    })
  } catch (error: any) {
    console.error(`[updateOrderStatus] ❌ Transaction failed for order "${orderId}":`, error?.message || error)
    throw error // Re-throw so callers know it failed
  }
}

// ===========================================================
// DUAL-STATUS MAPPING ARCHITECTURE
// ===========================================================
//
// Encoder Status → Customer Status (orders.status) → Sales Status (orders.salesStatus)
//
// PENDING           → pending            → pending
// FOR_VERIFICATION  → in_production      → pending
// FOR_DELIVERY      → in_production      → pending    ← stock prepared, NOT in transit yet
// ON_DELIVERY       → in_transit         → on_delivery ← delivery actually started
// COMPLETED         → delivered          → completed
//
// BUSINESS RULE: Barcode scanning = stock preparation only.
// Only "Mark as On Delivery" triggers transit status.
//
// Customer status (orders.status): detailed tracking for customer-facing pages
// Sales status (orders.salesStatus): simplified for Sales Dashboard, Reports, Owner Dashboard
// ===========================================================

interface DualStatusMapping {
  customerStatus: string
  salesStatus: string
}

const ENCODER_TO_DUAL_STATUS: Record<string, DualStatusMapping> = {
  // PENDING → customer sees "pending", sales sees "pending"
  pending: {
    customerStatus: "pending",
    salesStatus: "pending",
  },
  ready_for_processing: {
    customerStatus: "pending",
    salesStatus: "pending",
  },
  processing: {
    customerStatus: "pending",
    salesStatus: "pending",
  },

  // FOR_VERIFICATION → customer sees "in_production", sales sees "pending"
  for_verification: {
    customerStatus: "in_production",
    salesStatus: "pending",
  },

  // FOR_DELIVERY → customer sees "in_production", sales sees "pending"
  // Stock is prepared/scanned but NOT yet dispatched for delivery
  for_delivery: {
    customerStatus: "in_production",
    salesStatus: "pending",
  },
  ready_for_delivery: {
    customerStatus: "in_production",
    salesStatus: "pending",
  },

  // ON_DELIVERY → customer sees "in_transit", sales sees "on_delivery"
  // Encoder explicitly clicked "Mark as On Delivery" — delivery has started
  on_delivery: {
    customerStatus: "in_transit",
    salesStatus: "on_delivery",
  },
  out_for_delivery: {
    customerStatus: "in_transit",
    salesStatus: "on_delivery",
  },

  // COMPLETED → customer sees "delivered", sales sees "completed"
  completed: {
    customerStatus: "delivered",
    salesStatus: "completed",
  },
  delivered: {
    customerStatus: "delivered",
    salesStatus: "completed",
  },

  // CANCELLED
  cancelled: {
    customerStatus: "cancelled",
    salesStatus: "cancelled",
  },
}

/**
 * Resolve encoder status to the dual-status mapping.
 * Returns both customerStatus and salesStatus.
 */
function resolveDualStatus(encoderStatus: string): DualStatusMapping {
  const normalized = encoderStatus.trim().toLowerCase().replace(/[\s\-]+/g, "_")
  return ENCODER_TO_DUAL_STATUS[normalized] ?? {
    customerStatus: normalized,
    salesStatus: "pending",
  }
}

/**
 * syncEncoderStatusToOrder
 * 
 * CRITICAL synchronization function that updates the `orders` collection
 * whenever an encoder task status changes.
 * 
 * DUAL-STATUS ARCHITECTURE:
 *   - Writes `status` (customer tracking status) for customer-facing pages
 *   - Writes `salesStatus` (simplified status) for Sales Dashboard, Reports, Owner Dashboard
 * 
 * Strategy:
 *   1. Try direct document lookup: orders/{orderId}
 *   2. If not found, query orders collection where orderId field matches
 *   3. Writes BOTH status fields atomically
 *   4. Always includes updatedAt timestamp
 *   5. Comprehensive logging for debugging
 */
export const syncEncoderStatusToOrder = async (
  orderId: string,
  newStatus: string,
  additionalFields?: Record<string, any>
): Promise<boolean> => {
  console.log(`[syncEncoderStatusToOrder] 🔄 Called with orderId="${orderId}", encoderStatus="${newStatus}"`)
  
  if (!orderId) {
    console.error("[syncEncoderStatusToOrder] ❌ Called with empty/null orderId — cannot sync to orders collection")
    return false
  }

  const db = getFirebaseDb()
  if (!db) {
    console.error("[syncEncoderStatusToOrder] ❌ Firebase DB not initialized")
    return false
  }

  // Resolve dual-status mapping
  const { customerStatus, salesStatus } = resolveDualStatus(newStatus)
  console.log(`[syncEncoderStatusToOrder] 📋 Encoder "${newStatus}" → Customer: "${customerStatus}" | Sales: "${salesStatus}"`)

  // Build the update payload
  const updatePayload: Record<string, any> = {
    status: customerStatus,        // Customer tracking status
    salesStatus: salesStatus,      // Sales/analytics status
    updatedAt: serverTimestamp(),
  }

  // Add completion timestamps for completed/delivered status
  if (salesStatus === "completed") {
    updatePayload.completedAt = serverTimestamp()
    updatePayload.deliveredAt = serverTimestamp()
  }

  // Add on-delivery timestamp
  if (salesStatus === "on_delivery") {
    updatePayload.onDeliveryAt = serverTimestamp()
  }

  // Merge any additional fields (but skip keys we already set)
  if (additionalFields) {
    for (const [key, value] of Object.entries(additionalFields)) {
      if (key === "status" || key === "salesStatus" || key === "updatedAt" || key === "completedAt") continue
      updatePayload[key] = value
    }
  }

  // ─── STRATEGY 1: Direct document lookup ─────────────────────────────
  const ref = doc(db, "orders", orderId)

  try {
    const snap = await getDoc(ref)
    
    if (snap.exists()) {
      const data = snap.data()
      const prevCustomer = data.status || "unknown"
      const prevSales = data.salesStatus || "unknown"
      console.log(`[syncEncoderStatusToOrder] ✅ Found order document: orders/${orderId}`)
      console.log(`[syncEncoderStatusToOrder] 📊 Customer: "${prevCustomer}" → "${customerStatus}" | Sales: "${prevSales}" → "${salesStatus}"`)
      
      await updateDoc(ref, updatePayload)
      
      console.log(`[syncEncoderStatusToOrder] ✅ SUCCESS — Order "${orderId}" dual-status updated`)
      console.log(`[syncEncoderStatusToOrder] 📦 Sales Dashboard + Customer Tracking should now reflect this change in real-time`)
      return true
    }
    
    console.warn(`[syncEncoderStatusToOrder] ⚠️ Direct lookup failed — orders/${orderId} does not exist`)
    console.log(`[syncEncoderStatusToOrder] 🔍 Trying query-based fallback...`)
  } catch (error: any) {
    console.error(`[syncEncoderStatusToOrder] ❌ Direct lookup/update failed for orders/${orderId}:`, error?.message || error)
  }

  // ─── STRATEGY 2: Query-based fallback ───────────────────────────────
  try {
    const { collection: fbCollection, query: fbQuery, where: fbWhere, getDocs: fbGetDocs } = await import("firebase/firestore")
    const ordersRef = fbCollection(db, "orders")
    const q = fbQuery(ordersRef, fbWhere("orderId", "==", orderId))
    const querySnap = await fbGetDocs(q)
    
    if (!querySnap.empty) {
      const matchedDoc = querySnap.docs[0]
      const data = matchedDoc.data()
      const prevCustomer = data.status || "unknown"
      const prevSales = data.salesStatus || "unknown"
      console.log(`[syncEncoderStatusToOrder] ✅ Found order via query: orders/${matchedDoc.id} (orderId field = "${orderId}")`)
      
      await updateDoc(doc(db, "orders", matchedDoc.id), updatePayload)
      
      console.log(`[syncEncoderStatusToOrder] ✅ SUCCESS (via query) — Order "${matchedDoc.id}" dual-status updated: Customer "${prevCustomer}" → "${customerStatus}" | Sales "${prevSales}" → "${salesStatus}"`)
      return true
    }
    
    console.error(`[syncEncoderStatusToOrder] ❌ CRITICAL: Order document NOT FOUND by any strategy!`)
    console.error(`[syncEncoderStatusToOrder] ❌ Tried: direct lookup orders/${orderId}, query where orderId=="${orderId}"`)
    console.error(`[syncEncoderStatusToOrder] ❌ The Sales Dashboard will NOT reflect this status change.`)
    return false
  } catch (error: any) {
    console.error(`[syncEncoderStatusToOrder] ❌ Query fallback failed:`, error?.message || error)
    return false
  }
}

// ─── Fallback Helper ──────────────────────────────────────────────────────────

/**
 * deriveSalesStatus
 * 
 * Derives the salesStatus from the customer-facing status field.
 * Used as a FALLBACK when orders don't have a salesStatus field yet
 * (backward compatibility for orders created before the dual-status upgrade).
 */
export function deriveSalesStatus(customerStatus: string | undefined | null): string {
  if (!customerStatus) return "pending"
  
  const normalized = customerStatus.trim().toLowerCase().replace(/[\s\-]+/g, "_")
  
  switch (normalized) {
    case "delivered":
    case "completed":
      return "completed"
    case "out_for_delivery":
    case "on_delivery":
      return "on_delivery"
    case "cancelled":
      return "cancelled"
    default:
      return "pending"
  }
}
