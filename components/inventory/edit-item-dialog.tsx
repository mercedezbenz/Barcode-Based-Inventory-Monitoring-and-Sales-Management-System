"use client"

import type React from "react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Lock, AlertTriangle, Save, X, Loader2, MapPin, FileText, Truck } from "lucide-react"
import { TransactionService, CustomerTransactionService } from "@/services/firebase-service"
import { FirebaseService } from "@/services/firebase-service"
import type { InventoryTransaction } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { getRegions, getProvinces, getCities, getBarangays, getZipCode } from "@/lib/ph-address-data"


/* ───────────────────── Helper: parse date safely ───────────────────────── */
function toInputDate(val: any): string {
  if (!val) return ""
  try {
    let d: Date
    if (val instanceof Date) d = val
    else if (val?.toDate && typeof val.toDate === "function") d = val.toDate()
    else d = new Date(val)
    if (isNaN(d.getTime())) return ""
    return d.toISOString().split("T")[0]
  } catch {
    return ""
  }
}

/* ───────────────────── Detect if transaction is Outgoing ───────────────── */
function isOutgoingTransaction(txn: any): boolean {
  const src = (txn.source || "").toLowerCase()
  const mt = (txn.movement_type || "").toLowerCase()
  return src === "delivery" || mt.includes("outgoing")
}

/* ───────────────────── Props ───────────────────────────────────────────── */
interface EditItemDialogProps {
  transaction: InventoryTransaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditItemDialog({ transaction, open, onOpenChange }: EditItemDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  // ─── Form state (non-outgoing: existing fields) ────────────────────────
  const [formData, setFormData] = useState({
    goodReturn: "",
    damageReturn: "",
    avgWeight: "",
    productionDate: "",
    processDate: "",
    expiryDate: "",
    referenceNo: "",
  })

  // ─── Form state (outgoing-only: delivery address fields) ───────────────
  const [addressData, setAddressData] = useState({
    houseNumber: "",
    streetName: "",
    region: "",
    province: "",
    city: "",
    barangay: "",
    zipCode: "",
  })

  // ─── Form state (outgoing-only: transaction document fields) ──────────
  const [docData, setDocData] = useState({
    deliveryDate: "",
    deliveryReceiptNo: "",
    salesInvoiceNo: "",
    transferSlipNo: "",
    processingDate: "",
  })

  // ─── Track if this is an outgoing transaction ─────────────────────────
  const [isOutgoing, setIsOutgoing] = useState(false)
  // ─── Track linked customer_transaction ID ─────────────────────────────
  const [customerTxnId, setCustomerTxnId] = useState<string | null>(null)

  // ─── Address cascading data ────────────────────────────────────────────
  const regions = useMemo(() => getRegions(), [])
  const provinces = useMemo(() => getProvinces(addressData.region), [addressData.region])
  const cities = useMemo(() => getCities(addressData.region, addressData.province), [addressData.region, addressData.province])
  const barangays = useMemo(() => getBarangays(addressData.region, addressData.province, addressData.city), [addressData.region, addressData.province, addressData.city])

  // ─── Find linked customer_transaction ──────────────────────────────────
  const findCustomerTransaction = useCallback(async (txn: any) => {
    try {
      const allCustTxns = await CustomerTransactionService.getTransactions()
      // Match by productBarcode + customerName (most reliable)
      const match = (allCustTxns as any[]).find((ct: any) =>
        ct.productBarcode === txn.barcode &&
        ct.customerName === txn.customer_name
      )
      if (match) {
        setCustomerTxnId(match.id)
        // Also populate address/doc data from customer_transaction if richer
        const ad = match.addressDetails || {}
        if (ad.houseNumber) {
          setAddressData(prev => ({
            houseNumber: prev.houseNumber || ad.houseNumber || "",
            streetName: prev.streetName || ad.streetName || "",
            region: prev.region || ad.region || "",
            province: prev.province || ad.province || "",
            city: prev.city || ad.city || "",
            barangay: prev.barangay || ad.barangay || "",
            zipCode: prev.zipCode || ad.zipCode || "",
          }))
        }
        if (match.deliveryReceiptNo || match.salesInvoiceNo) {
          setDocData(prev => ({
            deliveryDate: prev.deliveryDate || toInputDate(match.deliveryDate),
            deliveryReceiptNo: prev.deliveryReceiptNo || match.deliveryReceiptNo || "",
            salesInvoiceNo: prev.salesInvoiceNo || match.salesInvoiceNo || "",
            transferSlipNo: prev.transferSlipNo || match.transferSlipNo || "",
            processingDate: prev.processingDate || toInputDate(match.processingDate),
          }))
        }
        console.log("[EditItemDialog] Found matching customer_transaction:", match.id)
      } else {
        console.log("[EditItemDialog] No matching customer_transaction found for:", txn.barcode, txn.customer_name)
        setCustomerTxnId(null)
      }
    } catch (err) {
      console.warn("[EditItemDialog] Error finding customer_transaction:", err)
      setCustomerTxnId(null)
    }
  }, [])

  // ─── Sync form data when transaction changes ─────────────────────────
  useEffect(() => {
    if (!transaction) return
    const txn = transaction as any
    const outgoing = isOutgoingTransaction(txn)
    setIsOutgoing(outgoing)

    // ALWAYS set the base form data
    setFormData({
      goodReturn: String(txn.good_return ?? 0),
      damageReturn: String(txn.damage_return ?? 0),
      avgWeight: String(txn.avg_weight ?? txn.incoming_weight ?? txn.outgoing_weight ?? ""),
      productionDate: toInputDate(txn.production_date),
      processDate: toInputDate(txn.process_date),
      expiryDate: toInputDate(txn.expiry_date),
      referenceNo: txn.reference_no || "",
    })

    if (outgoing) {
      // Parse existing address data
      const ad = txn.addressDetails || {}
      setAddressData({
        houseNumber: ad.houseNumber || "",
        streetName: ad.streetName || "",
        region: ad.region || "",
        province: ad.province || "",
        city: ad.city || "",
        barangay: ad.barangay || "",
        zipCode: ad.zipCode || "",
      })

      // Parse existing document data
      // Try to extract DR/SI from reference_no if separate fields don't exist
      const refParts = (txn.reference_no || "").split(" / ")
      setDocData({
        deliveryDate: toInputDate(txn.deliveryDate || txn.delivery_date || txn.process_date),
        deliveryReceiptNo: txn.deliveryReceiptNo || txn.delivery_receipt_no || refParts[0] || "",
        salesInvoiceNo: txn.salesInvoiceNo || txn.sales_invoice_no || refParts[1] || "",
        transferSlipNo: txn.transferSlipNo || txn.transfer_slip_no || "",
        processingDate: toInputDate(txn.processingDate || txn.processing_date || txn.process_date),
      })

      // Try to find matching customer_transaction by barcode + customer_name
      findCustomerTransaction(txn)
    }
  }, [transaction, findCustomerTransaction])



  // ─── Simple field updaters ────────────────────────────────────────────
  const updateField = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  const updateAddress = useCallback((field: string, value: string) => {
    setAddressData(prev => ({ ...prev, [field]: value }))
  }, [])

  const updateDoc = useCallback((field: string, value: string) => {
    setDocData(prev => ({ ...prev, [field]: value }))
  }, [])

  // ─── Cascading address handlers ───────────────────────────────────────
  const handleRegionChange = (region: string) => {
    setAddressData(prev => ({ ...prev, region, province: "", city: "", barangay: "", zipCode: "" }))
  }

  const handleProvinceChange = (province: string) => {
    setAddressData(prev => ({ ...prev, province, city: "", barangay: "", zipCode: "" }))
  }

  const handleCityChange = (city: string) => {
    const zip = getZipCode(addressData.region, addressData.province, city)
    setAddressData(prev => ({ ...prev, city, barangay: "", zipCode: zip }))
  }

  const handleBarangayChange = (barangay: string) => {
    setAddressData(prev => ({ ...prev, barangay }))
  }

  // ─── Build full address string ─────────────────────────────────────────
  const fullAddress = useMemo(() => {
    const parts = [
      addressData.houseNumber.trim(),
      addressData.streetName.trim(),
      addressData.barangay ? `Brgy. ${addressData.barangay}` : "",
      addressData.city,
      addressData.province,
      addressData.region,
    ].filter(Boolean)
    return parts.join(", ")
  }, [addressData])

  // ─── Save handler ─────────────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!transaction) return

    setLoading(true)
    try {
      if (isOutgoing) {
        // ═══ OUTGOING TRANSACTION SAVE ═══
        const referenceNo = [docData.deliveryReceiptNo.trim(), docData.salesInvoiceNo.trim()].filter(Boolean).join(" / ")

        // Build payload for the transactions collection (inventory ledger)
        const txnPayload: any = {
          delivery_address: fullAddress,
          customer_address: fullAddress,
          to_location: fullAddress,
          addressDetails: {
            houseNumber: addressData.houseNumber,
            streetName: addressData.streetName,
            barangay: addressData.barangay,
            city: addressData.city,
            province: addressData.province,
            region: addressData.region,
            zipCode: addressData.zipCode,
          },
          reference_no: referenceNo,
          deliveryDate: docData.deliveryDate ? new Date(docData.deliveryDate + "T00:00:00") : null,
          deliveryReceiptNo: docData.deliveryReceiptNo.trim(),
          salesInvoiceNo: docData.salesInvoiceNo.trim(),
          transferSlipNo: docData.transferSlipNo.trim() || null,
          processingDate: docData.processingDate ? new Date(docData.processingDate + "T00:00:00") : null,
          process_date: docData.processingDate ? new Date(docData.processingDate + "T00:00:00") : null,
          updatedAt: new Date(),
        }

        console.log("Updating transaction:", txnPayload)
        console.log("Transaction ID:", transaction.id)

        // 1. Update the transactions collection (inventory ledger)
        await TransactionService.updateTransaction(transaction.id, txnPayload)

        // 2. Also update customer_transactions if we found a match
        if (customerTxnId) {
          const custPayload: any = {
            customerAddress: fullAddress,
            delivery_address: fullAddress,
            addressDetails: {
              houseNumber: addressData.houseNumber,
              streetName: addressData.streetName,
              barangay: addressData.barangay,
              city: addressData.city,
              province: addressData.province,
              region: addressData.region,
              zipCode: addressData.zipCode,
            },
            deliveryDate: docData.deliveryDate ? new Date(docData.deliveryDate + "T00:00:00") : null,
            deliveryReceiptNo: docData.deliveryReceiptNo.trim(),
            salesInvoiceNo: docData.salesInvoiceNo.trim(),
            transferSlipNo: docData.transferSlipNo.trim() || null,
            processingDate: docData.processingDate ? new Date(docData.processingDate + "T00:00:00") : null,
            transactionDocuments: {
              transaction_type: "outgoing",
              source: "delivery",
              delivery_date: docData.deliveryDate ? new Date(docData.deliveryDate + "T00:00:00") : null,
              delivery_receipt_no: docData.deliveryReceiptNo.trim(),
              sales_invoice_no: docData.salesInvoiceNo.trim(),
              transfer_slip_no: docData.transferSlipNo.trim() || null,
            },
            updatedAt: new Date(),
          }

          console.log("Updating customer_transaction:", custPayload)
          console.log("Customer Transaction ID:", customerTxnId)

          await CustomerTransactionService.updateTransaction(customerTxnId, custPayload)
        }

        // 3. Log the edit
        try {
          await FirebaseService.addDocument("inventory_logs", {
            action: "EDIT_OUTGOING_TRANSACTION",
            transactionId: transaction.id,
            customerTransactionId: customerTxnId || null,
            productName: (transaction as any).product_name,
            barcode: (transaction as any).barcode,
            changes: {
              delivery_address: fullAddress,
              deliveryReceiptNo: docData.deliveryReceiptNo,
              salesInvoiceNo: docData.salesInvoiceNo,
              transferSlipNo: docData.transferSlipNo,
              deliveryDate: docData.deliveryDate,
              processingDate: docData.processingDate,
            },
            editedAt: new Date(),
          })
        } catch (logErr) {
          console.warn("[EditItemDialog] Failed to log adjustment:", logErr)
        }
      } else {
        // ═══ NON-OUTGOING TRANSACTION SAVE (existing behavior) ═══
        const goodReturn = Math.max(0, parseFloat(formData.goodReturn) || 0)
        const damageReturn = Math.max(0, parseFloat(formData.damageReturn) || 0)
        const avgWeight = Math.max(0, parseFloat(formData.avgWeight) || 0)

        const updateData: any = {
          good_return: goodReturn,
          damage_return: damageReturn,
          avg_weight: avgWeight,
          reference_no: formData.referenceNo,
          production_date: formData.productionDate ? new Date(formData.productionDate + "T00:00:00") : null,
          process_date: formData.processDate ? new Date(formData.processDate + "T00:00:00") : null,
          expiry_date: formData.expiryDate ? new Date(formData.expiryDate + "T00:00:00") : null,
          updatedAt: new Date(),
        }

        await TransactionService.updateTransaction(transaction.id, updateData)

        try {
          await FirebaseService.addDocument("inventory_logs", {
            action: "EDIT_TRANSACTION",
            transactionId: transaction.id,
            productName: (transaction as any).product_name,
            barcode: (transaction as any).barcode,
            changes: {
              good_return: goodReturn,
              damage_return: damageReturn,
              avg_weight: avgWeight,
              reference_no: formData.referenceNo,
            },
            editedAt: new Date(),
          })
        } catch (logErr) {
          console.warn("[EditItemDialog] Failed to log adjustment:", logErr)
        }
      }

      toast({
        title: "✅ Inventory Updated",
        description: isOutgoing
          ? "Delivery address and document details have been updated successfully."
          : "Inventory item has been updated successfully.",
      })
      onOpenChange(false)
    } catch (error: any) {
      console.error("[EditItemDialog] Save failed:", error)
      toast({
        title: "❌ Update Failed",
        description: error?.message || "Failed to update the record. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (!transaction) return null

  const txn = transaction as any

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!w-[92vw] !max-w-[1200px] !max-h-[none] !overflow-visible !p-0"
      >
        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              {isOutgoing && <Truck className="h-5 w-5 text-sky-500" />}
              {isOutgoing ? "Edit Outgoing Transaction" : "Edit Inventory Item"}
            </DialogTitle>
            <DialogDescription>
              {isOutgoing
                ? "Update delivery address and transaction document details. Stock quantities cannot be changed."
                : "Update returns, weight, dates, location, and reference info. Product identity cannot be changed."
              }
            </DialogDescription>
          </DialogHeader>

          {/* Warning Banner */}
          <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 mt-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 shrink-0">
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-700">Stock Editing Restricted</p>
              <p className="text-xs text-red-600/80">
                Stock quantities cannot be edited here. Use <strong>Add Item</strong> for incoming stock or <strong>Outgoing Stock</strong> for deductions.
              </p>
            </div>
          </div>

          {/* Product Identity Bar */}
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 border border-gray-200 dark:bg-gray-900/50 dark:border-gray-800 px-4 py-3 mt-3">
            <Lock className="h-4 w-4 text-gray-400 shrink-0" />
            <div className="min-w-0 flex-1 flex items-center gap-4 text-sm">
              <span className="font-semibold text-foreground truncate">{txn.product_name || "—"}</span>
              <span className="text-muted-foreground font-mono text-xs">{txn.barcode || "—"}</span>
              <span className="text-muted-foreground text-xs">{txn.category || "—"} · {txn.type || "—"}</span>
              {isOutgoing && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-red-100 text-red-700 border-red-200">
                  OUTGOING
                </span>
              )}
              {!isOutgoing && (() => {
                const ut = (txn.unit_type || "BOX").toUpperCase()
                return ut === "PACK" ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-green-100 text-green-700 border-green-200">PACK</span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-blue-100 text-blue-700 border-blue-200">BOX</span>
                )
              })()}
            </div>
          </div>

          {/* Outgoing: show customer name (read-only) */}
          {isOutgoing && txn.customer_name && (
            <div className="flex items-center gap-3 rounded-xl bg-sky-50 border border-sky-200 dark:bg-sky-950/20 dark:border-sky-800 px-4 py-2.5 mt-2">
              <Truck className="h-4 w-4 text-sky-500 shrink-0" />
              <div className="min-w-0 flex-1 flex items-center gap-3 text-sm">
                <span className="text-sky-600 text-xs font-semibold uppercase">Customer:</span>
                <span className="font-medium text-foreground">{txn.customer_name}</span>
              </div>
              <Lock className="h-3.5 w-3.5 text-sky-400 shrink-0" />
            </div>
          )}
        </div>

        {/* ── FORM BODY ──────────────────────────────────────────────── */}
        <form onSubmit={handleSave}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 items-stretch">

            {isOutgoing ? (
              <>
                {/* ════════════════ OUTGOING: LEFT COLUMN — Delivery Address ════════════════ */}
                <div className="flex flex-col gap-4">
                  <div className="rounded-xl border border-sky-100 bg-sky-50/40 dark:bg-sky-950/20 dark:border-sky-900 p-4 grid gap-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-sky-500" />
                      <p className="text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">Delivery Address</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5">
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">House / Block / Lot No.</Label>
                        <Input
                          type="text"
                          placeholder="e.g. Blk 5, Lot 12"
                          value={addressData.houseNumber}
                          onChange={(e) => updateAddress("houseNumber", e.target.value)}
                          className="h-10"
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Street Name</Label>
                        <Input
                          type="text"
                          placeholder="e.g. Rizal Ave."
                          value={addressData.streetName}
                          onChange={(e) => updateAddress("streetName", e.target.value)}
                          className="h-10"
                        />
                      </div>
                    </div>

                    {/* Region */}
                    <div className="grid gap-1.5">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Region</Label>
                      <Select value={addressData.region} onValueChange={handleRegionChange}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select region" />
                        </SelectTrigger>
                        <SelectContent>
                          {regions.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Province */}
                    <div className="grid gap-1.5">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Province</Label>
                      <Select value={addressData.province} onValueChange={handleProvinceChange} disabled={!addressData.region}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder={addressData.region ? "Select province" : "Select region first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {provinces.map((p) => (
                            <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* City / Municipality */}
                    <div className="grid gap-1.5">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">City / Municipality</Label>
                      <Select value={addressData.city} onValueChange={handleCityChange} disabled={!addressData.province}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder={addressData.province ? "Select city" : "Select province first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {cities.map((c) => (
                            <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Barangay */}
                    <div className="grid gap-1.5">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Barangay</Label>
                      <Select value={addressData.barangay} onValueChange={handleBarangayChange} disabled={!addressData.city}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder={addressData.city ? "Select barangay" : "Select city first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {barangays.map((b) => (
                            <SelectItem key={b} value={b}>{b}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Computed Address Preview */}
                    {fullAddress && (
                      <div className="rounded-lg bg-white dark:bg-slate-800 border border-sky-200 dark:border-sky-800 px-3 py-2.5 mt-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-500 mb-1">Preview Address</p>
                        <p className="text-sm text-foreground leading-relaxed">{fullAddress}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ════════════════ OUTGOING: RIGHT COLUMN — Document Details ════════════════ */}
                <div className="flex flex-col gap-4">
                  <div className="rounded-xl border border-amber-100 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900 p-4 grid gap-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-amber-500" />
                      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">Transaction Document Details</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5">
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Delivery Date</Label>
                        <Input
                          type="date"
                          value={docData.deliveryDate}
                          onChange={(e) => updateDoc("deliveryDate", e.target.value)}
                          className="h-10"
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Processing Date</Label>
                        <Input
                          type="date"
                          value={docData.processingDate}
                          onChange={(e) => updateDoc("processingDate", e.target.value)}
                          className="h-10"
                        />
                      </div>
                    </div>

                    <div className="grid gap-1.5">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Delivery Receipt No. (DR No.)</Label>
                      <Input
                        type="text"
                        placeholder="e.g. DR-00123"
                        value={docData.deliveryReceiptNo}
                        onChange={(e) => updateDoc("deliveryReceiptNo", e.target.value)}
                        className="h-10"
                      />
                    </div>

                    <div className="grid gap-1.5">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sales Invoice No. (SI No.)</Label>
                      <Input
                        type="text"
                        placeholder="e.g. SI-00789"
                        value={docData.salesInvoiceNo}
                        onChange={(e) => updateDoc("salesInvoiceNo", e.target.value)}
                        className="h-10"
                      />
                    </div>

                    <div className="grid gap-1.5">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Transfer Slip No. <span className="text-slate-400 font-normal">(optional)</span>
                      </Label>
                      <Input
                        type="text"
                        placeholder="e.g. TS-00456"
                        value={docData.transferSlipNo}
                        onChange={(e) => updateDoc("transferSlipNo", e.target.value)}
                        className="h-10"
                      />
                    </div>
                  </div>

                  {/* Locked Fields Info */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/40 dark:bg-slate-900/20 dark:border-slate-800 p-4 grid gap-3">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-slate-400" />
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Locked Fields (Read-Only)</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs block">Quantity</span>
                        <span className="font-semibold text-foreground">
                          {txn.outgoing_packs ?? txn.outgoing_qty ?? "—"} {(txn.outgoing_unit || txn.unit_type || "box").toUpperCase() === "PACK" ? "Packs" : "Boxes"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs block">Avg Weight</span>
                        <span className="font-semibold text-foreground">
                          {txn.avg_weight ? `${txn.avg_weight} kg` : "—"}
                        </span>
                      </div>
                    </div>

                    {customerTxnId && (
                      <p className="text-[10px] text-emerald-600 flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Linked to customer transaction: {customerTxnId.substring(0, 8)}…
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* ════════════════ NON-OUTGOING: LEFT COLUMN ════════════════ */}
                <div className="flex flex-col gap-4">
                  {/* Returns Section */}
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-900 p-4 grid gap-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Returns</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5">
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Good Return</Label>
                        <Input
                          type="number" min="0" placeholder="e.g. 5"
                          value={formData.goodReturn}
                          onChange={(e) => updateField("goodReturn", e.target.value)}
                          className="h-10"
                        />
                        <p className="text-[10px] text-muted-foreground">Adds back to available stock</p>
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Damage Return</Label>
                        <Input
                          type="number" min="0" placeholder="e.g. 2"
                          value={formData.damageReturn}
                          onChange={(e) => updateField("damageReturn", e.target.value)}
                          className="h-10"
                        />
                        <p className="text-[10px] text-muted-foreground">Tracked as loss only</p>
                      </div>
                    </div>
                  </div>

                  {/* Weight Section */}
                  <div className="rounded-xl border border-blue-100 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-900 p-4 grid gap-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-blue-500 dark:text-blue-400">Weight</p>
                    <div className="grid gap-1.5">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Average Weight (kg)</Label>
                      <Input
                        type="number" min="0" step="0.01" placeholder="e.g. 25.00"
                        value={formData.avgWeight}
                        onChange={(e) => updateField("avgWeight", e.target.value)}
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>

                {/* ════════════════ NON-OUTGOING: RIGHT COLUMN ════════════════ */}
                <div className="flex flex-col gap-4">
                  {/* Dates Section */}
                  <div className="rounded-xl border border-amber-100 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900 p-4 grid gap-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">Dates</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="grid gap-1.5">
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Production Date</Label>
                        <Input type="date" value={formData.productionDate} onChange={(e) => updateField("productionDate", e.target.value)} className="h-10" />
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Process Date</Label>
                        <Input type="date" value={formData.processDate} onChange={(e) => updateField("processDate", e.target.value)} className="h-10" />
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Expiry Date</Label>
                        <Input type="date" value={formData.expiryDate} onChange={(e) => updateField("expiryDate", e.target.value)} className="h-10" />
                      </div>
                    </div>
                  </div>


                  {/* Reference Section */}
                  <div className="rounded-xl border border-gray-200 bg-gray-50/40 dark:bg-gray-950/20 dark:border-gray-800 p-4 grid gap-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">Reference</p>
                    <div className="grid gap-1.5">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Reference No.</Label>
                      <Input
                        type="text" placeholder="e.g. DR-1023 / INV-2024"
                        value={formData.referenceNo}
                        onChange={(e) => updateField("referenceNo", e.target.value)}
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── FOOTER ─────────────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/60 bg-gray-50/50 dark:bg-muted/20 rounded-b-xl">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-10 px-5"
            >
              <X className="h-4 w-4 mr-1.5" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
