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
  limit,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase-live";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

// Simple debounce for sound to prevent spamming
let lastEncoderSoundPlayed = 0;

const playEncoderNotificationSound = () => {
  const now = Date.now();
  if (now - lastEncoderSoundPlayed < 2000) return; // 2 second debounce

  lastEncoderSoundPlayed = now;

  try {
    const audio = new Audio("/sounds/notification.wav");
    audio.volume = 0.7;
    audio.play().catch((err) => {
      console.log("[EncoderTaskListener] Autoplay blocked:", err);
    });
  } catch (err) {
    console.log("[EncoderTaskListener] Sound error:", err);
  }
};

/**
 * EncoderTaskListener
 *
 * Listens for new encoder tasks in the 'encoder_tasks' collection.
 * When a new task appears with status "READY_FOR_PROCESSING" or "ready_for_processing",
 * it creates a notification document for the 'encoder' role.
 *
 * This component runs as a logic-only component (renders null)
 * and is mounted in the MainLayout.
 */
export function EncoderTaskListener() {
  const { user } = useAuth();
  const isInitialLoad = useRef<boolean>(true);
  const processedTaskIds = useRef<Set<string>>(new Set());

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
    // Only encoder and admin roles should have this listener active
    if (!user || !["encoder", "admin"].includes(user.role || "")) return;

    const db = getFirebaseDb();
    if (!db) return;

    console.log("[EncoderTaskListener] 🛰️ Monitoring for new encoder tasks...");

    // Listen to encoder_tasks collection for pending/ready tasks
    const q = query(
      collection(db, "encoder_tasks"),
      where("status", "in", ["ready_for_processing", "READY_FOR_PROCESSING", "processing", "PROCESSING"])
    );

    const unsub = onSnapshot(q, async (snap) => {
      if (isInitialLoad.current) {
        // On initial load, record all existing task IDs so we don't re-notify
        snap.docs.forEach((doc) => {
          processedTaskIds.current.add(doc.id);
        });
        console.log(
          `[EncoderTaskListener] 📦 Initial load: ${snap.docs.length} pending encoder tasks found.`
        );
        isInitialLoad.current = false;
        return;
      }

      // Find documents that were newly added
      const changes = snap.docChanges();
      const newTasks = changes.filter(
        (change) =>
          change.type === "added" && !processedTaskIds.current.has(change.doc.id)
      );

      if (newTasks.length > 0) {
        console.log(
          `[EncoderTaskListener] ✨ ${newTasks.length} new encoder task(s) detected!`
        );

        for (const change of newTasks) {
          const taskData = change.doc.data();
          const taskId = change.doc.id;
          const customerName =
            taskData.customerName || "New Customer";
          const invoiceNo =
            taskData.salesInvoiceNo ||
            taskData.salesInvoiceNumber ||
            "N/A";
          const orderId = taskData.orderId || taskId;

          // Mark as processed immediately to prevent duplicate handling
          processedTaskIds.current.add(taskId);

          // 1. Check if notification already exists to prevent duplicates
          try {
            const notifQuery = query(
              collection(db, "notifications"),
              where("encoderTaskId", "==", taskId),
              where("type", "==", "pending_task"),
              limit(1)
            );

            const existingNotifs = await getDocs(notifQuery);

            if (existingNotifs.empty) {
              console.log(
                `[EncoderTaskListener] 🔔 Creating notification for Task #${taskId}`
              );

              await addDoc(collection(db, "notifications"), {
                title: "New Pending Task",
                message: `${customerName} — Invoice: ${invoiceNo}`,
                type: "pending_task",
                targetRole: "encoder",
                encoderTaskId: taskId,
                orderId: orderId,
                invoiceNo: invoiceNo,
                customerName: customerName,
                recipient: "encoder",
                status: "unread",
                isRead: false,
                createdAt: serverTimestamp(),
              });

              // Play notification sound
              playEncoderNotificationSound();

              // Show Toast
              toast.success(
                `📋 New Pending Task: ${customerName}`,
                {
                  description: `Invoice: ${invoiceNo} — Ready for encoder processing`,
                  duration: 8000,
                }
              );
            } else {
              console.log(
                `[EncoderTaskListener] ⏭️ Notification already exists for Task #${taskId}`
              );
            }
          } catch (err) {
            console.error(
              "[EncoderTaskListener] Failed to create notification:",
              err
            );
          }
        }
      }
    });

    return () => {
      console.log("[EncoderTaskListener] 🧹 Cleaning up listener");
      unsub();
    };
  }, [user]);

  return null; // Logic-only component
}
