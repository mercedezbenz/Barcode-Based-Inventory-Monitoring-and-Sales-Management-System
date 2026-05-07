"use client"

/**
 * components/inventory/barcode-label.tsx
 * ──────────────────────────────────────────────────────────────────────────
 * Reusable barcode label component.
 *
 * This component renders the EXACT same label layout used for both:
 *   1. The barcode preview modal
 *   2. The /print-label print page
 *
 * The entire label is rendered as a single canvas → PNG image to guarantee
 * pixel-perfect consistency between preview and print output.
 *
 * Layout (48mm thermal label):
 *   ┌──────────────────────┐
 *   │   Product Name       │
 *   │  BARCODE-CODE-TEXT   │
 *   │  ║║║║║║║║║║║║║║║║║  │
 *   │  BARCODE-CODE-TEXT   │
 *   │  Production Date: …  │
 *   │  Expiration Date: …  │
 *   └──────────────────────┘
 */

import { useEffect, useState, useRef } from "react"

/* ── Constants ─────────────────────────────────────────────────────────── */
const PAPER_MM = 48
const RASTER_DPI = 203
const MM_PER_IN = 25.4
/** Canvas pixel width at native thermal DPI (≈ 384px) */
export const CANVAS_W = Math.round((PAPER_MM / MM_PER_IN) * RASTER_DPI)

/**
 * HiDPI scale factor for sharp preview rendering.
 * The canvas is rendered at SCALE× resolution internally, then displayed
 * at logical (1×) size in the UI. This prevents blur when the image is
 * shown in the modal at a larger visual size.
 */
const HIDPI_SCALE = 3

export { PAPER_MM }

export interface BarcodeLabelProps {
  /** Product name shown at the top of the label */
  productName: string
  /** Raw barcode string to encode as CODE128 */
  barcode: string
  /** Optional production date string (e.g. "Apr 17, 2026") */
  productionDate?: string
  /** Optional expiration date string (e.g. "Apr 17, 2026") */
  expiryDate?: string
  /** Called when the label image is ready */
  onReady?: (dataUrl: string, height: number) => void
  /** Called if label rendering fails */
  onError?: (error: string) => void
}

/**
 * BarcodeLabel — renders the entire label as a single <img> element.
 *
 * The label is drawn on a canvas at native 203 DPI resolution, then
 * converted to a PNG data URL. This ensures the preview and print
 * output are identical.
 */
export function BarcodeLabel({
  productName,
  barcode,
  productionDate,
  expiryDate,
  onReady,
  onError,
}: BarcodeLabelProps) {
  const [labelPng, setLabelPng] = useState<string | null>(null)
  const [labelH, setLabelH] = useState(0)
  const [status, setStatus] = useState<"generating" | "ready" | "error">("generating")
  const lastRender = useRef("")

  useEffect(() => {
    if (!barcode) return

    // Avoid duplicate renders for the same inputs
    const key = `${productName}|${barcode}|${productionDate}|${expiryDate}`
    if (key === lastRender.current && status === "ready") return
    lastRender.current = key

    setStatus("generating")

    renderLabelToCanvas(productName, barcode, productionDate, expiryDate)
      .then(({ dataUrl, height }) => {
        setLabelPng(dataUrl)
        setLabelH(height)
        setStatus("ready")
        onReady?.(dataUrl, height)
      })
      .catch((err) => {
        console.error("[BarcodeLabel] render error:", err)
        setStatus("error")
        onError?.(String(err))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productName, barcode, productionDate, expiryDate])

  if (!barcode) return null

  return (
    <div className="barcode-label-wrap">
      {status === "generating" && (
        <div className="barcode-label-loading">⏳ Generating label…</div>
      )}
      {status === "error" && (
        <div className="barcode-label-error">❌ Failed to generate label</div>
      )}
      {status === "ready" && labelPng && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={labelPng}
          alt={`Barcode label for ${productName}`}
          className="barcode-label-img"
          width={CANVAS_W}
          height={labelH}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   renderLabelToCanvas — draws the ENTIRE label into ONE canvas
   ═══════════════════════════════════════════════════════════════════════
   This paints:
     1. Product name  (bold, centered)
     2. Barcode code text (monospace, centered)
     3. Barcode bars (via JsBarcode → rasterised)
     4. Barcode code text again below bars
     5. Production Date line (if provided)
     6. Expiration Date line (if provided)

   Result: a single PNG data-URL with zero text-selectable content.
*/
export async function renderLabelToCanvas(
  productName: string,
  barcodeData: string,
  productionDate?: string,
  expiryDate?: string,
): Promise<{ dataUrl: string; height: number }> {

  const S = HIDPI_SCALE  // shorthand for the scale factor

  // ── 1. Generate the barcode SVG in a detached element ──────────────
  const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  document.body.appendChild(tempSvg)

  const JsBarcode = await import("jsbarcode").then((m) => m.default ?? m)

  // Use larger barcode parameters scaled by S for a high-res SVG
  JsBarcode(tempSvg, barcodeData, {
    format: "CODE128",
    width: 5 * S,
    height: 130 * S,
    margin: 0,             // zero margin — we control all spacing ourselves
    displayValue: false,   // we draw the text ourselves for crispness
    background: "#ffffff",
    lineColor: "#000000",
  })

  // Read the SVG natural dimensions
  const svgW = tempSvg.width?.baseVal?.value || 300 * S
  const svgH = tempSvg.height?.baseVal?.value || 90 * S

  // Rasterise SVG → Image (already at high resolution)
  const barcodeImg = await svgToImage(tempSvg)
  document.body.removeChild(tempSvg)

  // ── 2. Calculate layout heights (all in LOGICAL units) ─────────────
  const PAD_TOP = 14
  const NAME_SIZE = 14
  const NAME_LINE_H = NAME_SIZE * 1.35
  const nameLines = wrapText(productName, CANVAS_W - 24, `bold ${NAME_SIZE}px "Courier New", Courier, monospace`)
  const nameBlockH = nameLines.length * NAME_LINE_H

  const BC_GAP = 6
  const bcDrawW = CANVAS_W               // edge-to-edge, no side padding
  const bcScale = bcDrawW / (svgW / S)   // scale relative to logical SVG size
  const bcDrawH = Math.round((svgH / S) * bcScale)

  const CODE_BOT_GAP = 5
  const CODE_SIZE = 11
  const CODE_H = CODE_SIZE + 2

  // Meta lines (production date, expiry date)
  const META_SIZE = 10
  const META_LINE_H = META_SIZE * 1.5
  const metaLines: string[] = []
  if (productionDate) metaLines.push(`Production Date: ${productionDate}`)
  if (expiryDate) metaLines.push(`Expiration Date: ${expiryDate}`)
  const META_GAP = metaLines.length > 0 ? 6 : 0
  const metaBlockH = metaLines.length * META_LINE_H

  const PAD_BOT = 12

  /** Logical height (1× units) */
  const totalH = PAD_TOP + nameBlockH + BC_GAP + bcDrawH + CODE_BOT_GAP + CODE_H + META_GAP + metaBlockH + PAD_BOT

  // ── 3. Create HiDPI canvas and paint everything ────────────────────
  //    Canvas physical pixels = logical size × HIDPI_SCALE
  const canvas = document.createElement("canvas")
  canvas.width = CANVAS_W * S
  canvas.height = Math.round(totalH * S)
  const ctx = canvas.getContext("2d")!

  // Scale context so we can draw in logical coordinates
  ctx.scale(S, S)

  // White background
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, CANVAS_W, totalH)

  let y = PAD_TOP

  // ── Product name (bold, centered) ─────────────────────────────────
  ctx.fillStyle = "#000000"
  ctx.font = `bold ${NAME_SIZE}px "Courier New", Courier, monospace`
  ctx.textAlign = "center"
  ctx.textBaseline = "top"

  for (const line of nameLines) {
    ctx.fillText(line, CANVAS_W / 2, y)
    y += NAME_LINE_H
  }

  // ── Barcode image (edge-to-edge) ──────────────────────────────────
  y += BC_GAP
  // Draw the high-res SVG image into the logical-coordinate space;
  // the ctx.scale(S,S) ensures it fills the physical pixels correctly.
  ctx.drawImage(barcodeImg, 0, y, bcDrawW, bcDrawH)
  y += bcDrawH

  // ── Barcode code text (below barcode) ─────────────────────────────
  y += CODE_BOT_GAP
  ctx.fillStyle = "#222222"
  ctx.font = `bold ${CODE_SIZE}px "Courier New", Courier, monospace`
  ctx.textAlign = "center"
  ctx.textBaseline = "top"
  ctx.fillText(barcodeData, CANVAS_W / 2, y)
  y += CODE_H

  // ── Meta lines (production date, expiry date) ─────────────────────
  if (metaLines.length > 0) {
    y += META_GAP
    ctx.fillStyle = "#333333"
    ctx.font = `${META_SIZE}px "Courier New", Courier, monospace`
    ctx.textAlign = "center"
    ctx.textBaseline = "top"

    for (const line of metaLines) {
      // Split into label and value for styling
      const colonIdx = line.indexOf(":")
      if (colonIdx > -1) {
        const label = line.substring(0, colonIdx + 1)
        const value = line.substring(colonIdx + 1)

        // Measure total width for centering
        const labelWidth = ctx.measureText(label).width
        const valueWidth = ctx.measureText(value).width
        const totalWidth = labelWidth + valueWidth
        const startX = (CANVAS_W - totalWidth) / 2

        // Draw label part (bold)
        ctx.font = `bold ${META_SIZE}px "Courier New", Courier, monospace`
        ctx.textAlign = "left"
        ctx.fillStyle = "#333333"
        ctx.fillText(label, startX, y)

        // Draw value part (bold)
        ctx.font = `bold ${META_SIZE}px "Courier New", Courier, monospace`
        ctx.fillStyle = "#333333"
        ctx.fillText(value, startX + labelWidth, y)
      } else {
        ctx.fillText(line, CANVAS_W / 2, y)
      }
      y += META_LINE_H
    }
  }

  // Return the high-res PNG but report LOGICAL height for layout
  return { dataUrl: canvas.toDataURL("image/png"), height: Math.round(totalH) }
}

/* ─── SVG element → rasterised Image ──────────────────────────────────── */
function svgToImage(svgEl: SVGSVGElement): Promise<HTMLImageElement> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  const w = svgEl.width?.baseVal?.value || svgEl.getBBox?.()?.width || 300
  const h = svgEl.height?.baseVal?.value || svgEl.getBBox?.()?.height || 90
  clone.setAttribute("width", String(w))
  clone.setAttribute("height", String(h))
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")

  const xml = new XMLSerializer().serializeToString(clone)
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" })
  const url = URL.createObjectURL(blob)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}

/* ─── Text wrapping helper for canvas ─────────────────────────────────── */
function wrapText(text: string, maxWidth: number, font: string): string[] {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!
  ctx.font = font

  const words: string[] = text.split(/\s+/)
  const lines: string[] = []
  let currentLine = ""

  for (const word of words) {
    const test = currentLine ? `${currentLine} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = test
    }
  }
  if (currentLine) lines.push(currentLine)

  return lines.length ? lines : [text]
}
