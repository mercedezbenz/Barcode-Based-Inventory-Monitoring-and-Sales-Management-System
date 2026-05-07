"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useCallback } from "react"
// Removed mock-auth and mock-firestore imports - always using live Firebase
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase-live"
import { onAuthStateChanged as fbOnAuthStateChanged, signInWithEmailAndPassword as fbSignIn, signOut as fbSignOut, sendPasswordResetEmail as fbSendReset } from "firebase/auth"
import { doc as fbDoc, getDoc as fbGetDoc, setDoc as fbSetDoc, updateDoc as fbUpdateDoc } from "firebase/firestore"
import type { User } from "@/lib/types"

interface AuthContextType {
  user: User | null
  firebaseUser: any | null
  loading: boolean
  isLoggingOut: boolean
  signIn: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  createDefaultUser: () => Promise<void>
  isAdmin: boolean
  isStaff: boolean

  isSales: boolean
  isPurchasing: boolean
  isOwner: boolean
  isEncoder: boolean
  isReadOnly: boolean
  canManageInventory: boolean
  canEditInventory: boolean
  firebaseError: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const DEFAULT_ADMIN_EMAIL = "admin@decktago.com"
const DEFAULT_ADMIN_PASSWORD = "admin123"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [firebaseError, setFirebaseError] = useState<string | null>(null)

  useEffect(() => {
    let unsubscribe: (() => void) | null = null
    let timeoutId: NodeJS.Timeout | null = null
    let isResolved = false

    try {
      // Always use live Firebase - no longer using mock auth
      console.log("[Auth] Initializing Firebase authentication (always using live Firebase)")
      
      // Set a timeout to ensure loading becomes false even if Firebase is slow
      timeoutId = setTimeout(() => {
        if (!isResolved) {
          console.log("[Auth] Firebase auth initialization timeout - setting loading to false")
          isResolved = true
          setLoading(false)
        }
      }, 2000) // 2 second timeout

      unsubscribe = fbOnAuthStateChanged(getFirebaseAuth(), async (authUser: any) => {
        try {
          // Clear timeout since we got a response
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
          isResolved = true

          if (authUser) {
            const db = getFirebaseDb()
            const docRef = fbDoc(db, "users", authUser.uid)
            const docSnap = await fbGetDoc(docRef)
            if (docSnap.exists()) {
              const userData = docSnap.data() as any
              setUser({ uid: authUser.uid, ...userData })
            } else {
              // Create user document if it doesn't exist
              const userData = {
                uid: authUser.uid,
                email: authUser.email,
                role: "admin" as const,
                status: "active" as const,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
              await fbSetDoc(docRef, userData)
              setUser(userData as any)
            }
            setFirebaseUser(authUser)
          } else {
            console.log("[Auth] onAuthStateChanged: no Firebase user, clearing state")
            setUser(null)
            setFirebaseUser(null)
          }
        } catch (error) {
          console.error("[Auth] Error in auth state change:", error)
          setFirebaseError(error instanceof Error ? error.message : "Auth error")
        } finally {
          setLoading(false)
        }
      })

      return () => {
        if (unsubscribe) unsubscribe()
        if (timeoutId) clearTimeout(timeoutId)
      }
    } catch (error) {
      console.error("[v0] Auth initialization error:", error)
      setLoading(false)
      setFirebaseError(error instanceof Error ? error.message : "Auth initialization failed")
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      // Clear any previous errors
      setFirebaseError(null)
      
      // Always use live Firebase
      console.log("[Auth] Signing in with Firebase:", email)
      const result = await fbSignIn(getFirebaseAuth(), email, password)

      // Check user document in Firestore
      const db = getFirebaseDb()
      const authUser = (result as any).user
      const docRef = fbDoc(db, "users", authUser.uid)
      const docSnap = await fbGetDoc(docRef)

      if (!docSnap.exists()) {
        // Create user document if it doesn't exist
        const userData = {
          uid: authUser.uid,
          email: authUser.email,
          role: "admin" as const,
          status: "active" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        await fbSetDoc(docRef, userData)
        console.log("[Auth] Created user document for:", authUser.email)
      } else {
        const userData = docSnap.data() as any
        
        // Auto-patch missing fields (e.g. documents created without status)
        if (!userData.status || !userData.role) {
          const patchData: any = { updatedAt: new Date().toISOString() }
          if (!userData.status) patchData.status = "active"
          if (!userData.role) patchData.role = "staff"
          await fbUpdateDoc(docRef, patchData)
          console.log("[Auth] Auto-patched missing fields for:", authUser.email, patchData)
          // Re-read after patch
          userData.status = userData.status || patchData.status
          userData.role = userData.role || patchData.role
        }
        
        if (userData.role !== "admin" && userData.role !== "staff" && userData.role !== "sales" && userData.role !== "purchasing" && userData.role !== "owner" && userData.role !== "encoder") {
          await fbSignOut(getFirebaseAuth())
          throw new Error("Access denied. Valid role required.")
        }

        if (userData.status !== "active") {
          await fbSignOut(getFirebaseAuth())
          throw new Error(`Account status is "${userData.status}". Please contact an administrator.`)
        }
      }
    } catch (error: any) {
      console.error("[Auth] Sign in error:", error)
      setFirebaseError(error.message || "Failed to sign in")
      throw error
    }
  }

  const resetPassword = async (email: string) => {
    try {
      // Always use live Firebase
      await fbSendReset(getFirebaseAuth(), email)
    } catch (error) {
      throw error
    }
  }

  const createDefaultUser = async () => {
    try {
      // Always use live Firebase - create user in Firestore
      const db = getFirebaseDb()
      const userData = {
        uid: "admin-123",
        email: DEFAULT_ADMIN_EMAIL,
        role: "admin" as const,
        status: "active" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const docRef = fbDoc(db, "users", userData.uid)
      await fbSetDoc(docRef, userData)

      console.log("[Auth] Default admin user created successfully in Firebase")
    } catch (error: any) {
      console.error("[Auth] Error creating default user:", error)
      throw error
    }
  }



  const logout = async () => {
    try {
      console.log("[Auth] Logging out...")
      
      // ✅ Set logging-out state IMMEDIATELY — blocks dashboard rendering
      setIsLoggingOut(true)
      
      // Sign out from Firebase
      if (firebaseUser) {
        await fbSignOut(getFirebaseAuth())
      }
      
      // Clear any cached data
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth")
        localStorage.removeItem("firestore")
        // Redirect to login page
        window.location.href = "/login"
      }
    } catch (error) {
      console.error("[Auth] Logout error:", error)
      // Still clear state and redirect even if signOut fails
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth")
        localStorage.removeItem("firestore")
        window.location.href = "/login"
      }
    }
  }

  const isAdmin = user?.role === "admin" && user?.status === "active"
  const isStaff = user?.role === "staff" && user?.status === "active"

  const isSales = user?.role === "sales" && user?.status === "active"
  const isPurchasing = user?.role === "purchasing" && user?.status === "active"
  const isOwner = user?.role === "owner" && user?.status === "active"
  const isEncoder = user?.role === "encoder" && user?.status === "active"
  // isReadOnly: owner sees everything but cannot perform any write actions
  const isReadOnly = user?.role === "owner" && user?.status === "active"
  const canManageInventory = (user?.role === "admin" || user?.role === "staff" || user?.role === "purchasing" || user?.role === "encoder") && user?.status === "active"
  // canEditInventory: true for roles that can add/edit/delete items. Owner = view-only.
  const canEditInventory = (user?.role === "admin" || user?.role === "staff" || user?.role === "encoder") && user?.status === "active"

  const value = {
    user,
    firebaseUser,
    loading,
    isLoggingOut,
    signIn,
    logout,
    resetPassword,
    createDefaultUser,
    isAdmin,
    isStaff,

    isSales,
    isPurchasing,
    isOwner,
    isEncoder,
    isReadOnly,
    canManageInventory,
    canEditInventory,
    firebaseError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
