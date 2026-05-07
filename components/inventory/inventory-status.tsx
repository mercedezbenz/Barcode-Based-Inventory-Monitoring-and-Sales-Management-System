"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { InventoryService } from "@/services/firebase-service"

export function InventoryStatus() {
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "connected" | "error">("checking")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [itemCount, setItemCount] = useState<number>(0)
  const { user } = useAuth()

  const checkConnection = async () => {
    setConnectionStatus("checking")
    setErrorMessage("")

    try {
      const items = await InventoryService.getItems()
      setItemCount(items.length)
      setConnectionStatus("connected")
    } catch (error: any) {
      setConnectionStatus("error")
      setErrorMessage(error.message || "Failed to connect to Firebase")
    }
  }

  useEffect(() => {
    if (user) {
      checkConnection()
    }
  }, [user])

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case "checking":
        return <RefreshCw className="h-4 w-4 animate-spin" />
      case "connected":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case "checking":
        return <Badge variant="secondary">Checking...</Badge>
      case "connected":
        return (
          <Badge variant="default" className="bg-green-500">
            Connected
          </Badge>
        )
      case "error":
        return <Badge variant="destructive">Connection Error</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          Firebase Connection Status
        </CardTitle>
        <CardDescription>Current status of your Firebase Firestore connection</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span>Status:</span>
          {getStatusBadge()}
        </div>

        {connectionStatus === "connected" && (
          <div className="flex items-center justify-between">
            <span>Inventory Items:</span>
            <Badge variant="outline">{itemCount} items</Badge>
          </div>
        )}

        {connectionStatus === "error" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-800">Connection Error</p>
                <p className="text-sm text-red-700">{errorMessage}</p>
                {errorMessage.includes("permissions") && (
                  <p className="text-xs text-red-600 mt-2">
                    This error indicates that Firestore security rules need to be updated. Please run the security rules
                    script to fix this issue.
                  </p>
                )}
              </div>
            </div>
            <Button onClick={checkConnection} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Connection
            </Button>
          </div>
        )}

        {user && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span>Logged in as:</span>
              <Badge variant="outline">{user.email}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span>Role:</span>
              <Badge variant="outline">{user.role}</Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
