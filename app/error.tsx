"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("[Root Error] Uncaught runtime error:", error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center text-white">
      <div className="bg-destructive/10 p-4 rounded-full mb-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-12 h-12 text-destructive"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
      </div>
      <h1 className="text-3xl font-bold mb-4">Something went wrong!</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        An unexpected error occurred during application rendering. The technical details have been logged.
      </p>
      <div className="flex gap-4">
        <Button onClick={() => reset()} variant="default" size="lg">
          Try again
        </Button>
        <Button onClick={() => window.location.href = "/"} variant="outline" size="lg">
          Go to home
        </Button>
      </div>
      
      {/* Show technical details in development or for admins if needed */}
      <div className="mt-12 text-xs text-muted-foreground bg-secondary/30 p-4 rounded-lg text-left max-w-3xl overflow-auto border border-border">
        <p className="font-mono">{error.message}</p>
        <p className="mt-2 text-[10px] opacity-50">Digest: {error.digest}</p>
      </div>
    </div>
  )
}
