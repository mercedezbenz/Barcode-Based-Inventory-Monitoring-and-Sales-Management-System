"use client";

import { useEffect, useRef } from "react";
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  serverTimestamp, 
  getDocs,
  limit
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase-live";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

// Simple debounce for sound to prevent spamming
let lastPlayed = 0;

const playNotificationSound = () => {
  const now = Date.now();
  if (now - lastPlayed < 2000) return; // 2 second debounce

  lastPlayed = now;

  try {
    const audio = new Audio("/sounds/notification.wav");
    audio.volume = 0.7;
    audio.play().catch((err) => {
      console.log("Autoplay blocked or playback error:", err);
    });
  } catch (err) {
    console.log("Sound error:", err);
  }
};

/**
 * GlobalOrderListener
 * 
 * Listens for new orders in the 'orders' collection.
 * If a new order is detected (created after the listener started), 
 * it checks if a 'new_order' notification already exists.
 * If not, it creates one for the 'sales' role.
 */
export function GlobalOrderListener() {
  const { user } = useAuth();
  const isInitialLoad = useRef<boolean>(true);

  // Browser Autoplay Fix: Unlock audio on first interaction
  useEffect(() => {
    const unlock = () => {
      const audio = new Audio("/sounds/notification.wav");
      audio.volume = 0; // Silent play to unlock
      audio.play().catch(() => {});
      document.removeEventListener("click", unlock);
    };

    document.addEventListener("click", unlock);
    return () => document.removeEventListener("click", unlock);
  }, []);

  useEffect(() => {
    // We only need to listen if the user is authorized to see orders (sales/admin)
    // But only 'sales' should trigger the creation to keep it consistent
    if (!user || user.role !== "sales") return;

    const db = getFirebaseDb();
    if (!db) return;

    console.log("[GlobalOrderListener] 🛰️ Monitoring for new orders...");

    // Listen to orders collection
    // We don't filter by status here because we want to detect ANY new order document
    const unsub = onSnapshot(collection(db, "orders"), async (snap) => {
      if (isInitialLoad.current) {
        console.log(`[GlobalOrderListener] 📦 Initial load: ${snap.docs.length} orders found.`);
        isInitialLoad.current = false;
        return;
      }

      // Find documents that were newly added
      const changes = snap.docChanges();
      const newOrders = changes.filter(change => change.type === "added");

      if (newOrders.length > 0) {
        console.log(`[GlobalOrderListener] ✨ ${newOrders.length} new order(s) detected!`);
        
        for (const change of newOrders) {
          const orderData = change.doc.data();
          const orderId = change.doc.id;
          const customerName = orderData.customerName || orderData.shippingAddress?.fullName || "New Customer";

          // 1. Check if notification already exists to prevent duplicates across multiple sales users
          const notifQuery = query(
            collection(db, "notifications"),
            where("orderId", "==", orderId),
            where("type", "==", "new_order"),
            limit(1)
          );
          
          const existingNotifs = await getDocs(notifQuery);
          
          if (existingNotifs.empty) {
            console.log(`[GlobalOrderListener] 🔔 Creating notification for Order #${orderId}`);
            
            try {
              await addDoc(collection(db, "notifications"), {
                title: "New Order Received",
                message: `${customerName} placed an order`,
                type: "new_order",
                targetRole: "sales",
                orderId: orderId,
                isRead: false,
                createdAt: serverTimestamp()
              });

              // Play notification sound using the helper function
              playNotificationSound();

              // Show Toast
              toast.success(`🛒 New order received from ${customerName}`, {
                duration: 8000,
              });
            } catch (err) {
              console.error("[GlobalOrderListener] Failed to create notification:", err);
            }
          }
        }
      }
    });

    return () => unsub();
  }, [user]);

  return null; // Logic-only component
}

