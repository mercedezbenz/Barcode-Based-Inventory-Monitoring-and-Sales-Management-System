"use client"

/**
 * components/inventory/barcode-modal.tsx
 * ──────────────────────────────────────────────────────────────────────────
 * Barcode preview modal.
 *
 * Uses the shared BarcodeLabel component so the preview inside this modal
 * is EXACTLY identical to the /print-label page output.
 */

import { useCallback, useState, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer, Download } from "lucide-react"
import { BarcodeLabel, renderLabelToCanvas } from "./barcode-label"
import "@/styles/barcode-label.css"

interface BarcodeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  barcode: string
  productName: string
  productionDate?: string
  expiryDate?: string
}

export function BarcodeModal({
  open,
  onOpenChange,
  barcode,
  productName,
  productionDate,
  expiryDate,
}: BarcodeModalProps) {
  const [printing, setPrinting] = useState(false)
  const labelDataUrl = useRef<string | null>(null)

  // 🔥 SAVE DEVICE FOR AUTO CONNECT
  const [savedDevice, setSavedDevice] = useState<any | null>(null)

  // Store the rendered label data URL for download
  const handleLabelReady = useCallback((dataUrl: string) => {
    labelDataUrl.current = dataUrl
  }, [])

  // 🔥 BLUETOOTH PRINT — IMAGE-BASED (matches preview exactly)
  const handlePrint = useCallback(async () => {
    try {
      setPrinting(true)

      // ── 1. Render the label to a canvas at NATIVE printer resolution ──
      //    renderLabelToCanvas uses HIDPI_SCALE internally (3×), but the
      //    printer only needs 384px wide (native 203 DPI for 48mm paper).
      //    We re-render at 1× scale by drawing to a printer-sized canvas.
      const { dataUrl } = await renderLabelToCanvas(
        productName, barcode, productionDate, expiryDate
      )

      // Load the high-res PNG into an Image element
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = reject
        image.src = dataUrl
      })

      // Draw to a canvas at EXACT printer width (384px)
      const PRINTER_W = 384 // 48mm × 203 DPI ÷ 25.4
      const scale = PRINTER_W / img.naturalWidth
      const PRINTER_H = Math.round(img.naturalHeight * scale)

      const printCanvas = document.createElement("canvas")
      printCanvas.width = PRINTER_W
      printCanvas.height = PRINTER_H
      const pCtx = printCanvas.getContext("2d")!
      pCtx.fillStyle = "#ffffff"
      pCtx.fillRect(0, 0, PRINTER_W, PRINTER_H)
      pCtx.drawImage(img, 0, 0, PRINTER_W, PRINTER_H)

      // ── 2. Convert to 1-bit monochrome raster ─────────────────────────
      const imageData = pCtx.getImageData(0, 0, PRINTER_W, PRINTER_H)
      const pixels = imageData.data

      // Each row: PRINTER_W pixels → PRINTER_W/8 bytes (1 bit per pixel)
      const bytesPerRow = Math.ceil(PRINTER_W / 8)
      const rasterData = new Uint8Array(bytesPerRow * PRINTER_H)

      for (let row = 0; row < PRINTER_H; row++) {
        for (let col = 0; col < PRINTER_W; col++) {
          const i = (row * PRINTER_W + col) * 4
          // Luminance grayscale conversion
          const gray = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114
          // Threshold: dark pixels → 1 (print), light pixels → 0 (no print)
          if (gray < 128) {
            const byteIndex = row * bytesPerRow + Math.floor(col / 8)
            const bitIndex = 7 - (col % 8) // MSB first
            rasterData[byteIndex] |= (1 << bitIndex)
          }
        }
      }

      // ── 3. Connect to Bluetooth printer ───────────────────────────────
      let device = savedDevice
      if (!device) {
        // Find printer with correct UUID
        device = await (navigator as any).bluetooth.requestDevice({
  filters: [
  { namePrefix: "PT" } // or exact name ng printer mo
],
optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb"],
})
        setSavedDevice(device)
      }

     let server = device.gatt?.connected
  ? device.gatt
  : await device.gatt?.connect()
      if (!server) throw new Error("No GATT server")

      const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb')
      const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb')

      // ── 4. Build ESC/POS raster image command ─────────────────────────
      //    GS v 0 — Print raster bit image
      //    Format: GS v 0 m xL xH yL yH [data]
      //    m = 0 (normal), xL/xH = bytes per row, yL/yH = total rows
      const ESC = 0x1B
      const GS = 0x1D

      const xL = bytesPerRow & 0xFF
      const xH = (bytesPerRow >> 8) & 0xFF
      const yL = PRINTER_H & 0xFF
      const yH = (PRINTER_H >> 8) & 0xFF

      // Header: ESC @ (init) + GS v 0 m xL xH yL yH
      const header = new Uint8Array([
        ESC, 0x40,          // Initialize printer
        GS, 0x76, 0x30,    // GS v 0 — raster bit image
        0x00,               // m = 0 (normal mode)
        xL, xH,             // bytes per row (little-endian)
        yL, yH,             // number of rows (little-endian)
      ])

      // Footer: feed lines + partial cut
      const footer = new Uint8Array([
        0x0A, 0x0A, 0x0A,   // 3 feed lines
        GS, 0x56, 0x01      // GS V 1 — partial cut
      ])

      // Combine: header + raster data + footer
      const fullData = new Uint8Array(header.length + rasterData.length + footer.length)
      fullData.set(header, 0)
      fullData.set(rasterData, header.length)
      fullData.set(footer, header.length + rasterData.length)

      // ── 5. Send in chunks (BLE has MTU limits, typically 512 bytes) ───
      const CHUNK_SIZE = 512
      for (let offset = 0; offset < fullData.length; offset += CHUNK_SIZE) {
        const chunk = fullData.slice(offset, offset + CHUNK_SIZE)
        await characteristic.writeValue(chunk)
        // Small delay between chunks to let the printer buffer
        if (offset + CHUNK_SIZE < fullData.length) {
          await new Promise(r => setTimeout(r, 20))
        }
      }

      console.log(
        `✅ Printed image: ${PRINTER_W}×${PRINTER_H}px, ` +
        `${rasterData.length} raster bytes, ${fullData.length} total bytes`
      )

    } catch (err) {
      console.error("❌ Bluetooth error:", err)
      alert("Bluetooth printing failed. Check printer.")
    } finally {
      setPrinting(false)
    }
  }, [barcode, productName, productionDate, expiryDate, savedDevice])

  // Download PNG
  const handleDownload = useCallback(async () => {
    // If we already have the rendered label, use it directly
    if (labelDataUrl.current) {
      downloadPng(labelDataUrl.current, barcode)
      return
    }
    // Otherwise render on the fly
    try {
      const { dataUrl } = await renderLabelToCanvas(productName, barcode, productionDate, expiryDate)
      downloadPng(dataUrl, barcode)
    } catch (err) {
      console.error("Download error:", err)
    }
  }, [barcode, productName, productionDate, expiryDate])

  if (!barcode) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-6 space-y-5">

        <DialogHeader>
          <DialogTitle className="text-lg">Barcode Preview</DialogTitle>
        </DialogHeader>

        {/* ── Label preview — uses the SAME component as /print-label ── */}
        {/* The preview container overrides the 48mm width so the label   */}
        {/* image scales up naturally via width:100%. Print CSS restores  */}
        {/* the strict 48mm size via !important rules.                    */}
        <div className="flex justify-center">
          <div
            style={{
              background: "#fafafa",
              border: "2px solid #e5e7eb",
              borderRadius: "16px",
              boxShadow:
                "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)",
              padding: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Override the 48mm fixed width for screen preview only */}
            <div className="barcode-label-preview">
              <BarcodeLabel
                productName={productName}
                barcode={barcode}
                productionDate={productionDate}
                expiryDate={expiryDate}
                onReady={handleLabelReady}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            data-barcode-print
            onClick={handlePrint}
            disabled={printing}
            className="flex-1 bg-emerald-600 text-white"
          >
            <Printer className="mr-2 h-4 w-4" />
            {printing ? "Printing..." : "Print"}
          </Button>

          <Button
            onClick={handleDownload}
            variant="outline"
            className="flex-1"
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  )
}

/* ─── Helper: trigger PNG download ────────────────────────────────────── */
function downloadPng(dataUrl: string, barcode: string) {
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = `barcode-${barcode}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}