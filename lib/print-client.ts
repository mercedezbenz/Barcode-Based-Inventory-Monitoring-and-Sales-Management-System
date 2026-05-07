/**
 * lib/print-client.ts
 * -------------------
 * Browser-native print helper — no QZ Tray, no Node.js server.
 *
 * Opens /print-label in a new tab. The page renders the label and
 * calls window.print() automatically.
 */

export interface PrintLabelOptions {
  productName: string
  barcode: string
}

/**
 * Open a new tab at /print-label with the product name and barcode encoded
 * as URL query parameters. The page auto-triggers the browser print dialog.
 *
 * @returns the opened Window reference (or null if blocked by a popup blocker)
 */
export function printBarcodeLabel({ productName, barcode }: PrintLabelOptions): Window | null {
  const params = new URLSearchParams({ name: productName, code: barcode })
  return window.open(`/print-label?${params.toString()}`, "_blank")
}
