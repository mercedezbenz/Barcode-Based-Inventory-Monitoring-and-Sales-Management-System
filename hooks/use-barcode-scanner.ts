"use client"

import { useEffect, useRef, useCallback } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// useBarcodeScanner
// ─────────────────────────────────────────────────────────────────────────────
// A global keyboard listener that detects USB barcode-scanner input.
//
// How it works:
//   1. USB barcode scanners emulate keyboard input — they "type" the barcode
//      characters very rapidly and finish with an Enter key.
//   2. This hook attaches a `keydown` listener on `document` and buffers
//      incoming characters.
//   3. When Enter is pressed, if the buffer is long enough (≥ minLength) and
//      was typed quickly enough (within maxDelay ms between keystrokes), the
//      buffer is treated as a scanned barcode and `onScan` is called.
//   4. The listener is SKIPPED when the active element is an <input>,
//      <textarea>, or contentEditable, so normal typing is never intercepted.
//   5. A safety timeout clears the buffer if there's a long pause (i.e., it's
//      a human typing, not a scanner).
// ─────────────────────────────────────────────────────────────────────────────

interface UseBarcodeScannerOptions {
  /** Called when a valid barcode scan is detected */
  onScan: (barcode: string) => void
  /** Minimum barcode length to accept (default: 5) */
  minLength?: number
  /** Max delay between keystrokes to consider them part of a scan (ms). Default: 50 */
  maxKeystrokeDelay?: number
  /** Buffer timeout — clears buffer if no key for this many ms (default: 300) */
  bufferTimeout?: number
  /** Whether the hook is active. Set to false to disable (e.g., when modal is open) */
  enabled?: boolean
}

export function useBarcodeScanner({
  onScan,
  minLength = 5,
  maxKeystrokeDelay = 50,
  bufferTimeout = 300,
  enabled = true,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>("")
  const lastKeystrokeRef = useRef<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onScanRef = useRef(onScan)

  // Keep onScan ref in sync so we don't break memoization
  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  const clearBuffer = useCallback(() => {
    bufferRef.current = ""
    lastKeystrokeRef.current = 0
  }, [])

  useEffect(() => {
    if (!enabled) {
      clearBuffer()
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // ── Skip when user is typing in a form field ──────────────────────
      const target = e.target as HTMLElement | null
      if (target) {
        const tagName = target.tagName.toLowerCase()
        if (
          tagName === "input" ||
          tagName === "textarea" ||
          tagName === "select" ||
          target.isContentEditable
        ) {
          return
        }
      }

      const now = Date.now()

      // ── Enter key → attempt to submit the buffer as a barcode ─────────
      if (e.key === "Enter") {
        e.preventDefault()
        const barcode = bufferRef.current.trim()

        if (barcode.length >= minLength) {
          onScanRef.current(barcode)
        }

        clearBuffer()
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        return
      }

      // ── Only accept printable single-character keys ───────────────────
      if (e.key.length !== 1) return

      // If too much time has passed since the last keystroke,
      // this is probably a new scan or human typing — reset the buffer.
      if (
        lastKeystrokeRef.current > 0 &&
        now - lastKeystrokeRef.current > maxKeystrokeDelay
      ) {
        bufferRef.current = ""
      }

      bufferRef.current += e.key
      lastKeystrokeRef.current = now

      // ── Safety timeout: clear buffer if no keys for a while ───────────
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        clearBuffer()
      }, bufferTimeout)
    }

    document.addEventListener("keydown", handleKeyDown, { capture: true })

    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true })
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      clearBuffer()
    }
  }, [enabled, minLength, maxKeystrokeDelay, bufferTimeout, clearBuffer])
}
