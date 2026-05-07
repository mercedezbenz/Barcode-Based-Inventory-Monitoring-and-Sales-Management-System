export interface User {
  uid: string
  email: string
  role: "admin" | "staff" | "driver" | "sales" | "purchasing" | "owner" | "encoder"
  status: "active" | "inactive"
  fullName?: string
  profilePhotoUrl?: string
  licenseNumber?: string
  truckPlateNumber?: string
  createdAt: Date
  updatedAt: Date
}

export interface Category {
  id: string
  name: string
  subcategories: string[]
  createdAt: Date
  updatedAt: Date
}

export interface InventoryItem {
  id: string
  product_id?: string // Identifier for the product used for batch generation (e.g. slugified name)
  barcode: string
  barcode_base?: string  // Original generated barcode before batch suffix (e.g., FPPBB-KCY2H7)
  batch_number?: string  // Auto-incremented batch (e.g., "001", "002")
  name?: string
  category: string // "Raw Material" | "Finished Product" | "By-product" (new system) or legacy ALL CAPS
  subcategory?: string // Legacy field — kept for backward compatibility
  productType?: string // "Beef" | "Pork" | "Chicken" | "Retail" | "Others"
  productName?: string // Specific product name from dropdown (Finished Product / By-product only)
  incoming: number // Renamed from incomingStock
  outgoing: number // Renamed from outgoingStock
  stock: number // Base stock amount
  total: number // Auto calculated: stock + incoming - outgoing
  isFrozenGood?: boolean
  qualityStatus?: "GOOD" | "DAMAGED" | "EXPIRED"
  expiryDate: Date | any // Firebase field name (not expirationDate)
  expirationDate?: Date | any // Keep both for compatibility

  goodReturnStock?: number // Good return stock from Firebase
  damageReturnStock?: number // Damage return stock from Firebase
  stockSource?: string // Where stock came from (From Supplier, From Production, Return, Recovery, From Customer)
  returned?: number // Legacy field for total returns
  avgWeightMin?: number // Lower bound of average weight range (kg)
  avgWeightMax?: number // Upper bound of average weight range (kg)
  productionDate?: Date | any // Production date for incoming stock
  // Weight tracking fields
  production_weight?: number | null // Production weight in kg (required at entry, stored)
  packing_weight?: number | null    // Packing weight in kg (optional)
  weight_difference?: number | null // |production_weight - packing_weight|, stored for quick query
  // Transaction reference documents
  sales_invoice_no?: string | null
  delivery_receipt_no?: string | null
  isArchived?: boolean
  archivedAt?: Date | any
  createdBy?: string
  createdAt: Date
  updatedAt: Date
}

export interface Document {
  id: string
  type: "transfer_slip" | "invoice" | "delivery_receipt"
  number: string
  status: "pending" | "on_delivery" | "delivered"
  items: InventoryItem[]
  createdBy: string
  assignedTo?: string
  createdAt: Date
  updatedAt: Date
}

export interface Delivery {
  id: string
  documentId: string
  status: "pending" | "on_delivery" | "delivered"
  assignedDriver?: string
  assignedTruck?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
  sinotackDeviceId?: string
  lastKnownLocation?: {
    latitude: number
    longitude: number
    timestamp: Date
  }
  trackingHistory?: Array<{
    latitude: number
    longitude: number
    speed?: number
    timestamp: Date
  }>
}

export interface DeliveryLog {
  id: string
  productId: string
  status: "PICKED_UP" | "ON_DELIVERY" | "COMPLETED"
  timestamp: number
}

export interface StockLog {
  id: string
  category: string
  barcode: string
  action: "incoming" | "outgoing" | "adjustment"
  quantity: number
  previousStock: number
  newStock: number
  reason?: string
  createdBy: string
  createdAt: Date
}

export interface InventoryTransaction {
  id: string
  transaction_date: Date | any
  movement_type?: string     // From Supplier / From Production / From Packing / Outgoing / Return
  product_id?: string        // Identifier for the product
  product_name: string
  barcode: string
  category: string
  type: string               // beef, pork, chicken
  unit_type?: "BOX" | "PACK" // consolidated unit type for display
  batch_number?: string      // batch number (e.g., "001")
  barcode_base?: string      // original barcode before batch suffix
  incoming_qty: number       // default 0
  incoming_packs?: number    // packs/boxes incoming
  incoming_unit?: "box" | "pack"  // unit type for incoming stock
  outgoing_qty: number       // default 0
  outgoing_packs?: number    // packs/boxes outgoing
  outgoing_unit?: "box" | "pack"  // unit type for outgoing stock
  avg_weight?: number        // average weight in kg
  good_return: number        // default 0
  damage_return: number      // default 0
  stock_left: number         // computed at write time
  to_location?: string       // destination location / delivery address

  customer_name?: string     // customer name (outgoing)
  customer_address?: string  // full delivery address string (outgoing)
  delivery_address?: string  // alias for customer_address
  addressDetails?: {         // structured address components
    houseNumber?: string
    streetName?: string
    barangay?: string
    city?: string
    province?: string
    region?: string
    zipCode?: string
  }
  expiry_date: Date | any
  reference_no: string       // Supplier DR / Sales Invoice / Transfer Slip / Return Ref
  production_date?: Date | any
  process_date?: Date | any
  source: string             // supplier / production / customer_return / delivery
  created_at: Date | any
  // Weight tracking fields
  incoming_weight?: number | null
  outgoing_weight?: number | null
  good_return_weight?: number | null
  damage_return_weight?: number | null
  production_weight?: number | null
  packing_weight?: number | null
  weight_difference?: number | null
  // Transaction reference documents
  sales_invoice_no?: string | null
  delivery_receipt_no?: string | null
}

export interface CustomerTransaction {
  id: string // Firestore document id (from d.id, never empty)
  customerName: string
  customerAddress: string
  productId: string
  productName: string
  productBarcode: string
  quantity: number
  unit?: string // "Box" | "Pack" etc.
  transactionDate: any
  transactionType: "PRODUCT_OUT" | "IN_PROGRESS" | "DELIVERED"
  assignedDriverId?: string | null
  assignedDriverName?: string | null
  deliveryReceiptNo?: string | null
  salesInvoiceNo?: string | null
  transferSlipNo?: string | null
  deliveredAt?: any // Timestamp when barcode was scanned after delivery completion
  deliveryStatus?: DeliveryLog["status"]
  scannedTimestamp?: Date | null
  completedTime?: string // Formatted timestamp from delivery_logs for DELIVERED status
}

export interface DriverUser {
  id: string // could be uid or doc id
  fullName: string
  email: string
  role: "DELIVERY" | "DRIVER" | "delivery" | "driver"
  displayName?: string // optional alias for fullName
  name?: string // optional alias for fullName
}

// Google Drive related types
export interface GoogleDriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  thumbnailLink?: string
  createdTime?: string
}

export interface GoogleDriveUploadResult {
  fileId: string
  webViewLink: string
  webContentLink?: string
  success: boolean
  error?: string
}

export interface GoogleDriveUserProfile {
  id: string
  email: string
  name: string
  imageUrl: string
}
