import { doc, serverTimestamp, runTransaction } from "firebase/firestore"
import { getFirebaseDb } from "./firebase-live"

export const updateOrderStatus = async (orderId: string, newStatus: string) => {
  const db = getFirebaseDb()
  const ref = doc(db, "orders", orderId)

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) return

    const current = snap.data().status || "pending"

    const flow = [
      "pending",
      "in_production",
      "in_transit",
      "out_for_delivery",
      "delivered",
    ]

    const currentIndex = flow.indexOf(current)
    const newIndex = flow.indexOf(newStatus)

    // Log for debugging as requested
    console.log("READ STATUS →", current)
    console.log("SETTING STATUS →", newStatus)

    // prevent downgrade for normal flow
    if (newIndex !== -1 && currentIndex !== -1 && newIndex < currentIndex) {
      console.log("Downgrade blocked:", current, "-\x3E", newStatus)
      return
    }

    tx.update(ref, {
      status: newStatus,
      updatedAt: serverTimestamp(),
    })
  })
}
