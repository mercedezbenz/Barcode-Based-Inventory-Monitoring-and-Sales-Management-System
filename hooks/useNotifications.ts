import { useState, useEffect } from "react"
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, limit } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase-live"

export interface Notification {
  id: string
  title: string
  message: string
  targetRole: string
  userId?: string | null
  type: "ORDER" | "STOCK" | "SYSTEM" | "order" | "new_order"
  isRead: boolean
  createdAt: any
}

export function useNotifications(userRole?: string) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userRole) {
      setNotifications([])
      setLoading(false)
      return
    }

    console.log(`[useNotifications] 🔔 Subscribing for role: "${userRole}"`)

    const db = getFirebaseDb()
    const notificationsRef = collection(db, "notifications")

    // Strictly fetch ONLY this role's notifications
    // Note: If you get an error here about a missing index, click the link in the console to create it.
    const q = query(
      notificationsRef,
      where("targetRole", "==", userRole.toLowerCase()),
      orderBy("createdAt", "desc"),
      limit(30)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allNotifs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Notification[]

      console.log(`[useNotifications] 📥 Received ${allNotifs.length} notifications for ${userRole}`)

      // SECONDARY FAILSAFE FILTER: Hard-block any role leakage
      const roleFiltered = allNotifs.filter((n) => {
        const matchesRole = n.targetRole?.toLowerCase() === userRole.toLowerCase()
        
        // SALES-SPECIFIC FILTER: Only show "New Order" notifications
        if (userRole.toLowerCase() === "sales") {
          const titleLower = n.title?.toLowerCase() || ""
          const typeLower = n.type?.toLowerCase() || ""
          
          // Must be a New Order notification
          // Specifically exclude "Ready for Processing" which is an encoder task notification
          return matchesRole && (
            (typeLower === "new_order" || titleLower.includes("new order")) && 
            !titleLower.includes("ready for processing")
          )
        }
        
        return matchesRole
      })

      // LEAKAGE DETECTOR: Log if query returned incorrect roles
      if (roleFiltered.length < allNotifs.length) {
        const leaked = allNotifs.filter(n => n.targetRole?.toLowerCase() !== userRole.toLowerCase())
        console.warn(`[useNotifications] 🚨 ROLE LEAKAGE DETECTED! Found ${allNotifs.length - roleFiltered.length} items for other roles:`, leaked.map(l => l.targetRole))
      }

      setLoading(false)

      // Deduplicate by orderId to prevent redundant UI entries
      const uniqueNotifsMap = new Map<string, Notification>()
      roleFiltered.forEach((n: any) => {
        const key = n.orderId || n.id
        if (!uniqueNotifsMap.has(key)) {
          uniqueNotifsMap.set(key, n)
        }
      })
      const uniqueNotifs = Array.from(uniqueNotifsMap.values())

      setNotifications(uniqueNotifs)
    }, (error) => {
      console.error(`[useNotifications] ❌ Error fetching notifications:`, error)
      // If index is missing or permissions fail, set empty to avoid crash
      setNotifications([])
      setLoading(false)
    })

    return () => unsubscribe()
  }, [userRole])

  const markAsRead = async (notificationId: string) => {
    try {
      const db = getFirebaseDb()
      await updateDoc(doc(db, "notifications", notificationId), {
        isRead: true,
      })
    } catch (e) {
      console.error("[useNotifications] Failed to mark as read:", e)
    }
  }

  const markAllAsRead = async () => {
    try {
      const db = getFirebaseDb()
      const unread = notifications.filter((n) => !n.isRead)
      const updates = unread.map((n) =>
        updateDoc(doc(db, "notifications", n.id), { isRead: true })
      )
      await Promise.all(updates)
    } catch (e) {
      console.error("[useNotifications] Failed to mark all as read:", e)
    }
  }

  return { notifications, loading, markAsRead, markAllAsRead }
}
