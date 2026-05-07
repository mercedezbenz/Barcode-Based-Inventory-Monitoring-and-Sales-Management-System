// Removed mock-firestore import - always using live Firebase
import { getFirebaseDb } from "@/lib/firebase-live"
import {
  collection as fbCollection,
  doc as fbDoc,
  getDocs as fbGetDocs,
  getDoc as fbGetDoc,
  addDoc as fbAddDoc,
  updateDoc as fbUpdateDoc,
  deleteDoc as fbDeleteDoc,
  onSnapshot as fbOnSnapshot,
  query as fbQuery,
  where,
  serverTimestamp,
} from "firebase/firestore"
import type { Category, InventoryItem, InventoryTransaction, Document, Delivery, DeliveryLog } from "@/lib/types"

const handleFirestoreError = (error: any) => {
  console.error("[v0] Service error:", error)
  throw error
}

export class FirebaseService {
  static async getCollection<T>(collectionName: string): Promise<T[]> {
    try {
      // Always use Firebase - do not use mock-firestore
      console.log(`[FirebaseService] Fetching collection: ${collectionName} (using LIVE Firebase)`)
      const db = getFirebaseDb()
      const querySnapshot = await fbGetDocs(fbCollection(db, collectionName))
      // Ensure id is included from Firestore document ID
      // IMPORTANT: Set id AFTER spreading data() to override any empty "id" field in the document
      const data = querySnapshot.docs.map((d: any) => {
        const docData = d.data()
        // Remove any 'id' field from document data (it might be empty string)
        const { id: _, ...rest } = docData
        return {
          ...rest,
          id: d.id, // Firestore document ID - MUST be used (overrides any id in doc data)
        } as T
      })
      console.log(`[FirebaseService] Fetched ${data.length} documents from ${collectionName} collection`)
      return data
    } catch (error) {
      console.error(`[FirebaseService] Error fetching collection ${collectionName}:`, error)
      handleFirestoreError(error)
      return []
    }
  }

  static async getDocument<T>(collectionName: string, id: string): Promise<T | null> {
    try {
      // Always use Firebase - do not use mock-firestore
      const db = getFirebaseDb()
      const snap = await fbGetDoc(fbDoc(db, collectionName, id))
      if (!snap.exists()) return null

      // IMPORTANT: Remove any 'id' field from document data and use Firestore document ID
      const docData = snap.data()
      const { id: _, ...rest } = docData || {}
      return {
        ...rest,
        id: snap.id, // Firestore document ID - MUST be used (overrides any id in doc data)
      } as T
    } catch (error) {
      console.error(`[FirebaseService] Error getting document ${collectionName}/${id}:`, error)
      handleFirestoreError(error)
      return null
    }
  }

  static async addDocument<T>(collectionName: string, data: Omit<T, "id">): Promise<string> {
    try {
      // Always use Firebase - do not use mock-firestore
      const db = getFirebaseDb()
      const ref = await fbAddDoc(fbCollection(db, collectionName), data as any)
      console.log(`[FirebaseService] Added document to ${collectionName} with ID: ${ref.id}`)
      return ref.id
    } catch (error) {
      console.error(`[FirebaseService] Error adding document to ${collectionName}:`, error)
      handleFirestoreError(error)
      return ""
    }
  }

  static async updateDocument<T>(collectionName: string, id: string, data: Partial<T>): Promise<void> {
    try {
      // Always use Firebase - do not use mock-firestore

      // Validate that we have a document ID
      if (!id || id.trim() === "") {
        throw new Error(`Invalid document ID: "${id}". Document ID cannot be empty.`)
      }

      const db = getFirebaseDb()
      // Use 3-argument form: doc(db, collectionName, documentId)
      const docRef = fbDoc(db, collectionName, id)

      console.log(`[FirebaseService] Attempting to update document:`, {
        collection: collectionName,
        documentId: id,
        data: data,
        docRefPath: docRef.path, // Log the full path for debugging
      })

      await fbUpdateDoc(docRef, data as any)

      console.log(`[FirebaseService] ✅ Successfully updated document ${collectionName}/${id}`)
    } catch (error: any) {
      console.error(`[FirebaseService] ❌ Error updating document ${collectionName}/${id}:`, error)
      console.error(`[FirebaseService] Error details:`, {
        message: error?.message,
        code: error?.code,
        name: error?.name,
        stack: error?.stack,
        collectionName,
        documentId: id,
      })
      handleFirestoreError(error)
    }
  }

  static async deleteDocument(collectionName: string, id: string): Promise<void> {
    try {
      // Always use Firebase - do not use mock-firestore
      const db = getFirebaseDb()
      await fbDeleteDoc(fbDoc(db, collectionName, id))
      console.log(`[FirebaseService] Deleted document ${collectionName}/${id}`)
    } catch (error) {
      console.error(`[FirebaseService] Error deleting document ${collectionName}/${id}:`, error)
      handleFirestoreError(error)
    }
  }

  static subscribeToCollection<T>(
    collectionName: string,
    callback: (data: T[]) => void,
    errorCallback?: (error: any) => void,
    queryConstraints?: any[],
  ) {
    // Always use Firebase - do not use mock-firestore
    try {
      const db = getFirebaseDb()
      const ref = fbCollection(db, collectionName)
      const q = queryConstraints && queryConstraints.length ? fbQuery(ref, ...(queryConstraints as any)) : ref

      console.log(`[FirebaseService] Subscribing to collection: ${collectionName} (using LIVE Firebase)`)

      return fbOnSnapshot(
        q as any,
        (snap: any) => {
          // Ensure id is included from Firestore document ID
          // IMPORTANT: Set id AFTER spreading data() to override any empty "id" field in the document
          const data = snap.docs.map((d: any) => {
            const docData = d.data()
            // Remove any 'id' field from document data (it might be empty string)
            const { id: _, ...rest } = docData
            return {
              ...rest,
              id: d.id, // Firestore document ID - MUST be used (overrides any id in doc data)
            } as T
          })
          console.log(`[FirebaseService] Received ${data.length} documents from ${collectionName} collection`)
          callback(data)
        },
        (error: any) => {
          console.error(`[FirebaseService] Error subscribing to ${collectionName}:`, error)
          if (errorCallback) {
            errorCallback(error)
          } else {
            console.warn(`[FirebaseService] No error callback provided, returning empty array`)
            callback([])
          }
        },
      )
    } catch (error) {
      console.error(`[FirebaseService] Failed to initialize Firebase connection:`, error)
      if (errorCallback) {
        errorCallback(error)
      } else {
        callback([])
      }
      // Return a no-op unsubscribe function
      return () => { }
    }
  }
}

// Specific service methods
export const InventoryService = {
  getItems: () => FirebaseService.getCollection<InventoryItem>("inventory"),
  addItem: (item: Omit<InventoryItem, "id">) => FirebaseService.addDocument("inventory", item),
  updateItem: (id: string, item: Partial<InventoryItem>) => FirebaseService.updateDocument("inventory", id, item),
  deleteItem: (id: string) => FirebaseService.deleteDocument("inventory", id),
  subscribeToItems: (
    callback: (items: InventoryItem[]) => void,
    errorCallback?: (error: any) => void
  ) =>
    FirebaseService.subscribeToCollection("inventory", callback, errorCallback),
  subscribeToArchivedItems: (
    callback: (items: InventoryItem[]) => void,
    errorCallback?: (error: any) => void
  ) =>
    FirebaseService.subscribeToCollection("inventory", callback, errorCallback, [where("isArchived", "==", true)]),
}

export const CategoryService = {
  getCategories: () => FirebaseService.getCollection<Category>("categories"),
  addCategory: (category: Omit<Category, "id">) => FirebaseService.addDocument("categories", category),
  updateCategory: (id: string, category: Partial<Category>) =>
    FirebaseService.updateDocument("categories", id, category),
  deleteCategory: (id: string) => FirebaseService.deleteDocument("categories", id),
}

export const DocumentService = {
  getDocuments: () => FirebaseService.getCollection<Document>("documents"),
  addDocument: (document: Omit<Document, "id">) => FirebaseService.addDocument("documents", document),
  updateDocument: (id: string, document: Partial<Document>) =>
    FirebaseService.updateDocument("documents", id, document),
  deleteDocument: (id: string) => FirebaseService.deleteDocument("documents", id),
  subscribeToDocuments: (callback: (documents: Document[]) => void) =>
    FirebaseService.subscribeToCollection("documents", callback, () => {
      callback([])
    }),
}

export const DeliveryService = {
  getDeliveries: () => FirebaseService.getCollection<Delivery>("deliveries"),
  addDelivery: (delivery: Omit<Delivery, "id">) => FirebaseService.addDocument("deliveries", delivery),
  updateDelivery: (id: string, delivery: Partial<Delivery>) =>
    FirebaseService.updateDocument("deliveries", id, delivery),
  deleteDelivery: (id: string) => FirebaseService.deleteDocument("deliveries", id),
  subscribeToDeliveries: (callback: (deliveries: Delivery[]) => void) =>
    FirebaseService.subscribeToCollection("deliveries", callback, () => {
      callback([])
    }),
}

export const DeliveryLogService = {
  getDeliveryLogs: () => FirebaseService.getCollection<DeliveryLog>("delivery_logs"),
  addDeliveryLog: (log: Omit<DeliveryLog, "id">) => FirebaseService.addDocument("delivery_logs", log),
  updateDeliveryLog: (id: string, log: Partial<DeliveryLog>) => FirebaseService.updateDocument("delivery_logs", id, log),
  deleteDeliveryLog: (id: string) => FirebaseService.deleteDocument("delivery_logs", id),
  subscribeToDeliveryLogs: (
    callback: (logs: DeliveryLog[]) => void,
    errorCallback?: (error: any) => void,
    statuses?: DeliveryLog["status"][],
  ) => {
    const constraints = statuses && statuses.length ? [where("status", "in", statuses)] : undefined
    return FirebaseService.subscribeToCollection("delivery_logs", callback, errorCallback, constraints)
  },
}

export const StockLogService = {
  getStockLogs: () => FirebaseService.getCollection("stock_logs"),
  addStockLog: (log: any) => FirebaseService.addDocument("stock_logs", log),
  subscribeToStockLogs: (callback: (logs: any[]) => void) =>
    FirebaseService.subscribeToCollection("stock_logs", callback, () => {
      callback([])
    }),
}

export const TransactionService = {
  addTransaction: (txn: Omit<InventoryTransaction, "id">) =>
    FirebaseService.addDocument<InventoryTransaction>("transactions", txn as any),
  updateTransaction: (id: string, data: Partial<InventoryTransaction>) =>
    FirebaseService.updateDocument<InventoryTransaction>("transactions", id, data as any),
  /**
   * Find an existing transaction row by barcode.
   * Returns the first match (there should only be one per barcode) or null.
   */
  findByBarcode: async (barcode: string): Promise<(InventoryTransaction & { id: string }) | null> => {
    try {
      const db = getFirebaseDb()
      const ref = fbCollection(db, "transactions")
      const q = fbQuery(ref, where("barcode", "==", barcode))
      const snapshot = await fbGetDocs(q)
      if (snapshot.empty) return null
      const doc = snapshot.docs[0]
      const data = doc.data()
      const { id: _, ...rest } = data
      return { ...rest, id: doc.id } as any
    } catch (error) {
      console.error("[TransactionService] Error finding transaction by barcode:", error)
      return null
    }
  },
  subscribeToTransactions: (
    callback: (txns: InventoryTransaction[]) => void,
    errorCallback?: (error: any) => void,
  ) =>
    FirebaseService.subscribeToCollection<InventoryTransaction>(
      "transactions",
      callback,
      errorCallback ?? (() => callback([])),
    ),
}

// Stock Movements service
export interface StockMovement {
  id: string
  inventoryItemId?: string
  barcode?: string
  category?: string
  subcategory?: string
  movementType: "INCOMING" | "OUTGOING" | string
  quantity: number
  previousStock?: number
  newStock?: number
  reason?: string
  transactionDocuments?: any
  createdBy?: string
  createdAt: any
  updatedAt: any
}

export const StockMovementService = {
  getMovements: () => FirebaseService.getCollection<StockMovement>("stock_movements"),
  addMovement: (movement: Omit<StockMovement, "id">) =>
    FirebaseService.addDocument("stock_movements", movement),
  subscribeToMovements: (callback: (logs: StockMovement[]) => void) =>
    FirebaseService.subscribeToCollection("stock_movements", callback, () => {
      callback([])
    }),
}

export const CustomerTransactionService = {
  getTransactions: () => FirebaseService.getCollection("customer_transactions"),
  getPendingDeliveries: async () => {
    const allTransactions = await FirebaseService.getCollection<any>("customer_transactions")
    return allTransactions.filter((transaction: any) => transaction.transactionType === "PRODUCT_OUT")
  },
  addTransaction: (transaction: any) => FirebaseService.addDocument("customer_transactions", transaction),
  updateTransaction: (id: string, transaction: Partial<any>) =>
    FirebaseService.updateDocument("customer_transactions", id, transaction),
  subscribeToPendingDeliveries: (callback: (transactions: any[]) => void) =>
    FirebaseService.subscribeToCollection<any>(
      "customer_transactions",
      callback,
      () => callback([]),
      [where("transactionType", "==", "PRODUCT_OUT")],
    ),
  subscribeToInProgressDeliveries: (callback: (transactions: any[]) => void) =>
    FirebaseService.subscribeToCollection<any>(
      "customer_transactions",
      callback,
      () => callback([]),
      [where("transactionType", "==", "IN_PROGRESS")],
    ),
  subscribeToDeliveredDeliveries: (callback: (transactions: any[]) => void) =>
    FirebaseService.subscribeToCollection<any>(
      "customer_transactions",
      callback,
      () => callback([]),
      [where("transactionType", "==", "DELIVERED")],
    ),
  subscribeToAllTransactions: (callback: (transactions: any[]) => void) =>
    FirebaseService.subscribeToCollection<any>(
      "customer_transactions",
      (all) => {
        callback(all || [])
      },
      () => callback([]),
    ),
}

export const UserService = {
  getUsers: () => FirebaseService.getCollection("users"),
  getDrivers: async () => {
    try {
      const db = getFirebaseDb()
      const usersRef = fbCollection(db, "users")
      const q = fbQuery(usersRef, where("role", "in", ["DELIVERY", "DRIVER", "delivery", "driver"]))
      const querySnapshot = await fbGetDocs(q)
      // IMPORTANT: Set id AFTER spreading data() to override any empty "id" field in the document
      const drivers = querySnapshot.docs.map((d) => {
        const docData = d.data()
        // Remove any 'id' field from document data (it might be empty string)
        const { id: _, ...rest } = docData
        return {
          ...rest,
          id: d.id, // Firestore document ID - MUST be used (overrides any id in doc data)
        }
      })
      console.log(`[UserService] Fetched ${drivers.length} drivers from users collection`)
      return drivers
    } catch (error) {
      console.error(`[UserService] Error fetching drivers:`, error)
      return []
    }
  },
  subscribeToDrivers: (callback: (drivers: any[]) => void) =>
    FirebaseService.subscribeToCollection<any>(
      "users",
      (all) => {
        const drivers = (all || []).filter(
          (u: any) =>
            u.role === "DELIVERY" || u.role === "DRIVER" || u.role === "delivery" || u.role === "driver",
        )
        callback(drivers)
      },
      () => callback([]),
      [where("role", "in", ["DELIVERY", "DRIVER", "delivery", "driver"])],
    ),
}

export const deleteInventoryItem = (id: string) => InventoryService.deleteItem(id)
export const addInventoryItem = (item: Omit<InventoryItem, "id">) => InventoryService.addItem(item)
export const updateInventoryItem = (id: string, item: Partial<InventoryItem>) => InventoryService.updateItem(id, item)
export const getInventoryItems = () => InventoryService.getItems()
export const subscribeToInventoryItems = (callback: (items: InventoryItem[]) => void) =>
  InventoryService.subscribeToItems(callback)

export const subscribeToCollection = FirebaseService.subscribeToCollection

// Export a unified service object for easier imports
export const firebaseService = {
  ...FirebaseService,
  inventory: InventoryService,
  categories: CategoryService,
  documents: DocumentService,
  deliveries: DeliveryService,
  stockLogs: StockLogService,
  stockMovements: StockMovementService,
  customerTransactions: CustomerTransactionService,
  transactions: TransactionService,
}

// ─── Barcode Service ───────────────────────────────────────────────────────────
// Manages the `generated_barcodes` Firestore collection used by both the
// Android mobile app and this Admin Web App to guarantee globally unique barcodes.

export const BarcodeService = {
  /**
   * Check whether a barcode already exists in the generated_barcodes collection.
   */
  checkBarcodeExists: async (barcode: string): Promise<boolean> => {
    try {
      const db = getFirebaseDb()
      const ref = fbCollection(db, "generated_barcodes")
      const q = fbQuery(ref, where("barcode", "==", barcode))
      const snapshot = await fbGetDocs(q)
      return !snapshot.empty
    } catch (error) {
      console.error("[BarcodeService] Error checking barcode existence:", error)
      // On error assume it might exist to avoid duplicates
      return true
    }
  },

  /**
   * Save a newly generated barcode record so it is reserved globally.
   */
  saveBarcodeRecord: async (data: {
    barcode: string
    category: string
    productName: string
  }): Promise<string> => {
    try {
      const db = getFirebaseDb()
      const ref = await fbAddDoc(fbCollection(db, "generated_barcodes"), {
        barcode: data.barcode,
        category: data.category,
        productName: data.productName,
        createdAt: serverTimestamp(),
      })
      console.log(`[BarcodeService] Barcode record saved: ${data.barcode} (doc: ${ref.id})`)
      return ref.id
    } catch (error) {
      console.error("[BarcodeService] Error saving barcode record:", error)
      throw error
    }
  },
}

// ─── Batch Number Service ──────────────────────────────────────────────────────
// Manages auto-incrementing batch numbers per barcode base.
// Each product with the same barcode_base gets a unique batch (001, 002, 003...).

export const BatchNumberService = {
  /**
   * Get the next batch number for a given product ID.
   * Queries the `inventory` collection for existing items with the same product_id,
   * finds the highest batch_number, and returns the next one.
   * Returns "001" if no existing items are found.
   */
  getNextBatchNumber: async (productId: string): Promise<string> => {
    try {
      const db = getFirebaseDb()
      const ref = fbCollection(db, "inventory")
      const q = fbQuery(ref, where("product_id", "==", productId))
      const snapshot = await fbGetDocs(q)

      if (snapshot.empty) {
        console.log(`[BatchNumberService] No existing items for product_id="${productId}", starting at 001`)
        return "001"
      }

      // Find the highest batch number among all documents with this product_id
      let maxBatch = 0
      snapshot.docs.forEach((doc) => {
        const data = doc.data()
        const batchStr = data.batch_number || "000"
        const batchNum = parseInt(batchStr, 10)
        if (!isNaN(batchNum) && batchNum > maxBatch) {
          maxBatch = batchNum
        }
      })

      const nextBatch = String(maxBatch + 1).padStart(3, "0")
      console.log(`[BatchNumberService] Found ${snapshot.docs.length} existing items, highest batch=${maxBatch}, next=${nextBatch}`)
      return nextBatch
    } catch (error) {
      console.error("[BatchNumberService] Error getting next batch number:", error)
      // Fallback to 001 on error to avoid blocking the user
      return "001"
    }
  },

  /**
   * Also check the generated_barcodes collection for the final combined barcode
   * to make sure it doesn't already exist.
   */
  checkFinalBarcodeExists: async (finalBarcode: string): Promise<boolean> => {
    try {
      const db = getFirebaseDb()
      // Check inventory collection
      const invRef = fbCollection(db, "inventory")
      const invQ = fbQuery(invRef, where("barcode", "==", finalBarcode))
      const invSnapshot = await fbGetDocs(invQ)
      if (!invSnapshot.empty) return true

      // Also check generated_barcodes collection
      const bcRef = fbCollection(db, "generated_barcodes")
      const bcQ = fbQuery(bcRef, where("barcode", "==", finalBarcode))
      const bcSnapshot = await fbGetDocs(bcQ)
      return !bcSnapshot.empty
    } catch (error) {
      console.error("[BatchNumberService] Error checking final barcode:", error)
      return true // Assume exists on error to be safe
    }
  },
}

