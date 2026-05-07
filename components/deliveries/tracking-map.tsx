"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Navigation, Clock, Zap } from "lucide-react"
import type { Delivery } from "@/lib/types"
import { SinotackTrackingService } from "@/lib/sinotrack-service"
import { formatTimestamp } from "@/lib/utils"

interface TrackingMapProps {
  delivery: Delivery
}

interface LocationData {
  latitude: number
  longitude: number
  speed?: number
  timestamp: Date
}

export function TrackingMap({ delivery }: TrackingMapProps) {
  const [location, setLocation] = useState<LocationData | undefined>(delivery.lastKnownLocation as LocationData | undefined)

  // Subscribe to real-time location updates
  useEffect(() => {
    if (!delivery.sinotackDeviceId) return

    const subscribe = async () => {
      const unsubscribe = await SinotackTrackingService.subscribeToDeviceUpdates(
        delivery.sinotackDeviceId!,
        (newLocation) => {
          setLocation(newLocation)
        },
      )
      return unsubscribe
    }

    let unsubscribe: (() => void) | null = null
    subscribe().then((unsub) => {
      unsubscribe = unsub
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [delivery.sinotackDeviceId])

  if (!delivery.sinotackDeviceId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Live Tracking</CardTitle>
          <CardDescription>No Sinotrack device assigned to this delivery</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Assign a Sinotrack device ID to enable real-time tracking</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Live Tracking
            </span>
            <div className="flex items-center gap-2">
              {location && (
                <Badge variant="default" className="bg-green-500">
                  Active
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* GPS data placeholder (map removed) */}
          <div className="w-full rounded-lg overflow-hidden border relative bg-muted/30 flex flex-col items-center justify-center" style={{ minHeight: "200px" }}>
            {location ? (
              <div className="text-center space-y-3 p-6">
                <div className="flex items-center justify-center gap-2">
                  <MapPin className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium">GPS Position Received</span>
                  <span className="inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                </div>
                <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
                  <div className="bg-background rounded-md p-3 border">
                    <p className="text-xs text-muted-foreground mb-1">Latitude</p>
                    <p className="text-sm font-mono font-semibold">{location.latitude.toFixed(6)}</p>
                  </div>
                  <div className="bg-background rounded-md p-3 border">
                    <p className="text-xs text-muted-foreground mb-1">Longitude</p>
                    <p className="text-sm font-mono font-semibold">{location.longitude.toFixed(6)}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Map view has been disabled. GPS coordinates are shown above.</p>
              </div>
            ) : (
              <div className="text-center p-6">
                <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Waiting for GPS data...</p>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto mt-3" />
              </div>
            )}
          </div>

          {location && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Navigation className="h-4 w-4" />
                  <span>Coordinates</span>
                </div>
                <div className="font-mono text-sm">
                  {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </div>
              </div>

              {location.speed !== undefined && (
                <div className="space-y-2 p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Zap className="h-4 w-4" />
                    <span>Speed</span>
                  </div>
                  <div className="font-mono text-sm">{location.speed} km/h</div>
                </div>
              )}

              <div className="space-y-2 p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Last Update</span>
                </div>
                <div className="font-mono text-sm">{formatTimestamp(location.timestamp)}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
