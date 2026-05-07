/**
 * hooks/usePrint.ts
 * -----------------
 * React hook for printing product barcode labels via the browser's native
 * print dialog — no QZ Tray, no Node.js print server required.
 *
 * Usage:
 *   const { print, printing } = usePrint();
 *   print({ productName: "Brake Pads", barcodeData: "PROD-001" });
 */

import { useState, useCallback } from "react"

export interface PrintPayload {
  /** Label text shown above the barcode */
  productName: string
  /** Raw string to encode as a CODE128 barcode */
  barcodeData: string
}

export interface UsePrintReturn {
  /**
   * Opens /print-label in a new tab with the given product + barcode.
   * Returns true if the tab was opened, false if blocked by a popup blocker.
   */
  print: (payload: PrintPayload) => boolean
  /** True for a brief moment after print() is called */
  printing: boolean
  /** Always null — kept for API compatibility */
  error: string | null
}

export function usePrint(): UsePrintReturn {
  const [printing, setPrinting] = useState(false)

  const print = useCallback((payload: PrintPayload): boolean => {
    setPrinting(true)
    const params = new URLSearchParams({
      name: payload.productName,
      code: payload.barcodeData,
    })
    const tab = window.open(`/print-label?${params.toString()}`, "_blank")
    // Brief visual feedback
    setTimeout(() => setPrinting(false), 800)
    return tab !== null
  }, [])

  return { print, printing, error: null }
}
