"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getFirebaseRealtimeDb } from "@/lib/firebase-live"
import { ref, onValue, get } from "firebase/database"
import { MapPin, Navigation, Truck } from "lucide-react"

interface DriverLocation {
  lat: number
  lng: number
}

interface DriverTrackingModalProps {
  driverId: string | null
  driverName?: string | null
  driverPhotoUrl?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DriverTrackingModal({ driverId, driverName, driverPhotoUrl, open, onOpenChange }: DriverTrackingModalProps) {
  const [currentLocation, setCurrentLocation] = useState<DriverLocation | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [driverInfo, setDriverInfo] = useState<{ licenseNumber?: string; truckPlateNumber?: string }>({})

  // Fetch driver details from Firestore
  useEffect(() => {
    if (!open || !driverId) return

    const fetchDriverDetails = async () => {
      try {
        const { getFirebaseDb } = await import("@/lib/firebase-live")
        const { collection, query, where, getDocs } = await import("firebase/firestore")

        const db = getFirebaseDb()
        const usersRef = collection(db, "users")
        const q = query(usersRef, where("email", "==", driverId))
        const snapshot = await getDocs(q)

        if (!snapshot.empty) {
          const userData = snapshot.docs[0].data()
          setDriverInfo({
            licenseNumber: userData.licenseNumber,
            truckPlateNumber: userData.truckPlateNumber,
          })
        }
      } catch (error) {
        console.error("[DriverTrackingModal] Error fetching driver details:", error)
      }
    }

    fetchDriverDetails()
  }, [open, driverId])

  // Fetch initial GPS location and subscribe to real-time updates
  useEffect(() => {
    if (!open) return

    const db = getFirebaseRealtimeDb()
    const gpsRef = ref(db, "gps/latest")

    // Fetch initial GPS data
    get(gpsRef)
      .then((snapshot) => {
        const data = snapshot.val()
        if (data) {
          const lat = data.latitude ?? data.lat
          const lng = data.longitude ?? data.lng
          if (typeof lat === "number" && typeof lng === "number") {
            setCurrentLocation({ lat, lng })
          }
        }
      })
      .catch((err) => {
        console.warn("[DriverTrackingModal] Could not fetch initial GPS:", err)
      })

    // Subscribe to real-time updates
    const unsubscribe = onValue(
      gpsRef,
      (snapshot) => {
        const data = snapshot.val()
        if (!data) return

        let lat: number | null = null
        let lng: number | null = null

        if (typeof data.lat === "number" && typeof data.lng === "number") {
          lat = data.lat
          lng = data.lng
        } else if (typeof data.latitude === "number" && typeof data.longitude === "number") {
          lat = data.latitude
          lng = data.longitude
        }

        if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
          setCurrentLocation({ lat, lng })
          setLocationError(null)
        }
      },
      (error) => {
        console.error("[DriverTrackingModal] Firebase error:", error)
        setLocationError("Failed to connect to GPS service.")
      }
    )

    return () => unsubscribe()
  }, [open])

  // Cleanup when modal closes
  useEffect(() => {
    if (!open) {
      setCurrentLocation(null)
      setLocationError(null)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Driver Tracking
          </DialogTitle>
          <DialogDescription>
            {driverName
              ? `GPS data for ${driverName}`
              : driverId
                ? `GPS data for ${driverId}`
                : "Live vehicle tracking"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {locationError && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-destructive text-sm font-medium">{locationError}</p>
            </div>
          )}

          {/* Driver Info Card */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Navigation className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{driverName || driverId || "Driver"}</p>
                <p className="text-xs text-muted-foreground">Real-time GPS coordinates</p>
              </div>
            </div>

            {(driverInfo.licenseNumber || driverInfo.truckPlateNumber) && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                {driverInfo.licenseNumber && (
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs">📋 License</span>
                    <span className="font-medium text-primary">{driverInfo.licenseNumber}</span>
                  </div>
                )}
                {driverInfo.truckPlateNumber && (
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs">🚛 Plate #</span>
                    <span className="font-medium text-green-600 dark:text-green-400">{driverInfo.truckPlateNumber}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* GPS Coordinates Card */}
          <div className="rounded-lg border p-4">
            {currentLocation ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-green-500" />
                  <span>Live GPS Position</span>
                  <span className="ml-auto inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-md p-3">
                    <p className="text-xs text-muted-foreground mb-1">Latitude</p>
                    <p className="text-sm font-mono font-semibold">{currentLocation.lat.toFixed(6)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-md p-3">
                    <p className="text-xs text-muted-foreground mb-1">Longitude</p>
                    <p className="text-sm font-mono font-semibold">{currentLocation.lng.toFixed(6)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <MapPin className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Waiting for GPS data...</p>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mt-3" />
              </div>
            )}
          </div>

          {/* Map disabled notice */}
          <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Map view has been disabled. GPS coordinates are displayed above.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
