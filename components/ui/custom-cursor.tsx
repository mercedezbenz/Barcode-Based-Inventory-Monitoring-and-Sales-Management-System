"use client"

import React, { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isPointer, setIsPointer] = useState(false)
  const [isHidden, setIsHidden] = useState(true)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY })
      setIsHidden(false)

      const target = e.target as HTMLElement
      // Check if the target or its parent is interactive
      const isInteractive =
        target.closest('button') ||
        target.closest('a') ||
        target.closest('select') ||
        target.closest('[role="button"]') ||
        target.closest('.cursor-pointer') ||
        window.getComputedStyle(target).cursor === 'pointer'

      setIsPointer(!!isInteractive)
    }

    const handleMouseLeave = () => setIsHidden(true)
    const handleMouseEnter = () => setIsHidden(false)

    window.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseleave", handleMouseLeave)
    document.addEventListener("mouseenter", handleMouseEnter)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseleave", handleMouseLeave)
      document.removeEventListener("mouseenter", handleMouseEnter)
    }
  }, [])

  if (typeof window === "undefined") return null

  return (
    <>
      <style jsx global>{`
        /* Hide cursor globally */
        * {
          cursor: none !important;
          caret-color: transparent;
        }
        
        /* Explicitly prevent text cursor on all text elements */
        p, span, div, h1, h2, h3, h4, h5, h6, 
        label, strong, em, b, i, small, 
        li, td, th, caption, figcaption,
        article, section, aside, header, footer, nav, main,
        blockquote, pre, code, abbr, cite, dfn, kbd, samp, var,
        [class*="text-"], [class*="font-"], [class*="leading-"] {
          cursor: none !important;
          caret-color: transparent !important;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }
        
        /* Allow text selection and proper cursor only in editable fields */
        input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="image"]):not([type="color"]):not([type="range"]),
        textarea,
        [contenteditable="true"] {
          cursor: text !important;
          caret-color: auto !important;
          -webkit-user-select: text;
          -moz-user-select: text;
          -ms-user-select: text;
          user-select: text;
        }
        
        /* Ensure non-text inputs don't show caret */
        input[type="button"],
        input[type="submit"],
        input[type="checkbox"],
        input[type="radio"],
        input[type="file"],
        input[type="image"],
        input[type="color"],
        input[type="range"],
        button,
        select,
        [role="button"],
        [role="checkbox"],
        [role="radio"],
        [role="switch"],
        [role="tab"],
        [role="menuitem"] {
          cursor: none !important;
          caret-color: transparent !important;
          user-select: none !important;
        }
        
        @media (max-width: 768px) {
          * {
            cursor: auto !important;
            caret-color: auto !important;
          }
          p, span, div, h1, h2, h3, h4, h5, h6 {
            cursor: auto !important;
          }
          .custom-cursor {
            display: none !important;
          }
        }
      `}</style>
      <div
        className={cn(
          "custom-cursor pointer-events-none fixed left-0 top-0 z-[9999] transition-transform duration-100 ease-out",
          isHidden ? "opacity-0" : "opacity-100"
        )}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        }}
      >
        {/* Inner small circle */}
        <div
          className={cn(
            "h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary transition-all duration-300",
            isPointer ? "scale-0" : "scale-100"
          )}
        />
        {/* Outer larger circle */}
        <div
          className={cn(
            "absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/40 bg-primary/10 transition-all duration-300",
            isPointer ? "h-12 w-12 bg-primary/20 scale-110" : "scale-100"
          )}
        />
      </div>
    </>
  )
}
