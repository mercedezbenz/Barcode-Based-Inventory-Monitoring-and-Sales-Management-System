"use client"

import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Camera, Loader2, Save, User, Car, CreditCard, CheckCircle2, AlertCircle, Upload, Cloud, LogIn } from "lucide-react"
import { getFirebaseDb } from "@/lib/firebase-live"
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { toast } from "sonner"
import {
    initGoogleDriveClient,
    signInToGoogle,
    isGoogleAuthenticated,
    uploadFileToGoogleDrive,
    onAuthStateChange,
    type GoogleUserProfile,
} from "@/lib/google-drive-service"

interface User {
    id: string
    uid?: string
    email: string
    fullName?: string
    name?: string
    role: string
    status?: string
    profilePhotoUrl?: string
    googleDrivePhotoUrl?: string
    licenseNumber?: string
    truckPlateNumber?: string
}

// Helper to convert Google Drive view URL to embeddable image URL
function getDisplayablePhotoUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined

    // If it's already the direct format, return as-is
    if (url.includes('lh3.googleusercontent.com')) {
        return url
    }

    // If it's a Google Drive URL, convert to direct image URL
    // Example: https://drive.google.com/file/d/FILE_ID/view -> https://lh3.googleusercontent.com/d/FILE_ID
    const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/)
    if (driveMatch) {
        return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`
    }

    // Also handle uc?export=view format
    const ucMatch = url.match(/drive\.google\.com\/uc\?.*id=([^&]+)/)
    if (ucMatch) {
        return `https://lh3.googleusercontent.com/d/${ucMatch[1]}`
    }

    return url
}

interface EditUserDialogProps {
    user: User | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onUserUpdated: () => void
}

export function EditUserDialog({ user, open, onOpenChange, onUserUpdated }: EditUserDialogProps) {
    const [loading, setLoading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle")
    const [profilePhoto, setProfilePhoto] = useState<File | null>(null)
    const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null)
    const [fullName, setFullName] = useState("")
    const [licenseNumber, setLicenseNumber] = useState("")
    const [truckPlateNumber, setTruckPlateNumber] = useState("")
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Google Drive auth state
    const [isGoogleConnected, setIsGoogleConnected] = useState(false)
    const [googleProfile, setGoogleProfile] = useState<GoogleUserProfile | null>(null)
    const [isConnectingGoogle, setIsConnectingGoogle] = useState(false)
    const [googleInitialized, setGoogleInitialized] = useState(false)

    // Initialize Google Drive client when dialog opens
    useEffect(() => {
        if (open && !googleInitialized) {
            initGoogleDriveClient()
                .then(() => {
                    setGoogleInitialized(true)
                    console.log("[EditUserDialog] Google Drive client initialized")
                })
                .catch((error) => {
                    console.error("[EditUserDialog] Failed to initialize Google Drive:", error)
                })
        }
    }, [open, googleInitialized])

    // Subscribe to Google auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChange((isAuth, profile) => {
            setIsGoogleConnected(isAuth)
            setGoogleProfile(profile)
        })
        return () => unsubscribe()
    }, [])

    // Reset form when user changes or dialog opens
    useEffect(() => {
        if (open && user) {
            setProfilePhoto(null)
            // Convert Google Drive URL to displayable format for preview
            const existingPhotoUrl = user.googleDrivePhotoUrl || user.profilePhotoUrl
            setProfilePhotoPreview(getDisplayablePhotoUrl(existingPhotoUrl) || null)
            setFullName(user.fullName || user.name || "")
            setLicenseNumber(user.licenseNumber || "")
            setTruckPlateNumber(user.truckPlateNumber || "")
            setUploadProgress(0)
            setUploadStatus("idle")
        }
    }, [open, user])

    // Handle dialog close
    const handleOpenChange = (isOpen: boolean) => {
        if (!loading) {
            onOpenChange(isOpen)
        }
    }

    // Handle Google Drive connection
    const handleConnectGoogle = async () => {
        setIsConnectingGoogle(true)
        try {
            await signInToGoogle()
            toast.success("Connected to Google Drive", {
                description: "You can now upload photos to Google Drive",
            })
        } catch (error: any) {
            toast.error("Failed to connect", {
                description: error.message || "Please try again",
            })
        } finally {
            setIsConnectingGoogle(false)
        }
    }

    // Handle file selection
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            // Validate file type
            if (!file.type.startsWith("image/")) {
                toast.error("Invalid file type", {
                    description: "Please select an image file (JPG, PNG, GIF, etc.)",
                })
                return
            }
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                toast.error("File too large", {
                    description: "Image must be less than 5MB",
                })
                return
            }
            setProfilePhoto(file)
            setProfilePhotoPreview(URL.createObjectURL(file))
            setUploadStatus("idle")
            toast.success("Photo selected", {
                description: `${file.name} ready to upload`,
            })
        }
    }

    // Upload photo to Google Drive with progress tracking
    const uploadPhotoToGoogleDrive = async (): Promise<string | null> => {
        if (!profilePhoto || !user) return null

        setUploadStatus("uploading")
        setUploadProgress(0)

        try {
            const result = await uploadFileToGoogleDrive(
                profilePhoto,
                "DecktaGO Profile Photos",
                (progress) => setUploadProgress(progress)
            )

            if (result.success) {
                console.log("[EditUserDialog] Photo uploaded to Google Drive:", result.webViewLink)
                setUploadStatus("success")
                return result.webViewLink
            } else {
                throw new Error(result.error || "Upload failed")
            }
        } catch (error: any) {
            console.error("[EditUserDialog] Google Drive upload error:", error)
            setUploadStatus("error")
            throw error
        }
    }

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) {
            console.error("[EditUserDialog] No user provided!")
            return
        }

        // Validate user.id
        if (!user.id || typeof user.id !== 'string' || user.id.trim() === '') {
            console.error("[EditUserDialog] Invalid user.id:", user.id)
            toast.error("Cannot save: Invalid user ID", {
                description: "Please refresh the page and try again.",
            })
            return
        }

        setLoading(true)

        try {
            let photoUrl: string | null = null

            // Step 1: Upload photo to Google Drive if a new one was selected
            if (profilePhoto) {
                if (!isGoogleConnected) {
                    toast.error("Not connected to Google Drive", {
                        description: "Please connect to Google Drive first to upload photos",
                    })
                    setLoading(false)
                    return
                }

                toast.loading("Uploading photo to Google Drive...", { id: "upload-photo" })
                try {
                    photoUrl = await uploadPhotoToGoogleDrive()
                    toast.success("Photo uploaded to Google Drive!", { id: "upload-photo" })
                } catch (error: any) {
                    toast.error("Failed to upload photo", {
                        id: "upload-photo",
                        description: error.message || "Please try again",
                    })
                    setLoading(false)
                    return
                }
            }

            // Step 2: Prepare update data
            const updateData: Record<string, any> = {
                fullName: fullName.trim(),
                licenseNumber: licenseNumber.trim(),
                truckPlateNumber: truckPlateNumber.trim(),
                updatedAt: serverTimestamp(),
            }

            // Update photo URL if a new photo was uploaded
            if (photoUrl) {
                updateData.googleDrivePhotoUrl = photoUrl
                updateData.profilePhotoUrl = photoUrl // Also update profilePhotoUrl for backward compatibility
            }

            // Step 3: Update Firestore document
            console.log("=".repeat(50))
            console.log("[EditUserDialog] 📝 SAVING TO FIRESTORE")
            console.log("[EditUserDialog] User ID:", user.id)
            console.log("[EditUserDialog] User Email:", user.email)
            console.log("[EditUserDialog] Update data:", updateData)
            console.log("=".repeat(50))

            toast.loading("Saving changes...", { id: "save-profile" })

            const db = getFirebaseDb()
            const userDocRef = doc(db, "users", user.id)
            console.log("[EditUserDialog] Document path: users/" + user.id)

            await updateDoc(userDocRef, updateData)

            console.log("[EditUserDialog] ✅ SUCCESS! Data saved to users/" + user.id)

            // Success!
            toast.success("Profile updated successfully!", {
                id: "save-profile",
                description: `${fullName || user.email}'s profile has been saved.`,
            })

            // Refresh the user list and close dialog
            onUserUpdated()
            onOpenChange(false)

        } catch (error: any) {
            console.error("[EditUserDialog] ❌ FIRESTORE ERROR:", error)
            console.error("[EditUserDialog] Error code:", error.code)
            console.error("[EditUserDialog] Error message:", error.message)
            toast.error("Failed to update profile", {
                id: "save-profile",
                description: error.code === 'permission-denied'
                    ? "Permission denied. Check Firestore rules."
                    : error.message || "Something went wrong. Please try again.",
            })
        } finally {
            setLoading(false)
        }
    }

    if (!user) return null

    const displayName = user.fullName || user.name || user.email
    const initials = displayName.substring(0, 2).toUpperCase()

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <User className="h-5 w-5" />
                        Edit User Profile
                    </DialogTitle>
                    <DialogDescription>
                        Update profile information for <span className="font-medium text-foreground">{displayName}</span>
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Google Drive Connection Status */}
                    {!isGoogleConnected && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-sm">
                                    <Cloud className="h-4 w-4 text-amber-600" />
                                    <span className="text-amber-700 dark:text-amber-400">
                                        Connect Google Drive to upload photos
                                    </span>
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleConnectGoogle}
                                    disabled={isConnectingGoogle}
                                    className="gap-1.5 shrink-0"
                                >
                                    {isConnectingGoogle ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <LogIn className="h-3.5 w-3.5" />
                                    )}
                                    Connect
                                </Button>
                            </div>
                        </div>
                    )}

                    {isGoogleConnected && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Connected to Google Drive</span>
                                {googleProfile && (
                                    <span className="text-muted-foreground">({googleProfile.email})</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Profile Photo Section */}
                    <div className="flex flex-col items-center gap-4 py-2">
                        <div className="relative group">
                            <Avatar className="h-28 w-28 border-4 border-background shadow-xl ring-2 ring-primary/20">
                                <AvatarImage
                                    src={profilePhotoPreview || getDisplayablePhotoUrl(user.googleDrivePhotoUrl) || getDisplayablePhotoUrl(user.profilePhotoUrl)}
                                    alt={displayName}
                                />
                                <AvatarFallback className="text-3xl font-semibold bg-gradient-to-br from-primary/20 to-primary/5">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={loading || !isGoogleConnected}
                                className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
                            >
                                <Camera className="h-7 w-7 text-white" />
                            </button>

                            {/* Upload status indicator */}
                            {uploadStatus === "success" && (
                                <div className="absolute -bottom-1 -right-1 h-8 w-8 bg-green-500 rounded-full flex items-center justify-center border-2 border-background">
                                    <CheckCircle2 className="h-5 w-5 text-white" />
                                </div>
                            )}
                            {uploadStatus === "error" && (
                                <div className="absolute -bottom-1 -right-1 h-8 w-8 bg-destructive rounded-full flex items-center justify-center border-2 border-background">
                                    <AlertCircle className="h-5 w-5 text-white" />
                                </div>
                            )}
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            onChange={handleFileChange}
                            className="hidden"
                            disabled={loading || !isGoogleConnected}
                        />

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={loading || !isGoogleConnected}
                            className="gap-2"
                        >
                            <Upload className="h-4 w-4" />
                            {profilePhoto ? "Change Photo" : profilePhotoPreview ? "Change Photo" : "Upload Photo"}
                        </Button>

                        {/* Upload progress bar */}
                        {uploadStatus === "uploading" && (
                            <div className="w-full max-w-[200px] space-y-1">
                                <Progress value={uploadProgress} className="h-2" />
                                <p className="text-xs text-center text-muted-foreground">
                                    Uploading to Google Drive... {uploadProgress}%
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-4">
                        {/* Full Name */}
                        <div className="space-y-2">
                            <Label htmlFor="fullName" className="flex items-center gap-2 text-sm font-medium">
                                <User className="h-4 w-4 text-muted-foreground" />
                                Full Name
                            </Label>
                            <Input
                                id="fullName"
                                placeholder="e.g., John Doe"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                disabled={loading}
                                className="h-11"
                            />
                        </div>

                        {/* License Number */}
                        <div className="space-y-2">
                            <Label htmlFor="licenseNumber" className="flex items-center gap-2 text-sm font-medium">
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                                Driver&apos;s License Number
                            </Label>
                            <Input
                                id="licenseNumber"
                                placeholder="e.g., N01-12-345678"
                                value={licenseNumber}
                                onChange={(e) => setLicenseNumber(e.target.value)}
                                disabled={loading}
                                className="h-11 font-mono"
                            />
                        </div>

                        {/* Truck Plate Number */}
                        <div className="space-y-2">
                            <Label htmlFor="truckPlateNumber" className="flex items-center gap-2 text-sm font-medium">
                                <Car className="h-4 w-4 text-muted-foreground" />
                                Truck Plate Number
                            </Label>
                            <Input
                                id="truckPlateNumber"
                                placeholder="e.g., ABC 1234"
                                value={truckPlateNumber}
                                onChange={(e) => setTruckPlateNumber(e.target.value.toUpperCase())}
                                disabled={loading}
                                className="h-11 font-mono uppercase"
                            />
                        </div>
                    </div>

                    {/* User Info (Read-only) */}
                    <div className="p-4 bg-muted/50 rounded-xl border space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Email</span>
                            <span className="text-sm font-medium">{user.email}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Role</span>
                            <span className="text-sm font-medium capitalize">{user.role}</span>
                        </div>
                    </div>

                    <DialogFooter className="gap-3 sm:gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                            className="flex-1 sm:flex-none h-11"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="flex-1 sm:flex-none h-11 gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
