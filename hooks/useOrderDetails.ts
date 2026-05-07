"use client"

import { useEffect, useState } from "react"
import { getFirebaseDb } from "@/lib/firebase-live"
import {
  doc as fbDoc,
  onSnapshot as fbOnSnapshot,
  updateDoc as fbUpdateDoc,
} from "firebase/firestore"
import type { Order } from "./useOrders"
import { mapDocToOrder } from "./useOrders"

/**
 * Custom hook that subscribes to a single order document in real-time.
 *
 * Returns:
 *  - order: Order | null
 *  - loading: boolean
 *  - updateStatus: (newStatus) => Promise<void>
 */
export function useOrderDetails(orderId: string | null) {
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orderId) {
      setOrder(null)
      setLoading(false)
      return
    }

    let unsubscribe: (() => void) | undefined

    try {
      const db = getFirebaseDb()
      const docRef = fbDoc(db, "orders", orderId)

      unsubscribe = fbOnSnapshot(
        docRef,
        async (snapshot) => {
          if (snapshot.exists()) {
            const initialOrder = mapDocToOrder(snapshot.id, snapshot.data())
            
            // Batch fetch products to get image URLs (for just this order's items)
            const productIds = initialOrder.items.map(item => item.id || item.productId || "").filter(Boolean)
            const productMap: Record<string, string> = {}
            if (productIds.length > 0) {
              try {
                // To simplify, we could just fetch all or specific products, but for a single order, fetching all is fine or fetching specific ones
                const { getDocs, collection } = await import("firebase/firestore")
                const productsSnapshot = await getDocs(collection(db, "products"))
                productsSnapshot.forEach(doc => {
                  productMap[doc.id] = doc.data().imageUrl || ""
                })
              } catch (err) {
                console.error("[useOrderDetails] Error fetching products for images:", err)
              }
            }

            const itemsWithImages = initialOrder.items.map(item => ({
              ...item,
              imageUrl: productMap[item.id || item.productId || ""] || ""
            }))

            let resolvedOrder = { ...initialOrder, items: itemsWithImages }

            // Fetch missing user data (phone, address) from users collection if userId exists
            if (resolvedOrder.userId && (!resolvedOrder.customerPhone || resolvedOrder.customerPhone === "N/A" || !resolvedOrder.customerAddress)) {
              try {
                const { getDoc } = await import("firebase/firestore")
                const userDoc = await getDoc(fbDoc(db, "users", resolvedOrder.userId))
                if (userDoc.exists()) {
                  const userData = userDoc.data()
                  resolvedOrder = {
                    ...resolvedOrder,
                    customerPhone: (!resolvedOrder.customerPhone || resolvedOrder.customerPhone === "N/A") ? (userData.phoneNumber || "") : resolvedOrder.customerPhone,
                    customerAddress: !resolvedOrder.customerAddress ? (userData.address || "") : resolvedOrder.customerAddress
                  }
                }
              } catch (err) {
                console.error(`[useOrderDetails] Error fetching user data for ${resolvedOrder.userId}:`, err)
              }
            }
            
            setOrder(resolvedOrder)
          } else {
            setOrder(null)
          }
          setLoading(false)
        },
        (error) => {
          console.error("[useOrderDetails] Snapshot error:", error)
          setOrder(null)
          setLoading(false)
        }
      )
    } catch (error) {
      console.error("[useOrderDetails] Failed to initialize:", error)
      setOrder(null)
      setLoading(false)
    }

    return () => {
      unsubscribe?.()
    }
  }, [orderId])

  /** Update the order status in Firestore */
  const updateStatus = async (newStatus: "pending" | "ready_for_processing" | "processing" | "ready_for_delivery" | "completed" | "delivered" | "cancelled") => {
    if (!orderId) return
    try {
      const db = getFirebaseDb()
      const docRef = fbDoc(db, "orders", orderId)
      await fbUpdateDoc(docRef, { status: newStatus })
      console.log(`[useOrderDetails] Updated order ${orderId} status to ${newStatus}`)
    } catch (error) {
      console.error("[useOrderDetails] Failed to update status:", error)
      throw error
    }
  }

  return { order, loading, updateStatus }
}
