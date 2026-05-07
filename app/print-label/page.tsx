"use client"

/**
 * app/print-label/page.tsx
 * ─────────────────────────────────────────────────────────────────────────
 * 48 mm thermal-label print page — FULL RASTER approach.
 *
 * DRIVER REQUIREMENT:
 *   This page requires a POS-58 compatible driver (NOT "Generic / Text Only").
 *   The "Generic / Text Only" driver cannot render images at all — it only
 *   extracts text nodes and sends raw ASCII. Since the entire label is
 *   rendered as a single bitmap, there are zero text nodes to extract.
 *
 * HOW IT WORKS:
 *   1. Reads product name + barcode from URL params
 *   2. Renders the ENTIRE label (name + barcode + code text) into ONE
 *      \<canvas\> at native 203 DPI thermal resolution
 *   3. Converts the canvas to a PNG data-URL
 *   4. Displays ONLY that \<img\> — zero text DOM nodes
 *   5. Auto-triggers window.print()
 *
 * FALLBACK:
 *   "Download PNG" button lets user save the label image and print
 *   it manually from an image viewer if browser printing fails.
 *
 * NO QZ Tray. NO print-server. Pure browser window.print().
 */

import { useEffect, useRef, useState, useCallback } from "react"

export const dynamic = "force-dynamic"

/* ── Constants ─────────────────────────────────────────────────────────── */
const PAPER_MM   = 48
const RASTER_DPI = 203
const MM_PER_IN  = 25.4
/** Canvas pixel width at native thermal DPI (≈ 384px) */
const CANVAS_W   = Math.round((PAPER_MM / MM_PER_IN) * RASTER_DPI)

/* ═══════════════════════════════════════════════════════════════════════ */

export default function PrintLabelPage() {
  const [mounted,  setMounted]  = useState(false)
  const [name,     setName]     = useState("")
  const [code,     setCode]     = useState("")
  const [labelPng, setLabelPng] = useState<string | null>(null)
  const [labelH,   setLabelH]   = useState(0)
  const [status,   setStatus]   = useState<"generating" | "ready" | "error">("generating")
  const [errorMsg, setErrorMsg] = useState("")

  const didPrint = useRef(false)

  /* ── Step 1: Read URL params (client-side only) ──────────────────── */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    setName(p.get("name") ?? "")
    setCode(p.get("code") ?? "")
    setMounted(true)
  }, [])

  /* ── Step 2: Render full label as canvas → PNG ───────────────────── */
  useEffect(() => {
    if (!mounted || !code) return

    renderLabelToCanvas(name, code)
      .then(({ dataUrl, height }) => {
        setLabelPng(dataUrl)
        setLabelH(height)
        setStatus("ready")
        // Auto-print after image is in the DOM
        if (!didPrint.current) {
          didPrint.current = true
          setTimeout(() => window.print(), 800)
        }
      })
      .catch((err) => {
        console.error("[PrintLabel] render error:", err)
        setStatus("error")
        setErrorMsg(String(err))
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, name, code])

  /* ── Download label as PNG file ──────────────────────────────────── */
  const handleDownload = useCallback(() => {
    if (!labelPng) return
    const a = document.createElement("a")
    a.href = labelPng
    a.download = `label-${code || "barcode"}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [labelPng, code])

  /* ── Loading guard ───────────────────────────────────────────────── */
  if (!mounted) return null

  return (
    <>
      {/* ── Self-contained styles — no dependency on globals.css ────── */}
      <style>{`
        /* ── Full reset ─────────────────────────────────────────── */
        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        /* ── Page geometry for thermal printer ──────────────────── */
        @page {
          size: ${PAPER_MM}mm auto;
          margin: 0 !important;
        }

        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }

        /* ── Screen layout (preview UI) ─────────────────────────── */
        .print-page-shell {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: #f0f2f5;
          padding: 28px 16px;
          gap: 16px;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .print-page-header {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .print-page-header .badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          background: #d1fae5;
          color: #065f46;
          border: 1px solid #6ee7b7;
        }

        .print-page-sub {
          font-size: 12px;
          color: #6b7280;
          text-align: center;
          max-width: 360px;
          line-height: 1.6;
        }
        .print-page-sub strong {
          color: #111827;
        }

        /* ── Label preview card ─────────────────────────────────── */
        .label-preview-card {
          background: #ffffff;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          box-shadow:
            0 1px 3px rgba(0,0,0,0.06),
            0 8px 24px rgba(0,0,0,0.08);
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: ${PAPER_MM}mm;
          max-width: 100%;
          position: relative;
        }

        .label-preview-card::before {
          content: "48mm";
          position: absolute;
          top: -22px;
          right: 0;
          font-size: 10px;
          color: #9ca3af;
          font-weight: 500;
        }

        /* The ENTIRE label is this ONE image — zero text DOM nodes */
        .label-bitmap {
          display: block;
          width: 100%;
          height: auto;
          max-width: ${PAPER_MM}mm;
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
          background: #ffffff;
        }

        /* ── Button row ─────────────────────────────────────────── */
        .btn-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
          margin-top: 4px;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          letter-spacing: 0.02em;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .btn:active {
          transform: scale(0.97);
        }

        .btn-print {
          background: #2563eb;
          color: #fff;
          box-shadow: 0 1px 3px rgba(37,99,235,0.3);
        }
        .btn-print:hover {
          background: #1d4ed8;
          box-shadow: 0 2px 8px rgba(37,99,235,0.35);
        }

        .btn-download {
          background: #ffffff;
          color: #374151;
          border: 1.5px solid #d1d5db;
        }
        .btn-download:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        /* ── Info boxes ─────────────────────────────────────────── */
        .info-box {
          font-size: 11px;
          border-radius: 8px;
          padding: 10px 14px;
          max-width: 380px;
          line-height: 1.6;
          text-align: left;
        }

        .info-driver {
          color: #92400e;
          background: #fffbeb;
          border: 1px solid #fde68a;
        }

        .info-setup {
          color: #1e40af;
          background: #eff6ff;
          border: 1px solid #93c5fd;
        }

        .generating-msg {
          color: #6b7280;
          font-size: 13px;
          padding: 40px 0;
          text-align: center;
        }

        .error-msg {
          color: #dc2626;
          font-size: 13px;
          padding: 30px 0;
          text-align: center;
        }

        /* ═══════════════════════════════════════════════════════════
           PRINT MODE — only the bitmap survives
        ═══════════════════════════════════════════════════════════ */
        @media print {
          /* Force page width */
          html, body {
            width: ${PAPER_MM}mm !important;
            max-width: ${PAPER_MM}mm !important;
            overflow: hidden !important;
          }

          /* Hide all screen-only UI */
          .print-page-header,
          .print-page-sub,
          .btn-row,
          .info-box,
          .generating-msg,
          .error-msg {
            display: none !important;
          }

          /* Strip the preview shell */
          .print-page-shell {
            display: block !important;
            min-height: unset !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Strip the card decoration */
          .label-preview-card {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            width: ${PAPER_MM}mm !important;
            max-width: ${PAPER_MM}mm !important;
          }
          .label-preview-card::before {
            display: none !important;
          }

          /* The bitmap fills the full 48mm width */
          .label-bitmap {
            width: ${PAPER_MM}mm !important;
            max-width: ${PAPER_MM}mm !important;
            display: block !important;
          }
        }
      `}</style>

      <div className="print-page-shell">
        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="print-page-header">
          🖨️ Thermal Label Preview
          <span className="badge">
            {PAPER_MM}mm
          </span>
        </div>

        {/* ── The label — ONE single image, zero text nodes ────────── */}
        <div className="label-preview-card">
          {status === "generating" && (
            <div className="generating-msg">⏳ Generating label image…</div>
          )}
          {status === "error" && (
            <div className="error-msg">❌ {errorMsg}</div>
          )}
          {status === "ready" && labelPng && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={labelPng}
              alt="Barcode label"
              className="label-bitmap"
              width={CANVAS_W}
              height={labelH}
            />
          )}
        </div>

        {/* ── Instructions ──────────────────────────────────────────── */}
        <p className="print-page-sub">
          Print dialog opens automatically.<br />
          ① Select your <strong>POS-58</strong> thermal printer.<br />
          ② Paper size → <strong>{PAPER_MM}mm × continuous</strong>.<br />
          ③ Margins → <strong>None</strong>.<br />
          ④ Check <strong>&quot;Background graphics&quot;</strong>.
        </p>

        {/* ── Buttons ───────────────────────────────────────────────── */}
        <div className="btn-row">
          <button
            className="btn btn-print"
            onClick={() => window.print()}
          >
            🖨️ Print Label
          </button>
          <button
            className="btn btn-download"
            onClick={handleDownload}
            disabled={!labelPng}
          >
            📥 Download PNG
          </button>
        </div>

        {/* ── Driver setup guide ────────────────────────────────────── */}
        <div className="info-box info-driver">
          <strong>⚠️ Driver Requirement</strong><br />
          <strong>&quot;Generic / Text Only&quot;</strong> cannot print images.
          You must install a POS-58 compatible driver:<br />
          <strong>1.</strong> Open <strong>Settings → Bluetooth & Devices → Printers</strong><br />
          <strong>2.</strong> Select your GOOJPRT PT-210<br />
          <strong>3.</strong> Change driver from &quot;Generic / Text Only&quot; to <strong>&quot;POS-58&quot;</strong> or <strong>&quot;Generic / MS Publisher Imagesetter&quot;</strong><br />
          <strong>4.</strong> Set paper size to <strong>58mm × continuous</strong>
        </div>

        <div className="info-box info-setup">
          <strong>💡 Alternative</strong><br />
          Use <strong>Download PNG</strong> to save the label image, then
          open it in <strong>Photos</strong> or <strong>Paint</strong> and
          print from there — this bypasses all driver limitations.
        </div>
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   renderLabelToCanvas — draws the ENTIRE label into ONE canvas
   ═══════════════════════════════════════════════════════════════════════
   This paints:
     1. Product name  (as canvas text — NOT a DOM node)
     2. Divider line
     3. Barcode       (via JsBarcode on a temporary SVG → rasterised)
     4. Barcode value text beneath

   Result: a single PNG data-URL with zero text-selectable content.
*/
async function renderLabelToCanvas(
  productName: string,
  barcodeData: string,
): Promise<{ dataUrl: string; height: number }> {

  // ── 1. Generate the barcode SVG in a detached element ──────────────
  const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  document.body.appendChild(tempSvg)

  const JsBarcode = await import("jsbarcode").then((m) => m.default ?? m)

  JsBarcode(tempSvg, barcodeData, {
    format:       "CODE128",
    width:        2,
    height:       70,
    displayValue: false,   // we draw the text ourselves for crispness
    margin:       0,
    background:   "#ffffff",
    lineColor:    "#000000",
  })

  // Read the SVG natural dimensions
  const svgW = tempSvg.width?.baseVal?.value || 300
  const svgH = tempSvg.height?.baseVal?.value || 90

  // Rasterise SVG → Image
  const barcodeImg = await svgToImage(tempSvg)
  document.body.removeChild(tempSvg)

  // ── 2. Calculate layout heights ────────────────────────────────────
  const PAD_TOP     = 14
  const NAME_SIZE   = 14
  const NAME_LINE_H = NAME_SIZE * 1.35
  const nameLines   = wrapText(productName, CANVAS_W - 24, `bold ${NAME_SIZE}px "Courier New", Courier, monospace`)
  const nameBlockH  = nameLines.length * NAME_LINE_H
  const DIV_GAP     = 10
  const DIV_H       = 1
  const BC_GAP      = 8
  const BC_PAD      = 12
  const bcDrawW     = CANVAS_W - BC_PAD * 2
  const bcScale     = bcDrawW / svgW
  const bcDrawH     = Math.round(svgH * bcScale)
  const CODE_GAP    = 5
  const CODE_SIZE   = 11
  const CODE_H      = CODE_SIZE + 2
  const PAD_BOT     = 12

  const totalH = PAD_TOP + nameBlockH + DIV_GAP + DIV_H + BC_GAP + bcDrawH + CODE_GAP + CODE_H + PAD_BOT

  // ── 3. Create canvas and paint everything ──────────────────────────
  const canvas  = document.createElement("canvas")
  canvas.width  = CANVAS_W
  canvas.height = totalH
  const ctx = canvas.getContext("2d")!

  // White background
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, CANVAS_W, totalH)

  let y = PAD_TOP

  // ── Product name ──────────────────────────────────────────────────
  ctx.fillStyle    = "#000000"
  ctx.font         = `bold ${NAME_SIZE}px "Courier New", Courier, monospace`
  ctx.textAlign    = "center"
  ctx.textBaseline = "top"

  for (const line of nameLines) {
    ctx.fillText(line, CANVAS_W / 2, y)
    y += NAME_LINE_H
  }

  // ── Divider ───────────────────────────────────────────────────────
  y += DIV_GAP
  ctx.fillStyle = "#cccccc"
  ctx.fillRect(12, y, CANVAS_W - 24, DIV_H)
  y += DIV_H + BC_GAP

  // ── Barcode image ─────────────────────────────────────────────────
  ctx.drawImage(barcodeImg, BC_PAD, y, bcDrawW, bcDrawH)
  y += bcDrawH + CODE_GAP

  // ── Barcode text below ────────────────────────────────────────────
  ctx.fillStyle    = "#222222"
  ctx.font         = `bold ${CODE_SIZE}px "Courier New", Courier, monospace`
  ctx.textAlign    = "center"
  ctx.textBaseline = "top"
  ctx.fillText(barcodeData, CANVAS_W / 2, y)

  return { dataUrl: canvas.toDataURL("image/png"), height: totalH }
}

/* ─── SVG element → rasterised Image ──────────────────────────────────── */
function svgToImage(svgEl: SVGSVGElement): Promise<HTMLImageElement> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  const w = svgEl.width?.baseVal?.value || svgEl.getBBox?.()?.width || 300
  const h = svgEl.height?.baseVal?.value || svgEl.getBBox?.()?.height || 90
  clone.setAttribute("width",  String(w))
  clone.setAttribute("height", String(h))
  clone.setAttribute("xmlns",  "http://www.w3.org/2000/svg")

  const xml  = new XMLSerializer().serializeToString(clone)
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" })
  const url  = URL.createObjectURL(blob)

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
  const ctx    = canvas.getContext("2d")!
  ctx.font     = font

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
