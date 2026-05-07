"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MapPin, UserCheck, Clock, Truck, CheckCircle, AlertCircle, Package } from "lucide-react"
import type { CustomerTransaction } from "@/lib/types"
import { useAuth } from "@/hooks/use-auth"
import { formatTimestamp } from "@/lib/utils"
import { DriverTrackingModal } from "./driver-tracking-modal"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface TransactionsTableProps {
  transactions: CustomerTransaction[]
  emptyMessage?: string
  onAssignDriver?: (transaction: CustomerTransaction) => void
  logColumnLabel?: string
  showStatusBadge?: boolean
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

function formatQtyUnit(tx: any): string {
  const qty = tx.quantity || 0
  const unit = (tx.unit_type || tx.outgoing_unit || "box").toLowerCase()
  if (qty === 0) return "—"
  if (unit === "pack") return `${qty} ${qty === 1 ? "Pack" : "Packs"}`
  return `${qty} ${qty === 1 ? "Box" : "Boxes"}`
}

function fmtDate(val: any): string {
  if (!val) return "—"
  try {
    const d = val instanceof Date ? val : val?.toDate ? val.toDate() : new Date(val)
    if (isNaN(d.getTime())) return "—"
    const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    return `${m[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  } catch { return "—" }
}

/* ── Component ────────────────────────────────────────────────────────── */

export function TransactionsTable({
  transactions,
  emptyMessage = "No transactions found",
  onAssignDriver,
  logColumnLabel,
  showStatusBadge = false,
}: TransactionsTableProps) {
  const { isReadOnly } = useAuth()
  const [trackingDriverId, setTrackingDriverId] = useState<string | null>(null)
  const [trackingDriverName, setTrackingDriverName] = useState<string | null>(null)
  const [trackingDriverPhotoUrl, setTrackingDriverPhotoUrl] = useState<string | null>(null)

  const allCompleted = transactions.length > 0 && transactions.every(t => t.transactionType === "DELIVERED")

  const sorted = [...transactions].sort((a, b) => {
    if (logColumnLabel) {
      const ts = (v: any) => v instanceof Date ? v.getTime() : 0
      const diff = ts(b.scannedTimestamp) - ts(a.scannedTimestamp)
      if (diff !== 0) return diff
    }
    const aD = !!(a.assignedDriverId && a.assignedDriverName)
    const bD = !!(b.assignedDriverId && b.assignedDriverName)
    if (aD && !bD) return -1
    if (!aD && bD) return 1
    return 0
  })

  const statusBadge = (status?: CustomerTransaction["deliveryStatus"]) => {
    if (!status) return <span className="text-muted-foreground text-[11px]">—</span>
    const s = status.toUpperCase()
    let cls = "bg-slate-50 text-slate-600 border-slate-200"
    let Icon = Clock
    if (s === "PICKED_UP") { cls = "bg-blue-50 text-blue-700 border-blue-200"; Icon = Clock }
    else if (s === "ON_DELIVERY") { cls = "bg-orange-50 text-orange-700 border-orange-200"; Icon = Truck }
    else if (s === "COMPLETED" || s === "DELIVERED") { cls = "bg-green-50 text-green-700 border-green-200"; Icon = CheckCircle }
    else if (s === "PENDING") { cls = "bg-yellow-50 text-yellow-700 border-yellow-200"; Icon = AlertCircle }
    return (
      <Badge variant="outline" className={`${cls} flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold`}>
        <Icon className="h-3 w-3" />
        {status.replace("_", " ")}
      </Badge>
    )
  }

  // Dynamic colSpan for empty state
  const cols = 7 + (logColumnLabel ? 1 : 0) + (showStatusBadge ? 1 : 0) + (!allCompleted ? 1 : 0)

  return (
    <>
      <div className="rounded-xl border border-border/50 overflow-hidden shadow-sm bg-card">
        <div className="overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
          <table className="w-full table-fixed text-left">

            {/* ── Column widths ─────────────────────────────────── */}
            <colgroup>
              <col style={{ width: "15%" }} /> {/* Customer */}
              <col style={{ width: "20%" }} /> {/* Product */}
              <col style={{ width: "8%" }}  /> {/* Qty/Unit */}
              <col style={{ width: "10%" }} /> {/* Date */}
              <col style={{ width: "15%" }} /> {/* Documents */}
              {logColumnLabel && <col style={{ width: "10%" }} />}
              {showStatusBadge && <col style={{ width: "8%" }} />}
              <col style={{ width: "12%" }} /> {/* Driver */}
              {!allCompleted && <col style={{ width: "10%" }} />} {/* Actions */}
            </colgroup>

            {/* ── Header ────────────────────────────────────────── */}
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-muted/40 border-b border-border/60">
              <tr>
                <th className="h-11 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Customer</th>
                <th className="h-11 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Product</th>
                <th className="h-11 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap text-center">Qty / Unit</th>
                <th className="h-11 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Date</th>
                <th className="h-11 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Documents</th>
                {logColumnLabel && <th className="h-11 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{logColumnLabel}</th>}
                {showStatusBadge && <th className="h-11 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Status</th>}
                <th className="h-11 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Driver</th>
                {!allCompleted && <th className="h-11 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap text-center">Actions</th>}
              </tr>
            </thead>

            {/* ── Body ──────────────────────────────────────────── */}
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={cols} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">{emptyMessage}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sorted.map((transaction, idx) => {
                  const tx = transaction as any
                  const isCompleted = transaction.transactionType === "DELIVERED"

                  const drNo = tx.deliveryReceiptNo || tx.delivery_receipt_no || null
                  const tsNo = tx.transferSlipNo || tx.transfer_slip_no || null
                  const siNo = tx.salesInvoiceNo || tx.sales_invoice_no || null
                  const hasDoc = drNo || tsNo || siNo

                  return (
                    <tr
                      key={transaction.id}
                      className={[
                        "border-b border-border/30 transition-colors duration-150",
                        idx % 2 === 0 ? "bg-white dark:bg-card" : "bg-gray-50/50 dark:bg-muted/10",
                        "hover:bg-blue-50/60 dark:hover:bg-blue-950/20",
                      ].join(" ")}
                    >
                      {/* ── Customer (name + address grouped) ──── */}
                      <td className="h-16 px-4 align-middle">
                        <div className="overflow-hidden">
                          <p className="text-sm font-semibold text-foreground truncate">{transaction.customerName || "—"}</p>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={transaction.customerAddress}>{transaction.customerAddress || "—"}</p>
                        </div>
                      </td>

                      {/* ── Product (name + barcode grouped) ──── */}
                      <td className="h-16 px-4 align-middle">
                        <div className="overflow-hidden">
                          <p className="text-sm font-medium text-foreground truncate" title={transaction.productName}>{transaction.productName || "—"}</p>
                          {transaction.productBarcode ? (
                            <p className="text-[11px] font-mono text-muted-foreground truncate mt-0.5">{transaction.productBarcode}</p>
                          ) : (
                            <p className="text-[11px] font-mono text-red-400 truncate mt-0.5" title="No barcode assigned — scanning will not work">⚠ No barcode</p>
                          )}
                        </div>
                      </td>

                      {/* ── Qty / Unit ──────────────────────────── */}
                      <td className="h-16 px-4 align-middle text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800 whitespace-nowrap">
                          {formatQtyUnit(tx)}
                        </span>
                      </td>

                      {/* ── Date ────────────────────────────────── */}
                      <td className="h-16 px-4 align-middle">
                        <p className="text-sm text-foreground whitespace-nowrap">{fmtDate(transaction.transactionDate)}</p>
                        {isCompleted && transaction.deliveredAt && (
                          <p className="text-[10px] text-green-600 dark:text-green-400 mt-0.5 whitespace-nowrap">✓ {fmtDate(transaction.deliveredAt)}</p>
                        )}
                      </td>

                      {/* ── Documents (DR / TS / SI) ───────────── */}
                      <td className="h-16 px-4 align-middle">
                        {hasDoc ? (
                          <div className="flex flex-col gap-0.5 overflow-hidden">
                            {drNo && (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center justify-center w-6 h-4 rounded text-[9px] font-bold bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 shrink-0">DR</span>
                                <span className="text-[11px] font-mono text-foreground truncate">{drNo}</span>
                              </div>
                            )}
                            {siNo && (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center justify-center w-6 h-4 rounded text-[9px] font-bold bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 shrink-0">SI</span>
                                <span className="text-[11px] font-mono text-foreground truncate">{siNo}</span>
                              </div>
                            )}
                            {tsNo && (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center justify-center w-6 h-4 rounded text-[9px] font-bold bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 shrink-0">TS</span>
                                <span className="text-[11px] font-mono text-foreground truncate">{tsNo}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>

                      {/* ── Log Column (Pickup / Completed) ────── */}
                      {logColumnLabel && (
                        <td className="h-16 px-4 align-middle">
                          <span className="text-sm whitespace-nowrap">
                            {transaction.completedTime
                              ? transaction.completedTime
                              : transaction.scannedTimestamp
                                ? formatTimestamp(transaction.scannedTimestamp)
                                : <span className="text-muted-foreground text-xs">—</span>}
                          </span>
                        </td>
                      )}

                      {/* ── Status Badge ────────────────────────── */}
                      {showStatusBadge && (
                        <td className="h-16 px-4 align-middle">{statusBadge(transaction.deliveryStatus)}</td>
                      )}

                      {/* ── Driver (name only, no email) ────────── */}
                      <td className="h-16 px-4 align-middle">
                        {transaction.assignedDriverName ? (
                          <p className="text-sm font-medium text-foreground truncate">{transaction.assignedDriverName}</p>
                        ) : (
                          <span className="text-muted-foreground italic text-sm">Unassigned</span>
                        )}
                      </td>

                      {/* ── Actions ─────────────────────────────── */}
                      {!allCompleted && (
                        <td className="h-16 px-4 align-middle text-center">
                          <TooltipProvider>
                            <div className="flex items-center justify-center gap-1.5">
                              {!isReadOnly && onAssignDriver && transaction.transactionType === "PRODUCT_OUT" && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant={transaction.assignedDriverId ? "outline" : "default"}
                                      onClick={() => onAssignDriver(transaction)}
                                      className="text-[11px] h-7 px-2.5 transition-all hover:scale-105 active:scale-95"
                                    >
                                      <UserCheck className="mr-1 h-3 w-3" />
                                      {transaction.assignedDriverId ? "Change" : "Assign"}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{transaction.assignedDriverId ? "Assign a different driver" : "Assign a driver"}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {transaction.transactionType === "IN_PROGRESS" && transaction.assignedDriverId && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setTrackingDriverId(transaction.assignedDriverId || null)
                                        setTrackingDriverName(transaction.assignedDriverName || null)
                                        setTrackingDriverPhotoUrl((transaction as any).assignedDriverPhotoUrl || null)
                                      }}
                                      className="text-[11px] h-7 px-2.5 transition-all hover:scale-105 active:scale-95 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                    >
                                      <MapPin className="mr-1 h-3 w-3" />
                                      Track
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>View real-time driver location</p></TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TooltipProvider>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DriverTrackingModal
        driverId={trackingDriverId}
        driverName={trackingDriverName}
        driverPhotoUrl={trackingDriverPhotoUrl}
        open={!!trackingDriverId}
        onOpenChange={(open) => {
          if (!open) {
            setTrackingDriverId(null)
            setTrackingDriverName(null)
            setTrackingDriverPhotoUrl(null)
          }
        }}
      />
    </>
  )
}
