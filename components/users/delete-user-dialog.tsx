"use client"

import { useState } from "react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"

interface User {
    id: string
    email: string
    fullName?: string
    name?: string
    role: string
    profilePhotoUrl?: string
}

interface DeleteUserDialogProps {
    user: User | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirmDelete: () => Promise<void>
}

export function DeleteUserDialog({
    user,
    open,
    onOpenChange,
    onConfirmDelete
}: DeleteUserDialogProps) {
    const [isDeleting, setIsDeleting] = useState(false)

    if (!user) return null

    const displayName = user.fullName || user.name || user.email
    const initials = displayName.substring(0, 2).toUpperCase()

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            await onConfirmDelete()
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader className="space-y-4">
                    {/* Warning Icon */}
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                        <AlertTriangle className="h-8 w-8 text-destructive" />
                    </div>

                    <AlertDialogTitle className="text-center text-xl">
                        Delete User
                    </AlertDialogTitle>

                    <AlertDialogDescription className="text-center space-y-4">
                        <p className="text-base">
                            Are you sure you want to delete this user? This action cannot be undone.
                        </p>

                        {/* User Info Card */}
                        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border mt-4">
                            <Avatar className="h-12 w-12 border-2 border-background shadow">
                                <AvatarImage src={user.profilePhotoUrl} alt={displayName} />
                                <AvatarFallback className="text-sm font-semibold bg-primary/10">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-left">
                                <p className="font-semibold text-foreground">
                                    {displayName}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {user.email}
                                </p>
                                <p className="text-xs text-muted-foreground capitalize mt-0.5">
                                    {user.role}
                                </p>
                            </div>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter className="mt-6 gap-3 sm:gap-3">
                    <AlertDialogCancel
                        disabled={isDeleting}
                        className="flex-1 h-11"
                    >
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="flex-1 h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            <>
                                <Trash2 className="h-4 w-4" />
                                Delete User
                            </>
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
