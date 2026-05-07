"use client"
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase-live";
import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { format } from "date-fns"
import Image from "next/image"
import { CalendarIcon, Barcode, RefreshCw, CheckCircle2, Loader2, Printer, Plus, Check, ChevronsUpDown, AlertTriangle } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { InventoryService, BarcodeService, TransactionService } from "@/services/firebase-service"
import { BarcodeModal } from "./barcode-modal"
import { BarcodeLabel } from "./barcode-label"
import { toast } from "sonner"
import {
  CATEGORIES,
  getTypesForCategory,
  getFilteredProducts,
  categoryPrefixMap,
  categoryRequiresProductName,
  buildProductDisplayName,
  type ProductEntry,
} from "@/lib/product-data"

interface AddItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scannedItem?: import("@/lib/types").InventoryItem | null
}


// ─── Barcode helpers ───────────────────────────────────────────────────────────

const TYPE_CODES: Record<string, string> = {
  Pork: "P",
  Beef: "B",
  Chicken: "C",
  Retail: "R",
  Others: "O",
}

/** Generates a 6-character random alphanumeric string (A-Z, 0-9) */
function generateRandomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = ""
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/** Build an abbreviated product code (2-3 uppercase letters) from a product name */
function buildProductCode(productName: string): string {
  if (!productName) return ""
  // Take first letter of each word, up to 3 characters
  return productName
    .split(/[\s\-()]+/)
    .filter((w) => w.length > 0)
    .map((w) => w[0])
    .join("")
    .substring(0, 3)
    .toUpperCase()
}

/** Format a Date as YYYYMMDD string for barcode embedding */
function formatDateForBarcode(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}${m}${d}`
}

/** Builds a structured barcode: [CategoryCode][TypeCode][ProductCode]-[Random6]-[YYYYMMDD] */
function buildBarcode(category: string, type: string, productionDate: Date, productName?: string): string {
  const catCode = categoryPrefixMap[category] ?? category.slice(0, 2).toUpperCase()
  const typeCode = TYPE_CODES[type] ?? type.charAt(0).toUpperCase()
  const prodCode = productName ? buildProductCode(productName) : ""
  const random = generateRandomCode()
  const dateStr = formatDateForBarcode(productionDate)
  return `${catCode}${typeCode}${prodCode}-${random}-${dateStr}`
}

/** Keeps generating until a barcode is confirmed unique in Firestore */
async function generateUniqueBarcode(
  category: string,
  type: string,
  productionDate: Date,
  productName?: string,
  maxAttempts = 20,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = buildBarcode(category, type, productionDate, productName)
    const exists = await BarcodeService.checkBarcodeExists(candidate)
    if (!exists) return candidate
  }
  throw new Error("Could not generate a unique barcode after multiple attempts. Please try again.")
}

// ─── Component ────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  barcode: "",
  barcodeBase: "",
  category: "",
  productType: "",
  productName: "",
  productionDate: undefined as Date | undefined,
  expirationDate: undefined as Date | undefined,
  // Weight tracking
  productionWeight: "",
  packingWeight: "",
}

// Special sentinel value for "+ Add Item" option
const ADD_NEW_PRODUCT_SENTINEL = "__ADD_NEW_PRODUCT__"

export function AddItemDialog({ open, onOpenChange, scannedItem }: AddItemDialogProps) {
  const isScanned = !!scannedItem
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const datePickerRef = useRef<HTMLDivElement>(null)

  // Barcode generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [barcodeReady, setBarcodeReady] = useState(false)
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false)

  const [formData, setFormData] = useState(EMPTY_FORM)

  // Confirmation state
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [dontShowSmallDiff, setDontShowSmallDiff] = useState(false)

  // Custom product list (user-added products during session)
  const [customProducts, setCustomProducts] = useState<ProductEntry[]>([])
  const [isSavingProduct, setIsSavingProduct] = useState(false)

  // Listen to Firestore products collection
  useEffect(() => {
    const productsRef = collection(db, "products")
    const unsubscribe = onSnapshot(productsRef, (snapshot) => {
      const fetchedProducts: ProductEntry[] = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        if (data.name && data.category && data.type) {
          fetchedProducts.push({
            name: data.name,
            category: data.category,
            type: data.type
          })
        }
      })
      setCustomProducts(fetchedProducts)
    }, (error) => {
      console.error("Error fetching products from Firebase:", error)
    })
    return () => unsubscribe()
  }, [])

  // "+ Add Item" inline form
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [newProductName, setNewProductName] = useState("")
  // Dropdown search state
  const [searchQuery, setSearchQuery] = useState("")

  // Image upload state (By-product only)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // ── Cloudinary upload helper ──────────────────────────────────────────────
  const uploadToCloudinary = async (file: File): Promise<string> => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!

    if (!cloudName || !uploadPreset) {
      throw new Error("Cloudinary configuration is missing. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in .env.local")
    }

    console.log("Uploading file:", file.name, file.type, file.size, "bytes")

    const payload = new FormData()
    payload.append("file", file)
    payload.append("upload_preset", uploadPreset)

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: payload }
    )

    const data = await res.json()
    console.log("Cloudinary FULL RESPONSE:", data)

    if (!res.ok) {
      throw new Error(data?.error?.message || "Upload failed")
    }

    return data.secure_url as string
  }

  const resetAll = useCallback(() => {
    setFormData(EMPTY_FORM)
    setErrors({})
    setDatePickerOpen(false)
    setIsGenerating(false)
    setBarcodeReady(false)
    setShowAddProduct(false)
    setNewProductName("")
    setImageFile(null)
    setImagePreview(null)
    setBarcodeModalOpen(false)
  }, [])

  // ── Auto-fill from scanned item ─────────────────────────────────────────
  useEffect(() => {
    if (open && scannedItem) {
      const itemAny = scannedItem as any
      setFormData((prev) => ({
        ...prev,
        category: itemAny.category || "",
        productType: itemAny.productType || itemAny.subcategory || "",
        productName: itemAny.productName || itemAny.name || "",
        barcode: itemAny.barcode || "",
      }))
      if (itemAny.barcode) {
        setBarcodeReady(true)
      }
    } else if (!open) {
      resetAll()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // ── Date picker outside-click / escape ──────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setDatePickerOpen(false)
      }
    }
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDatePickerOpen(false)
    }
    if (datePickerOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("keydown", handleEscapeKey)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscapeKey)
    }
  }, [datePickerOpen])

  // ── Derived values ────────────────────────────────────────────────────────
  const showProductDropdown = categoryRequiresProductName(formData.category)

  const availableTypes = formData.category
    ? getTypesForCategory(formData.category)
    : []

  const availableProducts = formData.category && formData.productType
    ? [
        ...getFilteredProducts(formData.category, formData.productType),
        ...customProducts.filter(
          (p) => p.category === formData.category && p.type === formData.productType
        ),
      ]
    : []

  // Auto-derived display name
  const autoProductName = (() => {

    if (formData.productName) {
      return formData.productName
    }
    if (formData.category && formData.productType) {
      return `${formData.category} - ${formData.productType}`
    }
    return ""
  })()

  // Generate a deterministic product ID based on the product name for batch grouping
  const productId = (autoProductName || formData.category)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

  // ── Change handlers ───────────────────────────────────────────────────────
  const handleCategoryChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      category: value,
      productType: "",
      productName: "",
      barcode: "",
    }))
    setBarcodeReady(false)
    setShowAddProduct(false)
    setErrors((prev) => ({ ...prev, category: "", productType: "", productName: "", barcode: "" }))
  }

  const handleTypeChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      productType: value,
      productName: "",
      barcode: "",
    }))
    setBarcodeReady(false)
    setShowAddProduct(false)
    setErrors((prev) => ({ ...prev, productType: "", productName: "", barcode: "" }))
  }

  const handleProductNameChange = (value: string) => {
    if (value === ADD_NEW_PRODUCT_SENTINEL) {
      setShowAddProduct(true)
      return
    }
    setFormData((prev) => ({ ...prev, productName: value, barcode: "" }))
    setBarcodeReady(false)
    setErrors((prev) => ({ ...prev, productName: "", barcode: "" }))
  }

  // ── Add new product inline ────────────────────────────────────────────────
  // ── Add new product inline ────────────────────────────────────────────────
  const handleSaveNewProduct = async () => {
    const trimmed = newProductName.trim()
    if (!trimmed) return

    // Standardize casing (e.g. "pork belly" -> "Pork Belly")
    const standardizedName = trimmed.replace(/\b\w/g, char => char.toUpperCase())

    // Prevent duplicates
    const isDuplicate = availableProducts.some(p => p.name.toLowerCase() === standardizedName.toLowerCase())
    if (isDuplicate) {
      toast.error("Product already exists", {
        description: "Please select it from the dropdown."
      })
      return
    }

    setIsSavingProduct(true)
    try {
      const productsRef = collection(db, "products")
      await addDoc(productsRef, {
        name: standardizedName,
        category: formData.category,
        type: formData.productType,
        createdAt: serverTimestamp()
      })

      // Update local state immediately for fast UI feedback
      setFormData((prev) => ({ ...prev, productName: standardizedName }))
      setShowAddProduct(false)
      setNewProductName("")
      setErrors((prev) => ({ ...prev, productName: "" }))

      toast.success("Product Saved", {
        description: `"${standardizedName}" has been added to the master list.`
      })
    } catch (error: any) {
      console.error("Error saving product:", error)
      toast.error("Failed to save product", {
        description: error.message || "Please try again."
      })
    } finally {
      setIsSavingProduct(false)
    }
  }

  // Check if we can generate barcode
  const canGenerate = (() => {
    if (!formData.category || !formData.productType) return false
    if (showProductDropdown && !formData.productName) return false
    if (!formData.productionDate) return false
    return true
  })()

  // ── Auto-generate barcode when all fields are selected ──────────────────
  const prevCanGenerateRef = useRef(false)
  useEffect(() => {
    // Only auto-trigger when canGenerate transitions from false → true
    // and no barcode exists yet
    if (canGenerate && !prevCanGenerateRef.current && !formData.barcode && !isGenerating) {
      handleGenerateBarcode()
    }
    prevCanGenerateRef.current = canGenerate
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canGenerate, formData.barcode, isGenerating])

  // ── Generate Unique Barcode ─────────────────────────────────────────────
  const handleGenerateBarcode = async () => {
    if (!canGenerate || isGenerating || !formData.productionDate) return
    setIsGenerating(true)
    setBarcodeReady(false)
    setFormData((prev) => ({ ...prev, barcode: "", barcodeBase: "" }))
    setErrors((prev) => ({ ...prev, barcode: "" }))

    try {
      // Generate the full barcode: [CatTypeProduct]-[Random6]-[YYYYMMDD]
      const finalBarcode = await generateUniqueBarcode(
        formData.category,
        formData.productType,
        formData.productionDate,
        formData.productName || undefined,
      )

      // Derive the base (everything before the date suffix)
      const parts = finalBarcode.split("-")
      const barcodeBase = parts.slice(0, -1).join("-") // e.g. FPPBB-KCY2H7

      // Save the barcode to generated_barcodes collection
      await BarcodeService.saveBarcodeRecord({
        barcode: finalBarcode,
        category: formData.category,
        productName: autoProductName || formData.category,
      })

      setFormData((prev) => ({
        ...prev,
        barcode: finalBarcode,
        barcodeBase: barcodeBase,
      }))
      setBarcodeReady(true)

      // Build formatted dates for the toast
      const prodDateFormatted = format(formData.productionDate, "MMMM dd, yyyy")
      toast.success("Barcode Generated & Saved", {
        description: `Barcode: ${finalBarcode} | Production: ${prodDateFormatted}`,
      })
    } catch (error: any) {
      toast.error("Barcode Generation Failed", {
        description: error.message || "Please try again.",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Validation ─────────────────────────────────────────────────────────

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.barcode.trim()) {
      newErrors.barcode = "Barcode is required — click 'Generate Unique Barcode' first"
    }
    if (!formData.category) newErrors.category = "Category is required"
    if (!formData.productType) newErrors.productType = "Type is required"
    if (showProductDropdown && !formData.productName) {
      newErrors.productName = "Product name is required"
    }
    if (!formData.expirationDate) newErrors.expirationDate = "Expiration date is required"

    const prodW = parseFloat(formData.productionWeight)
    if (!formData.productionWeight || isNaN(prodW) || prodW <= 0) {
      newErrors.productionWeight = "Production weight is required (must be > 0)"
    }



    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // ── Submit ─────────────────────────────────────────────────────────────
  // ── Submit Wrapper ──────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      toast.error("Authentication Error", {
        description: "You must be logged in to add items.",
      })
      return
    }

    if (!validateForm()) {
      return
    }

    // Weight discrepancy check
    const prodW = formData.productionWeight ? parseFloat(formData.productionWeight) : 0
    const packW = formData.packingWeight ? parseFloat(formData.packingWeight) : 0
    const weightDiff = Math.abs(prodW - packW)

    if (weightDiff > 0) {
      // Logic:
      // If > 5kg: FORCE confirmation
      // If <= 5kg: Show unless "Don't show again" is checked
      if (weightDiff > 5 || !dontShowSmallDiff) {
        setShowConfirmModal(true)
        return
      }
    }

    await performSubmit()
  }

  // ── Actual Submission Logic ───────────────────────────────────────────
  const performSubmit = async () => {
    setLoading(true)
    console.log("imageFile before upload:", imageFile)
    try {
      // Compute weight difference
      const prodW = formData.productionWeight ? parseFloat(formData.productionWeight) : null
      const packW = formData.packingWeight ? parseFloat(formData.packingWeight) : null
      const weightDiff = prodW !== null && packW !== null ? Math.abs(prodW - packW) : null

      // Weight-based: compute boxes from production weight (1 box = 25 kg)
      const weight = prodW || 0
      const computedBoxes = Math.floor(weight / 25)
      const incoming = computedBoxes
      const stockLeft = incoming

      // Standardize productKey for BOTH categories
      const productKey = `${(autoProductName || formData.category).toLowerCase().trim()}-${formData.productType.toLowerCase().trim()}`
        .replace(/\s+/g, "-")

      // Upload image to Cloudinary FIRST
      let uploadedImageUrl: string | null = null
      if (imageFile) {
        try {
          uploadedImageUrl = await uploadToCloudinary(imageFile)
        } catch (uploadErr: any) {
          console.error("Cloudinary upload failed:", uploadErr)
          toast.error("Image Upload Failed", {
            description: uploadErr.message || "Could not upload image. Product will be saved without an image.",
          })
        }
      }

      const itemData: any = {
        imageUrl: uploadedImageUrl || null,
        barcode: formData.barcode.trim(),
        barcode_base: formData.barcodeBase || formData.barcode.trim(),
        product_id: productKey,
        name: autoProductName || formData.category,
        category: formData.category,
        productType: formData.productType,
        productName: formData.productName || null,
        // Legacy compatibility
        subcategory: formData.productName || formData.productType || null,
        incoming,
        outgoing: 0,
        stock: stockLeft,
        total: stockLeft,
        stockSource: "incoming",
        goodReturnStock: 0,
        damageReturnStock: 0,
        productionDate: formData.productionDate || null,
        expiryDate: formData.expirationDate || null,
        expirationDate: formData.expirationDate || null,
        unit_type: "BOX",
        // Weight tracking
        incoming_weight: weight,
        incoming_boxes: computedBoxes,
        production_weight: prodW,
        packing_weight: packW,
        weight_difference: weightDiff,
        qualityStatus: "GOOD" as const,
        transactionDocuments: {
          transaction_type: "incoming",
          source: "incoming",
        },
        createdBy: user!.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await InventoryService.addItem(itemData)

      // Upsert product master data for products that support image upload
     if (imageFile) {
        const ref = doc(db, "products", productKey);
        const snap = await getDoc(ref);
        const existingData = snap.data();

        console.log("Final imageUrl:", uploadedImageUrl)

        if (!uploadedImageUrl && imageFile) {
           console.warn("Image upload failed or skipped")
        }

        console.log("Category:", itemData.category)
        console.log("ProductKey:", productKey)
        console.log("ImageFile:", imageFile)
        console.log("ImageURL:", uploadedImageUrl)

        // 4. Fix overwrite issue using merge: true
        await setDoc(ref, {
  name: itemData.name,
  type: itemData.productType,
  category: itemData.category,
  imageUrl: uploadedImageUrl ?? existingData?.imageUrl ?? null,
}, { merge: true });
      }


      // APPEND-ONLY LEDGER: Always create a NEW transaction row for every incoming event
      await TransactionService.addTransaction({
        transaction_date: new Date(),
        product_name: autoProductName || formData.category,
        product_id: productId,
        barcode: formData.barcode.trim(),
        barcode_base: formData.barcodeBase || formData.barcode.trim(),
        category: formData.category,
        type: formData.productType,
        unit_type: "BOX",
        incoming_qty: incoming,
        incoming_packs: incoming,
        incoming_weight: weight,
        incoming_boxes: computedBoxes,
        incoming_unit: "box",
        outgoing_qty: 0,
        outgoing_packs: 0,
        good_return: 0,
        damage_return: 0,
        stock_left: stockLeft,
        production_date: formData.productionDate || null,
        expiry_date: formData.expirationDate || null,
        reference_no: "",
        source: "incoming",
        process_date: null,
        created_at: new Date(),
        // Weight tracking
        production_weight: prodW,
        packing_weight: packW,
        weight_difference: weightDiff,
      } as any)

      toast.success("Success", {
        description: "Item successfully added to inventory.",
        icon: "✅",
      })

      setShowConfirmModal(false)
      resetAll()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Error adding item:", error)
      toast.error("Error", {
        description: "Something went wrong. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      resetAll()
      onOpenChange(false)
    }
  }

  // Stock left preview (weight-based)
  const previewWeight = parseFloat(formData.productionWeight) || 0
  const previewBoxes = Math.floor(previewWeight / 25)

  // ── Category color helper ─────────────────────────────────────────────────
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "Finished Product": return "bg-green-100 text-green-800 border-green-200"
      case "By-product": return "bg-yellow-100 text-yellow-800 border-yellow-200"
      default: return ""
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="!w-[98vw] sm:!w-[95vw] md:!w-[92vw] !max-w-[1220px] !max-h-[95vh] sm:!max-h-[92vh] !overflow-visible !p-0"
      >
        <div className="p-3 sm:p-4 md:p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg md:text-xl">{isScanned ? "Add Stock to Scanned Item" : "Add New Inventory Item"}</DialogTitle>
            <DialogDescription>
              {isScanned
                ? "Product details are locked from scan. Fill in stock entry details below."
                : "Fill in the details below to add a new item to your inventory."}
            </DialogDescription>
          </DialogHeader>
          {/* Scanned Item Banner */}
          {isScanned && scannedItem && (
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 mt-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 shrink-0">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-emerald-700">Using Scanned Item \uD83D\uDD12</p>
                <p className="text-xs text-emerald-600/80 truncate">
                  {(scannedItem as any).name || scannedItem.category} &bull; {scannedItem.barcode}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">Auto-filled \uD83D\uDD12</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* ── 2-COLUMN LAYOUT: 65/35 split ──────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 sm:gap-5 md:gap-6 p-3 sm:p-4 md:p-6 max-h-[calc(95vh-180px)] sm:max-h-[calc(92vh-180px)] overflow-y-auto overflow-x-visible">

            {/* ════════════════ LEFT COLUMN: All Form Sections ════════════════ */}
            <div className="flex flex-col gap-5 min-w-0">

              {/* ── 1. PRODUCT CLASSIFICATION ─────────────────────────────── */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-5 grid gap-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">Product Classification</p>

                {/* Category + Type side-by-side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label className="text-sm font-medium text-slate-700">
                      Category <span className="text-red-500">*</span>
                    </Label>
                    {isScanned ? (
                      <div className="h-9 px-3 flex items-center rounded-md border border-emerald-200 bg-emerald-50 text-sm font-medium text-emerald-800 cursor-not-allowed">
                        <span>{formData.category || "—"}</span>
                        <span className="text-[10px] font-normal text-emerald-600 ml-auto">\uD83D\uDD12 Locked</span>
                      </div>
                    ) : (
                    <Select value={formData.category} onValueChange={handleCategoryChange}>
                      <SelectTrigger className={cn("h-9", errors.category ? "border-destructive" : "")}>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            <span className="flex items-center gap-2">
                              <span className={cn(
                                "inline-block w-2 h-2 rounded-full",
                                cat === "Finished Product" ? "bg-green-500" :
                                "bg-yellow-500"
                              )} />
                              {cat}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    )}
                    {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
                  </div>

                  <div className="grid gap-1.5">
                    <Label className="text-sm font-medium text-slate-700">
                      Type <span className="text-red-500">*</span>
                    </Label>
                    {isScanned ? (
                      <div className="h-9 px-3 flex items-center rounded-md border border-emerald-200 bg-emerald-50 text-sm font-medium text-emerald-800 cursor-not-allowed">
                        <span>{formData.productType || "—"}</span>
                        <span className="text-[10px] font-normal text-emerald-600 ml-auto">\uD83D\uDD12 Locked</span>
                      </div>
                    ) : (
                    <Select
                      value={formData.productType}
                      onValueChange={handleTypeChange}
                      disabled={!formData.category}
                    >
                      <SelectTrigger className={cn("h-9", errors.productType ? "border-destructive" : "")}>
                        <SelectValue placeholder={formData.category ? "Select type" : "Select category first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTypes.map((t) => (
                          <SelectItem key={t} value={t}>
                            <span className="flex items-center gap-2">
                              <span className="text-base">
                                {t === "Beef" ? "\uD83D\uDC04" : t === "Pork" ? "\uD83D\uDC37" : t === "Chicken" ? "\uD83D\uDC14" : t === "Retail" ? "\uD83D\uDED2" : "\uD83D\uDCE6"}
                              </span>
                              {t}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    )}
                    {errors.productType && <p className="text-xs text-destructive">{errors.productType}</p>}
                  </div>
                </div>

                {/* Product Name dropdown — only for Finished Product & By-product */}
                {showProductDropdown && formData.productType && (
                  <div className="grid gap-1.5">
                    <Label className="text-sm font-medium text-slate-700">
                      Product Name <span className="text-red-500">*</span>
                    </Label>
                    {isScanned ? (
                      <div className="h-9 px-3 flex items-center rounded-md border border-emerald-200 bg-emerald-50 text-sm font-medium text-emerald-800 cursor-not-allowed">
                        <span>{formData.productName || "\u2014"}</span>
                        <span className="text-[10px] font-normal text-emerald-600 ml-auto">\uD83D\uDD12 Locked</span>
                      </div>
                    ) : !showAddProduct ? (
                      <>
                        <Select
                          value={formData.productName}
                          onValueChange={(val) => {
                            handleProductNameChange(val)
                            setSearchQuery("") // Clear search on select
                          }}
                        >
                          <SelectTrigger className={cn("h-9", errors.productName ? "border-destructive" : "")}>
                            <SelectValue placeholder="Select product name" />
                          </SelectTrigger>
                          <SelectContent>
                            <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                              <Input
                                placeholder="Search products..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.stopPropagation()} // Prevent Radix from stealing typing events
                                className="h-8 max-w-full text-sm"
                                autoFocus
                              />
                            </div>
                            <div className="max-h-[220px] overflow-y-auto">
                              <SelectGroup>
                                <SelectLabel className="text-xs text-slate-400">
                                  {formData.category} — {formData.productType}
                                </SelectLabel>
                                {availableProducts
                                  .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                  .map((p) => (
                                    <SelectItem key={p.name} value={p.name}>
                                      {p.name}
                                    </SelectItem>
                                  ))}
                                {availableProducts.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                  <div className="px-2 py-4 text-center text-sm text-slate-500">
                                    No matches found
                                  </div>
                                )}
                              </SelectGroup>
                              <SelectGroup>
                                <SelectItem value={ADD_NEW_PRODUCT_SENTINEL}>
                                  <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                                    <Plus className="h-3.5 w-3.5" />
                                    Add Item
                                  </span>
                                </SelectItem>
                              </SelectGroup>
                            </div>
                          </SelectContent>
                        </Select>
                        {errors.productName && <p className="text-xs text-destructive">{errors.productName}</p>}
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          value={newProductName}
                          onChange={(e) => setNewProductName(e.target.value)}
                          placeholder="Enter new product name"
                          className="h-9 flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              handleSaveNewProduct()
                            }
                            if (e.key === "Escape") {
                              setShowAddProduct(false)
                              setNewProductName("")
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-9 px-3"
                          onClick={handleSaveNewProduct}
                          disabled={!newProductName.trim() || isSavingProduct}
                        >
                          {isSavingProduct ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-9 px-2"
                          onClick={() => {
                            setShowAddProduct(false)
                            setNewProductName("")
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                )}



                {/* Image Upload — By-product and Finished Product */}
                {(formData.category === "By-product" || formData.category === "Finished Product") && (
                  <div className="grid gap-1.5">
                    <Label className="text-sm font-medium text-slate-700">
                      Product Image <span className="text-slate-400 font-normal">(optional)</span>
                    </Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        console.log("Selected file:", file)
                        if (file.size > 2 * 1024 * 1024) {
                          toast.error("File too large", {
                            description: "Image must be under 2 MB.",
                          })
                          e.target.value = ""
                          return
                        }
                        setImageFile(file)
                        setImagePreview(URL.createObjectURL(file))
                      }}
                      className="h-9 file:mr-3 file:h-7 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:text-xs file:font-medium file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    />
                    {imagePreview && (
                      <div className="relative mt-1 w-24 h-24 rounded-lg border border-slate-200 overflow-hidden bg-white">
                        <Image
                          src={imagePreview}
                          alt="Preview"
                          width={96}
                          height={96}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setImageFile(null)
                            setImagePreview(null)
                          }}
                          className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black/80 transition-colors"
                          aria-label="Remove image"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400">Max 2 MB · JPG, PNG, WebP</p>
                  </div>
                )}
              </div>

              {/* Product Name Preview */}
              {autoProductName && (
                <div className="grid gap-1.5 -mt-1">
                  <Label className="text-sm font-medium text-slate-700">
                    Product Name <span className="text-slate-400 font-normal">(auto-generated)</span>
                  </Label>
                  <div className="h-9 px-3 flex items-center rounded-md border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700">
                    {autoProductName}
                  </div>
                </div>
              )}

              {/* ── 2. STOCK ENTRY (Weight-Based) ─────────────────────────── */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-5 grid gap-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-500">Stock Entry (Weight-Based)</p>

                {/* Row 1: Production Weight | Packing Weight */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Production Weight */}
                  <div className="grid gap-1.5">
                    <Label className="text-sm font-medium text-slate-700">
                      Production Weight <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex gap-1.5 items-center">
                      <Input
                        id="productionWeight"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.productionWeight}
                        onChange={(e) => {
                          setFormData((prev) => ({ ...prev, productionWeight: e.target.value }))
                          setErrors((prev) => ({ ...prev, productionWeight: "" }))
                        }}
                        placeholder="e.g. 125"
                        className={cn("h-9 flex-1", errors.productionWeight ? "border-destructive" : "")}
                      />
                      <span className="text-sm font-medium text-slate-400 shrink-0">kg</span>
                    </div>
                    {errors.productionWeight && <p className="text-xs text-destructive">{errors.productionWeight}</p>}
                  </div>

                  {/* Packing Weight */}
                  <div className="grid gap-1.5">
                    <Label className="text-sm font-medium text-slate-700">
                      Packing Weight
                    </Label>
                    <div className="flex gap-1.5 items-center">
                      <Input
                        id="packingWeight"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.packingWeight}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, packingWeight: e.target.value }))
                        }
                        placeholder="e.g. 118.0"
                        className="h-9 flex-1"
                      />
                      <span className="text-sm font-medium text-slate-400 shrink-0">kg</span>
                    </div>
                  </div>
                </div>

                {/* Auto-computed boxes preview */}
                {formData.productionWeight && parseFloat(formData.productionWeight) > 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3 flex items-center gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold">📦</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-blue-700">
                        Auto-computed:{" "}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-sm font-bold bg-blue-100 text-blue-800">
                          {Math.floor(parseFloat(formData.productionWeight) / 25)} boxes
                        </span>
                        <span className="text-xs font-normal text-blue-600 ml-2">
                          ({parseFloat(formData.productionWeight)} kg ÷ 25 kg/box)
                        </span>
                      </p>
                    </div>
                  </div>
                )}

                {/* Row 3: Real-time Weight Difference Indicator */}
                {(() => {
                  const pw = parseFloat(formData.productionWeight)
                  const pkw = parseFloat(formData.packingWeight)
                  if (!isNaN(pw) && formData.productionWeight && !isNaN(pkw) && formData.packingWeight) {
                    const diff = Math.abs(pw - pkw)
                    const isOk = diff <= 5
                    return (
                      <div className={cn(
                        "rounded-lg border px-4 py-3 flex items-start gap-3 transition-colors",
                        isOk ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50/60"
                      )}>
                        <span className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          isOk ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                        )}>
                          {isOk ? "✓" : "!"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-sm font-semibold", isOk ? "text-emerald-700" : "text-red-700")}>
                            Weight Difference:{" "}
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-sm font-bold",
                              isOk ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                            )}>
                              {diff.toFixed(2)} kg
                            </span>
                          </p>
                          {!isOk && (
                            <p className="text-xs text-red-600 mt-1">
                              ⚠️ Weight discrepancy exceeds 5 kg. Please verify values.
                            </p>
                          )}
                          {isOk && (
                            <p className="text-xs text-emerald-600 mt-1">Within acceptable range (≤ 5 kg)</p>
                          )}
                        </div>
                      </div>
                    )
                  }
                  if ((formData.productionWeight || formData.packingWeight) && !(formData.productionWeight && formData.packingWeight)) {
                    return (
                      <p className="text-xs text-slate-400 italic">
                        Enter both weights to see the difference.
                      </p>
                    )
                  }
                  return null
                })()}
              </div>

              {/* ── 3. PRODUCTION, EXPIRATION & STORAGE ──────────────────── */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-5 grid gap-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Production, Expiration & Storage</p>
                {/* Production Date | Expiration Date — side-by-side 50/50 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Production Date */}
                  <div className="grid gap-1.5">
                    <Label className="text-sm font-medium text-slate-700">
                      Production Date <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={formData.productionDate ? format(formData.productionDate, "yyyy-MM-dd") : ""}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val) {
                          const parsed = new Date(val + "T00:00:00")
                          if (!isNaN(parsed.getTime())) {
                            setFormData((prev) => ({ ...prev, productionDate: parsed, barcode: "" }))
                            setBarcodeReady(false)
                            if (errors.productionDate) {
                              setErrors((prev) => ({ ...prev, productionDate: "" }))
                            }
                          }
                        } else {
                          setFormData((prev) => ({ ...prev, productionDate: undefined, barcode: "" }))
                          setBarcodeReady(false)
                        }
                      }}
                      className={cn(
                        "h-9 w-full text-sm",
                        errors.productionDate && "border-destructive",
                        formData.productionDate && "text-slate-800 font-medium"
                      )}
                    />
                    {errors.productionDate && <p className="text-xs text-destructive">{errors.productionDate}</p>}
                  </div>

                  {/* Expiration Date */}
                  <div className="grid gap-1.5">
                    <Label className="text-sm font-medium text-slate-700">
                      Expiration Date <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={formData.expirationDate ? format(formData.expirationDate, "yyyy-MM-dd") : ""}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val) {
                          const parsed = new Date(val + "T00:00:00")
                          if (!isNaN(parsed.getTime())) {
                            setFormData((prev) => ({ ...prev, expirationDate: parsed }))
                            if (errors.expirationDate) {
                              setErrors((prev) => ({ ...prev, expirationDate: "" }))
                            }
                          }
                        } else {
                          setFormData((prev) => ({ ...prev, expirationDate: undefined }))
                        }
                      }}
                      className={cn(
                        "h-9 w-full text-sm",
                        errors.expirationDate && "border-destructive",
                        formData.expirationDate && "text-slate-800 font-medium"
                      )}
                    />
                    {errors.expirationDate && <p className="text-xs text-destructive">{errors.expirationDate}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* ════════════════ RIGHT COLUMN: Barcode Generator ════════════════ */}
            <div className="lg:sticky lg:top-0 lg:self-start">
              <div className={`rounded-xl border-2 border-slate-200 bg-gradient-to-b from-slate-50 to-white p-6 grid gap-5 transition-opacity duration-200 shadow-sm ${!isScanned && !canGenerate ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className="flex items-center gap-2.5 pb-1 border-b border-slate-100">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Barcode className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      {isScanned ? "Barcode (Scanned)" : "Barcode Generator"}
                    </p>
                    <p className="text-[10px] text-slate-400">CODE128 format</p>
                  </div>
                </div>

                {/* Generate button — hidden when scanned */}
                {!isScanned && (
                  <>
                    <Button
                      type="button"
                      onClick={handleGenerateBarcode}
                      disabled={!canGenerate || isGenerating}
                      className={cn(
                        "h-12 w-full font-semibold transition-all duration-200 gap-2 text-sm shadow-sm",
                        barcodeReady
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200"
                          : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20",
                        (!canGenerate && !isGenerating) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Checking uniqueness…
                        </>
                      ) : barcodeReady ? (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Re-generate Barcode
                        </>
                      ) : (
                        <>
                          <Barcode className="h-4 w-4" />
                          Generate Unique Barcode
                        </>
                      )}
                    </Button>
                    {!canGenerate && (
                      <p className="text-xs text-slate-400 text-center -mt-1">
                        {!formData.category
                          ? "Select Category and Type first"
                          : !formData.productType
                            ? "Select Type first"
                            : showProductDropdown && !formData.productName
                              ? "Select Product Name first"
                              : !formData.productionDate
                                ? "Set Production Date first"
                                : "Complete required fields first"}
                      </p>
                    )}
                  </>
                )}

                {/* Barcode value display */}
                <div className="grid gap-1.5">
                  <Label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                    Barcode <span className="text-red-500">*</span>
                    {barcodeReady && (
                      <span className="inline-flex items-center gap-1 text-xs font-normal text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                        <CheckCircle2 className="h-3 w-3" />
                        Unique &amp; Ready
                      </span>
                    )}
                  </Label>
                  <div
                    className={cn(
                      "h-10 px-3 flex items-center rounded-md border text-sm font-mono tracking-widest transition-colors",
                      barcodeReady
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-slate-50 text-slate-400",
                      errors.barcode ? "border-destructive" : ""
                    )}
                  >
                    {formData.barcode || (
                      <span className="font-sans tracking-normal text-slate-400">
                        {isGenerating ? "Generating…" : "Auto-filled after generation"}
                      </span>
                    )}
                  </div>
                  {errors.barcode && <p className="text-xs text-destructive">{errors.barcode}</p>}
                </div>

                {/* Production & Expiration Date display (read-only) */}
                {barcodeReady && (
                  <div className="grid gap-3">
                    {formData.productionDate && (
                      <div className="grid gap-1.5">
                        <Label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                          Production Date
                          <span className="inline-flex items-center text-[10px] font-normal text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                            Embedded in barcode
                          </span>
                        </Label>
                        <div className="h-10 px-3 flex items-center justify-between rounded-md border border-violet-200 bg-violet-50 text-sm transition-colors">
                          <span className="font-semibold text-violet-700 tracking-wide">
                            {format(formData.productionDate, "MMMM dd, yyyy")}
                          </span>
                          <span className="text-[10px] text-violet-400 font-normal font-mono">
                            {formatDateForBarcode(formData.productionDate)}
                          </span>
                        </div>
                      </div>
                    )}
                    {formData.expirationDate && (
                      <div className="grid gap-1.5">
                        <Label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                          Expiration Date
                        </Label>
                        <div className="h-10 px-3 flex items-center justify-between rounded-md border border-orange-200 bg-orange-50 text-sm transition-colors">
                          <span className="font-semibold text-orange-700 tracking-wide">
                            {format(formData.expirationDate, "MMMM dd, yyyy")}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Large Barcode Preview (printable) ──────────────── */}
                <div className="grid gap-1.5">
                  <Label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                    Barcode Preview
                    <span className="text-slate-400 font-normal text-xs">(CODE128)</span>
                  </Label>
                  <div
                    id="barcode-print-area"
                    className={cn(
                      "rounded-xl border-2 flex flex-col items-center justify-center transition-colors min-h-[170px] bg-white p-4 overflow-hidden",
                      barcodeReady
                        ? "border-emerald-200 shadow-sm shadow-emerald-100"
                        : "border-dashed border-slate-200"
                    )}
                  >
                    {barcodeReady ? (
                      <div className="flex justify-center w-full scale-[0.85] origin-center">
                        <BarcodeLabel
                          productName={autoProductName || formData.category}
                          barcode={formData.barcode}
                          productionDate={formData.productionDate ? format(formData.productionDate, "MMM dd, yyyy") : undefined}
                          expiryDate={formData.expirationDate ? format(formData.expirationDate, "MMM dd, yyyy") : undefined}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-6 text-slate-400">
                        <Barcode className="h-10 w-10 opacity-20" />
                        <p className="text-xs">No barcode generated yet</p>
                        <p className="text-[10px] text-slate-300">Select category & type to begin</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Print button */}
                {barcodeReady && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setBarcodeModalOpen(true)}
                    className="h-11 w-full gap-2 border-slate-300 hover:bg-slate-50 font-medium text-sm"
                  >
                    <Printer className="h-4 w-4" />
                    Print Barcode
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Adding…" : "Add Item"}
            </Button>
          </div>
        </form>
      </DialogContent>

      <BarcodeModal
        open={barcodeModalOpen}
        onOpenChange={setBarcodeModalOpen}
        barcode={formData.barcode}
        productName={autoProductName || formData.category}
        productionDate={formData.productionDate ? format(formData.productionDate, "MMM dd, yyyy") : undefined}
        expiryDate={formData.expirationDate ? format(formData.expirationDate, "MMM dd, yyyy") : undefined}
      />

      {/* ── Weight Discrepancy Confirmation Modal ───────────────────────── */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className={cn(
          "max-w-[400px] p-0 overflow-hidden rounded-2xl border-2 shadow-2xl",
          (Math.abs((parseFloat(formData.productionWeight) || 0) - (parseFloat(formData.packingWeight) || 0)) > 5) 
            ? "border-red-100" 
            : "border-amber-100"
        )}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                (Math.abs((parseFloat(formData.productionWeight) || 0) - (parseFloat(formData.packingWeight) || 0)) > 5)
                  ? "bg-red-100 text-red-600"
                  : "bg-amber-100 text-amber-600"
              )}>
                <AlertTriangle className="h-6 w-6" />
              </div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                Confirm Weight Discrepancy
              </DialogTitle>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                There is a weight difference of <span className="font-bold text-slate-900">{Math.abs((parseFloat(formData.productionWeight) || 0) - (parseFloat(formData.packingWeight) || 0)).toFixed(2)} kg</span> between production and packing weight.
                <br /><br />
                This may cause inaccurate inventory records. Do you want to proceed?
              </p>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Production Weight:</span>
                  <span className="text-slate-900 font-bold">{parseFloat(formData.productionWeight) || 0} kg</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Packing Weight:</span>
                  <span className="text-slate-900 font-bold">{parseFloat(formData.packingWeight) || 0} kg</span>
                </div>
                <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Difference:</span>
                  <span className={cn(
                    "font-bold",
                    (Math.abs((parseFloat(formData.productionWeight) || 0) - (parseFloat(formData.packingWeight) || 0)) > 5)
                      ? "text-red-600"
                      : "text-amber-600"
                  )}>
                    +{(Math.abs((parseFloat(formData.productionWeight) || 0) - (parseFloat(formData.packingWeight) || 0))).toFixed(2)} kg
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 pt-1">
                <div className="mt-0.5 h-4 w-4 rounded bg-blue-50 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-blue-500">i</span>
                </div>
                <p className="text-[11px] text-blue-600 font-medium italic">
                  Tip: Please double-check weights to avoid stock inconsistencies.
                </p>
              </div>

              {Math.abs((parseFloat(formData.productionWeight) || 0) - (parseFloat(formData.packingWeight) || 0)) <= 5 && (
                <div className="flex items-center space-x-2 pt-2 border-t border-slate-100 mt-4">
                  <Checkbox 
                    id="dont-show-small" 
                    checked={dontShowSmallDiff}
                    onCheckedChange={(checked) => setDontShowSmallDiff(!!checked)}
                  />
                  <label 
                    htmlFor="dont-show-small"
                    className="text-xs font-medium text-slate-500 cursor-pointer select-none"
                  >
                    Don&apos;t show again for small differences (&lt;5kg)
                  </label>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="bg-slate-50/80 p-4 gap-2 flex-row sm:justify-end">
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmModal(false)}
              className="flex-1 sm:flex-none border-slate-200 hover:bg-white text-slate-600 h-10"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => performSubmit()}
              disabled={loading}
              className={cn(
                "flex-1 sm:flex-none h-10 gap-2 font-semibold shadow-sm",
                (Math.abs((parseFloat(formData.productionWeight) || 0) - (parseFloat(formData.packingWeight) || 0)) > 5)
                  ? "bg-red-600 hover:bg-red-700 text-white shadow-red-200"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20"
              )}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Proceed Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}