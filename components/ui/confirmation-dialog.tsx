"use client"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface ConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  /** Optional rich body content between description and buttons */
  children?: ReactNode
  /** Text for the confirm button */
  confirmLabel?: string
  /** Text for the cancel button */
  cancelLabel?: string
  /** Button variant color */
  variant?: "danger" | "warning" | "default"
  /** Icon to show next to the confirm button */
  icon?: ReactNode
  /** Whether the action is in progress */
  loading?: boolean
  /** Called when user confirms */
  onConfirm: () => void | Promise<void>
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  icon,
  loading = false,
  onConfirm,
}: ConfirmationDialogProps) {
  const btnClass =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : variant === "warning"
        ? "bg-amber-500 hover:bg-amber-600 text-white"
        : "bg-blue-600 hover:bg-blue-700 text-white"

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {children && <div className="mt-1">{children}</div>}

        <AlertDialogFooter className="mt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn("gap-2", btnClass)}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {icon && !loading && icon}
            {loading ? "Processing..." : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
