import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "./firebase-live";

export interface ActivityLogMetadata {
  salesInvoiceNo?: string;
  deliveryReceiptNo?: string;
  productName?: string;
  barcode?: string;
  [key: string]: any; // Allow other optional metadata fields
}

export interface ActivityLog {
  type: string;
  message: string;
  performedBy: string;
  role: "sales" | "encoder" | "owner";
  orderId?: string;
  customerName?: string;
  createdAt?: any;
  metadata?: ActivityLogMetadata;
}

/**
 * logActivity
 * 
 * Logs an action to the `activity_logs` collection.
 * This is an isolated monitoring system that does not interfere with the core workflow.
 */
export const logActivity = async (log: Omit<ActivityLog, "createdAt">): Promise<void> => {
  try {
    console.log("[Activity Logger] Triggered:", log);
    const db = getFirebaseDb();
    console.log("[Activity Logger] Firestore DB:", !!db);
    
    if (!db) {
      console.warn("[logActivity] Firebase DB not initialized. Skipping log.");
      return;
    }

    const activityRef = collection(db, "activity_logs");
    await addDoc(activityRef, {
      ...log,
      createdAt: serverTimestamp(),
    });
    console.log("[Activity Logger] Successfully added log");
  } catch (error) {
    console.error("[Activity Logger] Failed to log activity:", error);
    // Silent fail to avoid disrupting user workflows
  }
};
