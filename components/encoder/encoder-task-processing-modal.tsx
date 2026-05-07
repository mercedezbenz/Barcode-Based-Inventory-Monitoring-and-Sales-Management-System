"use client"

import { useState, useEffect, useCallback } from "react"
import { doc, updateDoc, collection, addDoc, serverTimestamp, runTransaction, increment, getDoc } from "firebase/firestore"
import { getFirebaseDb, auth } from "@/lib/firebase-live"
import { FirebaseService } from "@/services/firebase-service"
import { InventoryItem } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Package, Clock, AlertTriangle, ShieldCheck, ChevronRight, CheckCircle2, CalendarDays } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { updateOrderStatus } from "@/lib/order-utils"


interface EncoderTaskProcessingModalProps {
  task: any
  isOpen: boolean
  onClose: () => void
}

export function EncoderTaskProcessingModal({ task, isOpen, onClose }: EncoderTaskProcessingModalProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [planState, setPlanState] = useState<any[]>([])

  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationState, setVerificationState] = useState<any[]>([])
  const [scannerInput, setScannerInput] = useState("")
  
  // Real-time verification variables
  const [scannedBarcodes, setScannedBarcodes] = useState<string[]>([])
  const [isFifoOverridden, setIsFifoOverridden] = useState(false)

  // Fetch all inventory (matching inventory dashboard)
  useEffect(() => {
    if (isOpen) {
      const s = (task.status || "").toUpperCase()
      if ((s === "FOR_VERIFICATION" || s === "COMPLETED") && task.selectedStocks) {
        setIsVerifying(true);
        // Persist scanning states across closes by initializing safely
        setVerificationState(task.selectedStocks.map((b: any) => ({ ...b, scannedQty: b.scannedQty || 0 })));
        setScannedBarcodes(task.scannedBarcodes || []);
      } else {
        setIsVerifying(false);
        setVerificationState([]);
      }

      setLoading(true)
      FirebaseService.getCollection<InventoryItem>("inventory")
        .then((invData) => {
          setInventory(invData);
        })
        .finally(() => setLoading(false))
    }
  }, [isOpen, task])

  const getProcessingPlan = useCallback(() => {
    const plan: any[] = []
    
    // Deduplicate batches by barcode or ID to prevent ghost duplicates
    const uniqueBatches = Array.from(
      new Map(
        inventory.map((item: any) => [
          item.barcode || item.batchNumber || item.id,
          item
        ])
      ).values()
    )

    // Filter only valid stock using weight fields
    const invMap = uniqueBatches.map((inv: any) => {
      const incoming = inv.incoming_weight ?? inv.production_weight ?? inv.incoming ?? 0
      const outgoing = inv.outgoing_weight ?? inv.outgoing ?? 0
      const good = inv.good_return_weight ?? inv.goodReturnStock ?? 0
      const bad = inv.damage_return_weight ?? inv.damageReturnStock ?? 0
      const remainingWeight = Math.max(0, incoming - outgoing + good - bad)
      return { ...inv, remainingWeight }
    }).filter(item => item.remainingWeight > 0)

    task.items?.forEach((item: any) => {
      const requiredWeight = item.quantity || 0
      
      const itemPlan = {
        name: item.name,
        needed: requiredWeight,
        unit: "kg",
        batches: [] as any[],
        isExpanded: true,
      }

      const orderName = item.name || "";
      
      let matchingBatches = invMap.filter(inv => {
        const invName = inv.productName || inv.name || "";
        const isArchived = Boolean((inv as any).isDeleted) || Boolean((inv as any).archived);
        return invName === orderName && inv.remainingWeight > 0 && !isArchived;
      });
      
      // Sort FIFO
      matchingBatches.sort((a, b) => {
        const aExp = a.expirationDate || a.expiryDate;
        const bExp = b.expirationDate || b.expiryDate;
        const aTimeExp = aExp?.seconds ? aExp.seconds * 1000 : (aExp?.toDate ? aExp.toDate().getTime() : Infinity);
        const bTimeExp = bExp?.seconds ? bExp.seconds * 1000 : (bExp?.toDate ? bExp.toDate().getTime() : Infinity);
        if (aTimeExp !== bTimeExp) return aTimeExp - bTimeExp;
        const aAdd = a.createdAt;
        const bAdd = b.createdAt;
        const aTimeAdd = aAdd?.seconds ? aAdd.seconds * 1000 : (aAdd?.toDate ? aAdd.toDate().getTime() : Infinity);
        const bTimeAdd = bAdd?.seconds ? bAdd.seconds * 1000 : (bAdd?.toDate ? bAdd.toDate().getTime() : Infinity);
        return aTimeAdd - bTimeAdd;
      });

      let remainingToFill = requiredWeight;

      for (const inv of matchingBatches) {
        let weightToTake = 0;
        const availableWeight = inv.remainingWeight;
        const weightPerBox = 25; // Business Rule: 1 BOX = 25 KG

        if (availableWeight > 0 && remainingToFill > 0) {
           weightToTake = Math.min(availableWeight, remainingToFill);
           remainingToFill = Math.max(0, remainingToFill - weightToTake);
        }

        itemPlan.batches.push({
          inventoryId: inv.id,
          barcode: (inv as any).batchNumber || inv.barcode || "N/A", 
          productName: inv.name || (inv as any).productName || item.name || "",
          productId: (inv as any).product_id || "",
          category: inv.category || "",
          availableWeight: availableWeight,
          selectedWeight: weightToTake,
          weightPerBox: weightPerBox,
          expiryDate: inv.expirationDate || inv.expiryDate,
          createdAt: inv.createdAt,
          uiExpanded: weightToTake > 0
        });
      }

      plan.push(itemPlan)
    })
    return plan
  }, [inventory, task.items])

  useEffect(() => {
    if (inventory.length > 0) {
      setPlanState(getProcessingPlan())
    }
  }, [inventory, getProcessingPlan])

  // Step 1: Confirmation explicitly seals exact selections in Firebase database
  const handleConfirmSelection = async () => {
    if (!auth.currentUser) return toast.error("User not authenticated")
    
    // Safety guard: block submission if any product is not fully fulfilled (based on weight)
    const unfulfilled = planState.find(p => {
      const totalSelectedKg = p.batches.reduce((sum: number, b: any) => sum + (Number(b.selectedWeight) || 0), 0);
      return totalSelectedKg < p.needed;
    });
    if (unfulfilled) {
      toast.error(`Incomplete selection for "${unfulfilled.name}". Please fulfill required weight (kg) before confirming.`);
      return;
    }
    
    setProcessing(true)
    try {
      const selectedBatches: any[] = []
      for (const p of planState) {
        for (const b of p.batches) {
          if (b.selectedWeight > 0) {
            selectedBatches.push({
              itemName: p.name,
              productName: b.productName || p.name || "",
              productId: b.productId || "",
              category: b.category || "",
              inventoryId: b.inventoryId,
              barcode: b.barcode,
              requiredWeight: b.selectedWeight,
              availableWeight: b.availableWeight,
              weightPerBox: b.weightPerBox,
              scannedWeight: 0,
              dateAdded: b.createdAt || null,
            })
          }
        }
      }

      const db = getFirebaseDb()
      await updateDoc(doc(db, "encoder_tasks", task.id), {
        selectedStocks: selectedBatches,
        status: "FOR_VERIFICATION",
        scanned: false
      })

      // Fix applied here
      await updateOrderStatus(task.orderId, "in_production")

      toast.success("Selection confirmed! Task moved to Verification tab.")
      onClose() // Close the modal so it appears in the next tab

    } catch (error: any) {
      toast.error("Failed to lock selection: " + error.message)
    } finally {
      setProcessing(false)
    }
  }

  // Step 2: Handle barcode scan — 1 scan = deduct full allocated weight
  const handleScan = async () => {
    console.log("[ENCODER_SCAN] handleScan called")
    
    if (task.status !== "FOR_VERIFICATION") {
      console.log("[ENCODER_SCAN] ❌ Scan blocked - not in verification stage")
      return
    }

    const code = scannerInput.trim()
    if (!code || processing) return
    setScannerInput("")

    // Find matching batch in selectedStocks
    const batchIdx = verificationState.findIndex((b) => b.barcode === code)
    if (batchIdx === -1) {
      toast.error("Invalid barcode. This batch is not part of the current order.")
      return
    }
    
    const batch = verificationState[batchIdx]
    const deductionWeight = batch.requiredWeight || 0
    
    // Prevent double scan if batch already fully verified
    if (batch.scanned) {
      toast.error(`Batch ${code} is already verified!`)
      return
    }

    if (deductionWeight <= 0) {
      toast.error("No weight to deduct for this batch.")
      return
    }

    console.log("[ENCODER_SCAN] SCAN TRIGGERED")
    console.log("[ENCODER_SCAN] BATCH:", batch)
    console.log("[ENCODER_SCAN] DEDUCTION WEIGHT:", deductionWeight, "kg")

    setProcessing(true)
    try {
      const db = getFirebaseDb()

      // ── 1. ATOMIC INVENTORY DEDUCTION ──────────────────────────────────
      // Use Firestore getDoc for fresh data + updateDoc with computed value
      // This avoids stale local state bugs
      const inventoryDocRef = doc(db, "inventory", batch.inventoryId)
      const inventorySnap = await getDoc(inventoryDocRef)
      
      if (!inventorySnap.exists()) {
        toast.error("Inventory item not found in database.")
        return
      }

      const liveInvData = inventorySnap.data()
      const currentOutgoingWeight = liveInvData.outgoing_weight || 0
      const currentIncomingWeight = liveInvData.incoming_weight ?? liveInvData.production_weight ?? 0
      const currentGoodReturn = liveInvData.good_return_weight ?? 0
      const currentDamageReturn = liveInvData.damage_return_weight ?? 0
      const newOutgoingWeight = currentOutgoingWeight + deductionWeight
      const newRemainingWeight = Math.max(0, currentIncomingWeight - newOutgoingWeight + currentGoodReturn - currentDamageReturn)
      const isDepleted = newRemainingWeight <= 0

      console.log("[ENCODER_SCAN] Inventory state:", {
        currentOutgoing: currentOutgoingWeight,
        incoming: currentIncomingWeight,
        newOutgoing: newOutgoingWeight,
        newRemaining: newRemainingWeight,
        isDepleted
      })

      // Update inventory document: increment outgoing_weight, set status if depleted
      await updateDoc(inventoryDocRef, {
        outgoing_weight: newOutgoingWeight,
        ...(isDepleted ? { status: "OUT_OF_STOCK" } : {})
      })

      // ── 2. CREATE TRANSACTION LOG (OUT) ────────────────────────────────
      // Fields aligned with what inventory-table.tsx grouping logic expects
      const productName = batch.itemName || batch.productName || liveInvData.name || liveInvData.productName || liveInvData.category || "Unknown Product"
      const productCategory = batch.category || liveInvData.category || ""
      const barcodeBase = batch.barcode_base || liveInvData.barcode_base || null
      const productId = batch.productId || liveInvData.product_id || null

      console.log("[ENCODER_SCAN] BATCH DATA:", { itemName: batch.itemName, productName: batch.productName, barcode: batch.barcode, productId: batch.productId, category: batch.category })
      console.log("[ENCODER_SCAN] LIVE INV DATA:", { name: liveInvData.name, productName: liveInvData.productName, category: liveInvData.category, product_id: liveInvData.product_id })
      console.log("[ENCODER_SCAN] TRANSACTION SAVED:", { product_name: productName, barcode: batch.barcode, weight: deductionWeight })

      await addDoc(collection(db, "transactions"), {
        // Core fields for inventory table grouping
        type: "OUT",
        movement_type: "Outgoing",
        product_name: productName,
        barcode: batch.barcode,
        barcode_base: barcodeBase,
        category: productCategory,
        product_id: productId,
        
        // Weight fields (critical — inventory table reads these)
        outgoing_weight: deductionWeight,
        outgoing_qty: Math.ceil(deductionWeight / 25),
        incoming_weight: 0,
        incoming_qty: 0,
        good_return_weight: 0,
        good_return: 0,
        damage_return_weight: 0,
        damage_return: 0,
        stock_left: newRemainingWeight,
        weight_left: newRemainingWeight,
        
        // Reference info
        source: "encoder_verification",
        reference_no: `ENCODER_SCAN_${task.orderId}`,
        orderId: task.orderId,
        inventoryId: batch.inventoryId,
        customer_name: task.customerName || "",
        sales_invoice_no: task.salesInvoiceNo || task.salesInvoiceNumber || null,
        delivery_receipt_no: task.deliveryReceiptNo || task.deliveryReceiptNumber || null,
        
        // Timestamps
        transaction_date: serverTimestamp(),
        created_at: serverTimestamp(),
      })

      // ── 3. UPDATE LOCAL INVENTORY STATE ────────────────────────────────
      // Keep local state in sync so subsequent scans don't use stale data
      setInventory(prev =>
        prev.map(item =>
          item.id === batch.inventoryId
            ? { ...item, outgoing_weight: newOutgoingWeight } as any
            : item
        )
      )

      // ── 4. UPDATE LOCAL VERIFICATION STATE ─────────────────────────────
      const newState = [...verificationState]
      newState[batchIdx] = { 
        ...newState[batchIdx], 
        scannedWeight: deductionWeight,
        scanned: true,
        scannedAt: new Date().toISOString(),
        // Update available weight so UI reflects deduction
        availableWeight: Math.max(0, (batch.availableWeight || 0) - deductionWeight)
      }
      setVerificationState(newState)

      // ── 5. TRACK SCANNED BARCODES ──────────────────────────────────────
      const newScannedBarcodes = [...scannedBarcodes, code]
      setScannedBarcodes(newScannedBarcodes)

      // ── 6. UPDATE ENCODER TASK IN FIRESTORE ────────────────────────────
      await updateDoc(doc(db, "encoder_tasks", task.id), {
        selectedStocks: newState,
        scannedBarcodes: newScannedBarcodes,
        scannedCount: newScannedBarcodes.length,
        lastScannedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      // ── 7. AUDIO FEEDBACK ─────────────────────────────────────────────
      try { 
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const osc = audioCtx.createOscillator()
        const gain = audioCtx.createGain()
        osc.connect(gain)
        gain.connect(audioCtx.destination)
        osc.frequency.value = 1200
        gain.gain.value = 0.15
        osc.start()
        osc.stop(audioCtx.currentTime + 0.1)
      } catch {}

      toast.success(`✔ Verified & deducted ${deductionWeight.toFixed(1)}kg for ${productName}`)

      // ── 8. CHECK COMPLETION ────────────────────────────────────────────
      const allDone = newState.every((b: any) => b.scanned === true)
      
      if (allDone) {
        // Move task to FOR_DELIVERY
        await updateDoc(doc(db, "encoder_tasks", task.id), {
          status: "FOR_DELIVERY",
          scanned: true,
          updatedAt: serverTimestamp()
        })

        console.log("[ENCODER_SCAN] STATUS UPDATE → IN TRANSIT after scan complete")
        await updateOrderStatus(task.orderId, "in_transit")

        toast.success("🎉 All batches verified! Task moved to For Delivery.")
        onClose()
      }

    } catch (err: any) {
      console.error("[ENCODER_SCAN] Error during scan:", err)
      toast.error(err.message || "Stock unavailable or already deducted")
    } finally {
      setProcessing(false)
    }
  }

  // Validate that ALL products have their required quantity fully met (in kg)
  const isFullyFulfilled = planState.length > 0 && planState.every(p => {
    const totalSelectedKg = p.batches.reduce((sum: number, b: any) => sum + (Number(b.selectedWeight) || 0), 0);
    return totalSelectedKg >= p.needed;
  });
  
  // Compute totals for the warning message
  const selectionSummary = planState.map(p => {
    const totalSelectedKg = p.batches.reduce((sum: number, b: any) => sum + (Number(b.selectedWeight) || 0), 0);
    return { name: p.name, needed: p.needed, selected: totalSelectedKg, remaining: Math.max(0, p.needed - totalSelectedKg) };
  });
  const hasIncompleteItems = selectionSummary.some(s => s.remaining > 0);

  const disableConfirm = !isFullyFulfilled || loading || processing;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !processing && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Process Encoder Task</DialogTitle>
          <DialogDescription>
            Review the FIFO distribution for Order #{task.orderId}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 dark:bg-secondary/30 p-4 rounded-lg border border-gray-100 dark:border-border">
            <div>
              <span className="text-gray-500 block mb-1">Customer</span>
              <span className="font-semibold">{task.customerName}</span>
            </div>
            <div>
              <span className="text-gray-500 block mb-1">Sales Invoice No.</span>
              <span className="font-mono">{task.salesInvoiceNo || task.salesInvoiceNumber || "N/A"}</span>
            </div>
          </div>

          <div className="space-y-4">
            {isVerifying ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Overall progress */}
                {(() => {
                  const totalRequiredKg = verificationState.reduce((s: number, b: any) => s + (b.requiredWeight || 0), 0);
                  const totalScannedKg = verificationState.reduce((s: number, b: any) => s + (b.scannedWeight || 0), 0);
                  const allDone = totalScannedKg >= totalRequiredKg;
                  return (
                    <div className={cn("px-6 py-5 rounded-xl border", allDone ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30" : "bg-sky-50 dark:bg-sky-950/20 border-sky-100 dark:border-sky-900/30")}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className={cn("text-[15px] font-bold", allDone ? "text-emerald-900 dark:text-emerald-300" : "text-sky-900 dark:text-sky-300")}>
                          {allDone ? "✅ Verification Complete" : "Scan Barcodes to Verify"}
                        </h3>
                        <span className={cn("text-sm font-black px-3 py-1 rounded-full border", allDone ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-sky-100 text-sky-700 border-sky-200")}>
                          {totalScannedKg.toFixed(1)} / {totalRequiredKg.toFixed(1)} kg
                        </span>
                      </div>
                      <p className={cn("text-xs mb-4 font-medium", allDone ? "text-emerald-600/80" : "text-sky-600/80")}>
                        {allDone ? "All weight verified and deducted from inventory." : "Scan each barcode once to verify and deduct the full allocated weight for that batch."}
                      </p>
                      
                      {/* Progress bar */}
                      <div className="h-2.5 w-full bg-white/60 dark:bg-black/20 rounded-full overflow-hidden shadow-inner mb-4">
                        <div 
                          className={cn("h-full transition-all duration-500 ease-out rounded-full", allDone ? "bg-emerald-500" : "bg-sky-500")}
                          style={{ width: `${totalRequiredKg > 0 ? Math.min(100, (totalScannedKg / totalRequiredKg) * 100) : 0}%` }}
                        />
                      </div>
                      
                      {!allDone && (
                        <div className="relative">
                          <Input 
                            autoFocus
                            placeholder={processing ? "Processing scan..." : "Scan or type barcode and press Enter..."} 
                            value={scannerInput}
                            onChange={(e) => setScannerInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleScan()
                            }}
                            disabled={processing}
                            className={cn("h-12 text-center font-mono font-bold text-lg shadow-inner bg-white dark:bg-black/50", processing && "opacity-50")}
                          />
                          {processing && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-black/30 rounded-md">
                              <div className="flex items-center gap-2 text-sky-600 font-bold text-sm">
                                <div className="h-4 w-4 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                                Deducting...
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="grid gap-3">
                  {verificationState.map((b, idx) => {
                    const scannedKg = b.scannedWeight || 0;
                    const requiredKg = b.requiredWeight || 0;
                    const isFullyScanned = b.scanned === true || scannedKg >= requiredKg;
                    return (
                      <div key={idx} className={cn(
                        "p-4 rounded-xl border transition-all duration-300",
                        isFullyScanned 
                          ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50" 
                          : "bg-white border-gray-200 dark:bg-card dark:border-border"
                      )}>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2.5">
                            {isFullyScanned ? (
                              <div className="h-7 w-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                                <CheckCircle2 className="h-4 w-4 text-white" />
                              </div>
                            ) : (
                              <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                <Package className="h-3.5 w-3.5 text-slate-400" />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-foreground">{b.itemName}</p>
                              <p className="text-xs font-mono text-gray-500">{b.barcode}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={cn("text-[17px] font-black tabular-nums", 
                              isFullyScanned ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"
                            )}>
                              {scannedKg.toFixed(1)} / {requiredKg.toFixed(1)} kg
                            </span>
                            <p className={cn("text-[10px] font-bold uppercase tracking-wider mt-0.5", 
                              isFullyScanned ? "text-emerald-500" : "text-gray-400"
                            )}>
                              {isFullyScanned ? "✓ Verified & Deducted" : `Awaiting scan (${Math.ceil(requiredKg / 25)} boxes)`}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <>
                <h3 className="font-semibold text-gray-900 dark:text-foreground flex items-center gap-2">
                  <Package className="h-4 w-4 text-sky-500" />
                  Step 1: Stock Selection Plan
                </h3>
            
            {loading ? (
              <div className="py-8 text-center text-gray-500 text-sm">Loading available batches...</div>
            ) : (
              <div className="space-y-4">
                {/* FIFO Control Panel */}
                <div className="flex justify-between items-center bg-sky-50 dark:bg-sky-950/20 p-3.5 rounded-xl border border-sky-100 dark:border-sky-900/50 mb-4 shadow-sm">
                  <div>
                    <h4 className="text-sm font-bold text-sky-900 dark:text-sky-300 flex items-center gap-2">
                       {isFifoOverridden ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : <ShieldCheck className="h-4 w-4 text-emerald-500" />}
                       Allocation Model: {isFifoOverridden ? "Manual Override" : "Strict FIFO"}
                    </h4>
                    <p className="text-xs text-sky-700/80 dark:text-sky-400/80 mt-0.5">
                      {isFifoOverridden ? "You are freely allocating stock. Please ensure correctness." : "Automatically distributing oldest stock first."}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {isFifoOverridden ? (
                      <Button variant="outline" className="h-9 px-3 gap-2 text-xs bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-bold rounded-lg" onClick={() => {
                        setPlanState(getProcessingPlan())
                        setIsFifoOverridden(false)
                        toast.success("Restored to Strict FIFO allocation.")
                      }}>
                        <CheckCircle2 className="h-4 w-4" /> Auto Assign FIFO
                      </Button>
                    ) : (
                      <Button variant="outline" className="h-9 px-3 gap-2 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 font-bold rounded-lg" onClick={() => {
                        if (window.confirm("Are you sure you want to deviate from FIFO? This is not recommended and might lead to older stock expiring.")) {
                          setIsFifoOverridden(true)
                          toast.warning("FIFO overridden. You can now manually allocate stock.")
                        }
                      }}>
                        <AlertTriangle className="h-4 w-4" /> Override FIFO
                      </Button>
                    )}
                  </div>
                </div>

                {planState.map((p, idx) => {
                  const requiredKg = p.needed;
                  const totalSelectedKg = p.batches.reduce((sum: number, b: any) => sum + (Number(b.selectedWeight) || 0), 0);
                  const remainingKg = Math.max(0, requiredKg - totalSelectedKg);
                  const isMatch = remainingKg === 0 && totalSelectedKg === requiredKg;
                  const isUnder = remainingKg > 0;
                  const isOver = totalSelectedKg > requiredKg;
                  const totalSelectedBoxes = Math.ceil(totalSelectedKg / 25);
                  
                  // Product metrics
                  const totalRemainingWeight = p.batches.reduce((sum: number, b: any) => sum + b.availableWeight, 0);
                  const nearExpiryBatches = p.batches.filter((b: any) => {
                     if (!b.expiryDate) return false;
                     const d = b.expiryDate.toDate ? b.expiryDate.toDate() : new Date(b.expiryDate.seconds * 1000);
                     const diffDays = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                     return diffDays <= 90;
                  });
                  const hasNearExpiry = nearExpiryBatches.length > 0;
                  const isLowStock = totalRemainingWeight <= 125; // 5 boxes
                  
                  // Removed average weights for display

                  const renderBatchRow = (batch: any, bIdx: number, isSuggested: boolean, hasSelection: boolean) => {
                    const handleUpdateWeight = (val: number) => {
                      if (!isFifoOverridden) { toast.error("Click 'Override FIFO' to modify allocations manually."); return; }
                      const newPlan = [...planState];
                      const b = newPlan[idx].batches[bIdx];
                      
                      // Auto-correct to multiples of 25kg (1 box)
                      let corrected = Math.round(val / 25) * 25;
                      
                      // Cap at available weight
                      if (corrected > b.availableWeight) {
                        corrected = b.availableWeight;
                      }
                      
                      if (corrected < 0) corrected = 0;
                      b.selectedWeight = corrected;
                      setPlanState(newPlan);
                    };
                    
                    const days = batch.expiryDate?.toDate ? Math.ceil(((batch.expiryDate.toDate ? batch.expiryDate.toDate() : new Date(batch.expiryDate.seconds * 1000)).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                    const isActive = hasSelection || batch.uiExpanded || (isSuggested && !hasSelection && batch.uiExpanded !== false);

                    return (
                       <div key={bIdx} 
                            onClick={() => {
                               if (!isActive && isFifoOverridden) {
                                  const newPlan = [...planState];
                                  newPlan[idx].batches[bIdx].uiExpanded = true;
                                  setPlanState(newPlan);
                               }
                            }}
                            className={cn(
                           "flex flex-col md:items-center justify-between text-sm py-4 px-5 rounded-xl border-2 transition-all duration-200 group relative",
                           isActive ? isSuggested ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40" : hasSelection ? "border-sky-200 bg-sky-50/40 dark:border-sky-900/40 dark:bg-sky-950/20" : "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900 focus:bg-slate-100" 
                                    : "border-slate-100 bg-white dark:border-slate-800 dark:bg-card hover:border-slate-300 cursor-pointer"
                       )}>
                         <div className="flex flex-col md:flex-row md:items-center justify-between w-full">
                           <div className="flex flex-col gap-2.5 mb-4 md:mb-0 flex-1">
                             <div className="flex items-center gap-2">
                               <span className={cn("text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0", isSuggested ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 dark:bg-slate-800 text-slate-400")}>#{bIdx + 1} {isSuggested && " (Suggested)"}</span>
                               <span className={cn("font-mono font-bold text-base", hasSelection ? "text-sky-900 dark:text-sky-100" : "text-slate-800 dark:text-slate-200")}>
                                 {batch.barcode}
                               </span>
                             </div>
                             <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500">
                               <Badge
                                 className={cn("text-[10px] font-bold px-2 py-0.5", batch.availableWeight <= 125 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-600 border-slate-200")}
                                 variant="outline"
                               >{batch.availableWeight.toFixed(1)} kg ({Math.ceil(batch.availableWeight / 25)} boxes) left</Badge>
                               
                               <span className="flex items-center gap-1">
                                 <Clock className="h-3.5 w-3.5 text-slate-400" />
                                 Exp: {batch.expiryDate?.toDate ? batch.expiryDate.toDate().toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}) : "N/A"}
                               </span>
                               {days !== null && days <= 90 && (
                                  <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0", days < 0 || days <= 7 ? "bg-red-100 text-red-700 border-red-200" : "bg-orange-100 text-orange-700 border-orange-200")}>
                                    {days < 0 ? "Expired" : `${days}d left`}
                                  </Badge>
                               )}
                             </div>
                           </div>

                           {isActive ? (
                             <div className="flex flex-col md:items-end gap-2 shrink-0 animate-in fade-in slide-in-from-right-4 duration-300">
                               <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                 <Button size="sm" variant="outline" className="h-8 px-2 text-[10px] font-bold bg-white dark:bg-slate-800 hover:text-sky-600 hover:border-sky-300" onClick={(e) => { e.stopPropagation(); handleUpdateWeight(batch.selectedWeight + 25); }}>+25 kg</Button>
                                 <Button size="sm" variant="outline" className="h-8 px-2 text-[10px] font-bold bg-white dark:bg-slate-800 hover:text-sky-600 hover:border-sky-300" onClick={(e) => { e.stopPropagation(); handleUpdateWeight(batch.selectedWeight + 50); }}>+50 kg</Button>
                                 <div className="relative w-20">
                                   <Input 
                                      type="number" 
                                      className="h-8 pl-1.5 pr-5 text-[11px] font-bold" 
                                      value={batch.selectedWeight || ""} 
                                      placeholder="0"
                                      onChange={(e) => { e.stopPropagation(); handleUpdateWeight(parseFloat(e.target.value) || 0); }}
                                   />
                                   <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">kg</span>
                                 </div>
                                 <Button size="sm" variant="outline" className="h-8 px-2 text-[10px] font-bold bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border-emerald-200 hover:bg-emerald-50" onClick={(e) => { e.stopPropagation(); handleUpdateWeight(batch.availableWeight); }}>MAX</Button>
                                 <Button size="sm" variant="ghost" className="h-8 px-2 text-[10px] font-bold hover:bg-red-50 hover:text-red-600 text-red-500 transition-colors" onClick={(e) => { e.stopPropagation(); handleUpdateWeight(0);
                                      const newPlan = [...planState];
                                      newPlan[idx].batches[bIdx].uiExpanded = false;
                                      setPlanState(newPlan);
                                  }}>Clear</Button>
                               </div>
                               
                               <div className={cn("flex flex-col items-end w-full bg-white dark:bg-black/20 p-2 rounded-lg border shadow-sm transition-colors", hasSelection ? "border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/20" : "border-slate-100 dark:border-slate-800")}>
                                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Selected</span>
                                 <div className="font-bold text-sm text-slate-800 dark:text-slate-200 text-right">
                                     <span className={cn(hasSelection ? "text-sky-700 dark:text-sky-400" : "")}>{batch.selectedWeight.toFixed(1)} kg ({batch.selectedWeight / 25} boxes)</span> 
                                 </div>
                               </div>
                             </div>
                           ) : (
                             <div className="flex shrink-0 ml-4 items-center gap-2">
                                <Badge variant="outline" className="bg-slate-50 text-slate-400 px-3 py-1 font-semibold border-slate-200">
                                  {isFifoOverridden ? "Select Batch" : "Locked"}
                                </Badge>
                             </div>
                           )}
                         </div>
                       </div>
                    );
                  };

                  return (
                  <div key={idx} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mb-6 bg-white dark:bg-card shadow-sm">
                    {/* TOP SUMMARY SECTION */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-4">
                      
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                         <div className="flex items-center gap-3">
                           <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shrink-0 mt-0.5", hasNearExpiry ? "bg-orange-100 dark:bg-orange-900/30" : "bg-sky-100 dark:bg-sky-900/30")}>
                             <Package className={cn("h-5 w-5", hasNearExpiry ? "text-orange-500" : "text-sky-600 dark:text-sky-400")} />
                           </div>
                           <div>
                               <h3 className="font-bold text-slate-800 dark:text-slate-200 text-lg leading-tight">{p.name}</h3>
                           </div>
                         </div>
                         
                         {/* Validation feedback near the top */}
                         <div className="flex flex-col items-end gap-1.5 shrink-0">
                            {remainingKg === 0 ? (
                               <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 px-3 py-1 font-bold text-sm shadow-sm"><CheckCircle2 className="w-4 h-4 mr-1.5" /> FULFILLED</Badge>
                            ) : totalSelectedKg > 0 ? (
                               <Badge className="bg-amber-100 text-amber-800 border-amber-300 px-3 py-1 font-bold text-sm shadow-sm"><Clock className="w-4 h-4 mr-1.5" /> IN PROGRESS</Badge>
                            ) : (
                               <Badge className="bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:border-slate-700 px-3 py-1 font-bold text-sm shadow-sm"><AlertTriangle className="w-4 h-4 mr-1.5 opacity-50" /> NOT STARTED</Badge>
                            )}
                            {hasNearExpiry && <span className="text-[10px] font-bold text-orange-600 flex items-center bg-orange-50 dark:bg-orange-950/30 px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3 mr-1" /> Near Expiry Stock Exists</span>}
                         </div>
                      </div>

                      <div className="flex flex-col gap-3 bg-white dark:bg-card border border-slate-200 dark:border-slate-800 rounded-lg p-3 shadow-sm pt-4 pb-4">
                         <div className="flex items-center justify-between text-sm">
                           <div className="text-center w-1/3 border-r border-slate-100 dark:border-slate-800">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Required</span>
                              <span className="font-bold text-lg text-slate-700 dark:text-slate-200">{requiredKg.toFixed(2)} kg</span>
                           </div>
                           <div className="text-center w-1/3 border-r border-slate-100 dark:border-slate-800">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Selected</span>
                              <span className={cn("font-bold text-lg cursor-default", totalSelectedKg > requiredKg ? "text-red-500" : totalSelectedKg > 0 ? "text-sky-600" : "text-slate-500")}>{totalSelectedKg.toFixed(2)} kg</span>
                           </div>
                           <div className="text-center w-1/3">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Remaining</span>
                              <span className={cn("font-bold text-lg", remainingKg === 0 ? "text-emerald-600" : "text-amber-500")}>{remainingKg.toFixed(2)} kg</span>
                           </div>
                         </div>
                         <div className="flex items-center justify-center gap-6 pt-2 border-t border-slate-50 dark:border-slate-800/50 mt-1">
                           <div className="text-xs text-slate-500 font-medium">Selected: <span className="font-bold text-slate-700 dark:text-slate-300">{totalSelectedKg.toFixed(1)} kg ({totalSelectedBoxes} boxes)</span></div>
                         </div>
                      </div>

                      {/* Progress Bar & Summary Bar */}
                      <div className="space-y-2 w-full mt-1">
                         <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner flex">
                           <div 
                             className={cn("h-full transition-all duration-500 ease-out", remainingKg === 0 ? "bg-emerald-500" : "bg-sky-500 border-r border-sky-400")}
                             style={{ width: `${Math.min(100, (totalSelectedKg / requiredKg) * 100)}%` }}
                           />
                         </div>
                         <div className="flex justify-between items-center text-xs px-1">
                           <span className="font-bold text-slate-500">Total Allocated: {totalSelectedKg.toFixed(1)} / {requiredKg.toFixed(1)} kg</span>
                           {totalSelectedKg > requiredKg && (
                             <span className="font-bold text-red-500">Over Allocation: {(totalSelectedKg - requiredKg).toFixed(1)} kg</span>
                           )}
                         </div>
                      </div>
                    </div>
                    
                    {/* BATCHES SECTION */}
                    <div className="p-4 bg-white dark:bg-card">
                      {p.batches.length > 0 ? (
                        <div className="space-y-3">
                          {p.batches.map((batch: any, bIdx: number) => {
                             const hasSelection = batch.quantity > 0;
                             const isSuggested = bIdx === 0 && p.batches.length > 1; // Highlight oldest
                             return renderBatchRow(batch, bIdx, isSuggested, hasSelection);
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 py-6 text-slate-400 text-sm">
                           <Package className="h-8 w-8 opacity-30" />
                           <p>No batches found</p>
                        </div>
                      )}
                    </div>

                  </div>
                )})}
              </div>
            )}
            </>
            )}
          </div>
        </div>

        {/* Warning message when selection is incomplete */}
        {!isVerifying && hasIncompleteItems && (
          <div className="mx-6 mb-2 px-4 py-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg flex items-start gap-2.5 animate-in fade-in duration-200">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-700 dark:text-red-400">Incomplete Selection</p>
              <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
                {selectionSummary.filter(s => s.remaining > 0).map(s => 
                  `${s.name}: need ${s.remaining.toFixed(1)} more kg`
                ).join(" · ")}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="mt-2 border-t border-gray-100 dark:border-border pt-4">
          <Button variant="outline" onClick={onClose} disabled={processing}>
            Cancel
          </Button>
          {!isVerifying ? (
            <Button 
              onClick={handleConfirmSelection} 
              disabled={disableConfirm}
              className={cn(
                "shadow-sm transition-all",
                disableConfirm 
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed opacity-60" 
                  : "bg-sky-600 hover:bg-sky-700 text-white"
              )}
            >
              {processing ? "Saving..." : "Confirm Selection"}
            </Button>
          ) : (
            <Button 
              onClick={onClose} 
              className="bg-sky-100 text-sky-700 hover:bg-sky-200 shadow-sm"
            >
              Close Viewer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
