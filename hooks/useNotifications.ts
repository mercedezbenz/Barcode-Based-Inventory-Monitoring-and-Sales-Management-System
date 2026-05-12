import { useState, useEffect, useRef } from "react"
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, limit } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase-live"

export interface Notification {
  id: string
  title: string
  message: string
  targetRole: string
  userId?: string | null
  recipientUid?: string | null
  recipientEmail?: string | null
  type: "ORDER" | "STOCK" | "SYSTEM" | "order" | "new_order"
  isRead: boolean
  createdAt: any
}

/**
 * useNotifications hook
 * 
 * Fetches notifications scoped to the current user:
 * - For encoder role: filters by recipientUid (user-specific notifications)
 * - For other roles: filters by targetRole (role-level notifications)
 * 
 * This ensures each encoder user only sees their own notifications,
 * preventing cross-user notification leakage.
 */
export function useNotifications(userRole?: string, userUid?: string) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const prevIdentity = useRef<string>("")

  useEffect(() => {
    if (!userRole) {
      setNotifications([])
      setLoading(false)
      return
    }

    const normalizedRole = userRole.toLowerCase().trim()

    // Reset notifications immediately when user identity changes
    const currentIdentity = `${normalizedRole}:${userUid || "none"}`
    if (prevIdentity.current && prevIdentity.current !== currentIdentity) {
      console.log(`[useNotifications] 🔄 Identity changed from ${prevIdentity.current} → ${currentIdentity}, clearing stale notifications`)
      setNotifications([])
      setLoading(true)
    }
    prevIdentity.current = currentIdentity

    console.log(`[useNotifications] 🔔 Subscribing for role: "${normalizedRole}", uid: "${userUid || "N/A"}"`)

    const db = getFirebaseDb()
    const notificationsRef = collection(db, "notifications")

    let q;

    // For encoder role, use user-specific filtering via recipientUid
    if (normalizedRole === "encoder" && userUid) {
      q = query(
        notificationsRef,
        where("targetRole", "==", "encoder"),
        where("recipientUid", "==", userUid),
        orderBy("createdAt", "desc"),
        limit(30)
      )
    } else {
      // For other roles, keep role-level filtering
      q = query(
        notificationsRef,
        where("targetRole", "==", normalizedRole),
        orderBy("createdAt", "desc"),
        limit(30)
      )
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allNotifs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Notification[]

      console.log(`[useNotifications] 📥 Received ${allNotifs.length} notifications for ${normalizedRole}${userUid ? ` (uid: ${userUid})` : ""}`)

      // SECONDARY FAILSAFE FILTER: Hard-block any role leakage
      const roleFiltered = allNotifs.filter((n) => {
        const matchesRole = n.targetRole?.toLowerCase() === normalizedRole
        
        // For encoder, also verify recipientUid matches current user
        if (normalizedRole === "encoder" && userUid) {
          const matchesUser = n.recipientUid === userUid
          if (!matchesUser) {
            console.warn(`[useNotifications] 🚨 ENCODER USER LEAKAGE: Notification ${n.id} has recipientUid=${n.recipientUid} but current user is ${userUid}`)
            return false
          }
        }
        
        // SALES-SPECIFIC FILTER: Only show "New Order" notifications
        if (normalizedRole === "sales") {
          const titleLower = n.title?.toLowerCase() || ""
          const typeLower = n.type?.toLowerCase() || ""
          
          return matchesRole && (
            (typeLower === "new_order" || titleLower.includes("new order")) && 
            !titleLower.includes("ready for processing")
          )
        }
        
        return matchesRole
      })

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
      
      if (error.code === "failed-precondition" && normalizedRole === "encoder" && userUid) {
        const fallbackQ = query(
          notificationsRef,
          where("targetRole", "==", "encoder"),
          orderBy("createdAt", "desc"),
          limit(30)
        )
        
        const fallbackUnsub = onSnapshot(fallbackQ, (snapshot) => {
          const allNotifs = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as Notification[]
          
          const userFiltered = allNotifs.filter((n: any) => n.recipientUid === userUid)
          
          const uniqueNotifsMap = new Map<string, Notification>()
          userFiltered.forEach((n: any) => {
            const key = n.orderId || n.id
            if (!uniqueNotifsMap.has(key)) {
              uniqueNotifsMap.set(key, n)
            }
          })
          
          setNotifications(Array.from(uniqueNotifsMap.values()))
          setLoading(false)
        }, (fallbackError) => {
          console.error("[useNotifications] ❌ Fallback query also failed:", fallbackError)
          setNotifications([])
          setLoading(false)
        })
        
        return () => fallbackUnsub()
      }
      
      setNotifications([])
      setLoading(false)
    })

    return () => unsubscribe()
  }, [userRole, userUid])

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
