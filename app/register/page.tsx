"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { RegisterForm } from "@/components/auth/register-form"

export default function RegisterPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    if (!loading && user) {
      router.replace("/")
    }
    if (!loading && !user) {
      setShowForm(true)
    }
  }, [user, loading, router])

  if (!loading && user) {
    return (
      <div
        className="min-h-screen w-full flex flex-col items-center justify-center"
        style={{ background: "#eef4fb" }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
        <p style={{ color: "#64748b" }}>Redirecting to dashboard...</p>
      </div>
    )
  }

  return <RegisterForm />
}
