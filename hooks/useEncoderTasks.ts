"use client"

import { useEffect, useState } from "react"
import { getFirebaseDb } from "@/lib/firebase-live"
import { auth } from "@/lib/firebase-live"
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy
} from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"

export interface EncoderTask {
  id: string
  orderId: string
  customerName: string
  customerEmail: string
  items: any[]
  totalAmount: number
  salesInvoiceNumber?: string
  salesInvoiceNo?: string
  deliveryReceiptNumber?: string
  deliveryReceiptNo?: string
  status: string
  encoderStatus?: "pending" | "verification" | "completed"
  selectedStocks?: any[]
  createdAt: any
}

export function useEncoderTasks(status?: string | string[]) {
  const [tasks, setTasks] = useState<EncoderTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined
    let unsubscribeAuth: (() => void) | undefined

    console.log("[useEncoderTasks] Initializing — waiting for auth state...")

    try {
      const firebaseAuth = auth
      if (!firebaseAuth) {
        console.error("[useEncoderTasks] Firebase Auth not initialized yet")
        setLoading(false)
        return
      }

      // Wait for the user to be authenticated before subscribing to encoder_tasks
      unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
        // Clean up any previous snapshot listener when auth state changes
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot()
          unsubscribeSnapshot = undefined
        }

        if (!user) {
          console.warn("[useEncoderTasks] No authenticated user — cannot fetch encoder_tasks")
          setTasks([])
          setLoading(false)
          return
        }

        console.log(`[useEncoderTasks] Auth ready (uid: ${user.uid}) — subscribing to encoder_tasks collection`)
        
        try {
          const db = getFirebaseDb()
          if (!db) {
            console.error("[useEncoderTasks] Firebase DB is null/undefined")
            setTasks([])
            setLoading(false)
            return
          }

          const tasksRef = collection(db, "encoder_tasks")

          let qWithOrder = tasksRef as any
          let qFallback = tasksRef as any

          if (status) {
            console.log(`[useEncoderTasks] Setting up query for status: "${status}"`)
            if (Array.isArray(status)) {
              qWithOrder = query(tasksRef, where("status", "in", status), orderBy("createdAt", "desc"))
              qFallback = query(tasksRef, where("status", "in", status))
            } else {
              qWithOrder = query(tasksRef, where("status", "==", status), orderBy("createdAt", "desc"))
              qFallback = query(tasksRef, where("status", "==", status))
            }
          } else {
            qWithOrder = query(tasksRef, orderBy("createdAt", "desc"))
            qFallback = tasksRef
          }

          // Function to set up the onSnapshot listener
          const setupListener = (useFallback = false) => {
            const activeQuery = useFallback ? qFallback : qWithOrder;
            
            return onSnapshot(
              activeQuery,
              (snapshot: any) => {
                console.log("Snapshot size:", snapshot.size)
                
                const data: EncoderTask[] = snapshot.docs.map((doc: any) => {
                  const docData = doc.data()
                  console.log("Doc data:", docData)
                  return {
                    id: doc.id,
                    ...docData
                  } as EncoderTask
                })

                // If using fallback, we must sort client-side because the query didn't sort
                if (useFallback) {
                  data.sort((a, b) => {
                    const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0
                    const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0
                    return timeB - timeA
                  })
                }

                setTasks(data)
                setLoading(false)
              },
              (error: any) => {
                // If it's an index error, automatically fallback
                if (!useFallback && (error.code === "failed-precondition" || error?.message?.includes("index"))) {
                  console.warn("⚠️ Firestore Composite Index Missing!")
                  console.warn("Error message (CLICK URL TO CREATE INDEX):", error.message)
                  console.log("🔄 Falling back to query without orderBy...")
                  
                  // Setup fallback and overwrite unsubscribe handler
                  unsubscribeSnapshot = setupListener(true)
                } else {
                  console.error("[useEncoderTasks] ❌ Snapshot error:", error)
                  setTasks([])
                  setLoading(false)
                }
              }
            )
          }

          // Initialize with the standard (orderBy) query
          unsubscribeSnapshot = setupListener(false)

        } catch (err) {
          console.error("[useEncoderTasks] Failed to set up Firestore listener:", err)
          setTasks([])
          setLoading(false)
        }
      })
    } catch (err) {
      console.error("[useEncoderTasks] Hook initialization error:", err)
      setLoading(false)
    }

    return () => {
      console.log("[useEncoderTasks] Cleaning up listeners")
      unsubscribeSnapshot?.()
      unsubscribeAuth?.()
    }
  }, [status])

  return { tasks, loading }
}
