"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase-live"
import { logActivity } from "@/lib/activity-logger"
import { Loader2, AlertTriangle, Eye, EyeOff, Mail, Lock, User, Phone } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export function RegisterForm() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [mounted, setMounted] = useState(false)

  const router = useRouter()

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100)
    return () => clearTimeout(t)
  }, [])

  function validate(): string | null {
    if (!fullName.trim()) return "Full name is required."
    if (!email.trim()) return "Email address is required."
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Please enter a valid email address."
    if (password.length < 6) return "Password must be at least 6 characters."
    if (password !== confirmPassword) return "Passwords do not match."
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      const auth = getFirebaseAuth()
      const db = getFirebaseDb()
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      const uid = cred.user.uid

      await setDoc(doc(db, "users", uid), {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phoneNumber: phoneNumber.trim() || null,
        role: "pending",
        status: "active",
        createdAt: serverTimestamp(),
        approvedAt: null,
        approvedBy: null,
      })

      await logActivity({
        type: "user_registered",
        message: `${fullName.trim()} registered an account`,
        performedBy: uid,
        role: "owner",
      }).catch(() => {})

      router.replace("/pending-approval")
    } catch (err: any) {
      console.error("[Register] Error:", err)
      const code = err.code || ""
      if (code.includes("email-already-in-use")) {
        setError("This email is already registered. Please use a different email or login.")
      } else if (code.includes("weak-password")) {
        setError("Password is too weak. Use at least 6 characters.")
      } else if (code.includes("invalid-email")) {
        setError("Please enter a valid email address.")
      } else {
        setError("Registration failed. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        .register-page-root {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          position: fixed;
          inset: 0;
          overflow: hidden;
        }

        .register-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
        }

        .register-bg img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: blur(3px) brightness(0.92) saturate(0.95);
        }

        .register-bg-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            160deg,
            rgba(200, 220, 245, 0.25) 0%,
            rgba(180, 210, 248, 0.22) 35%,
            rgba(195, 218, 248, 0.25) 65%,
            rgba(185, 212, 242, 0.28) 100%
          );
          z-index: 1;
        }

        .register-bg-particles {
          position: absolute;
          inset: 0;
          z-index: 2;
          background:
            radial-gradient(ellipse at 20% 40%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 75% 25%, rgba(6, 182, 212, 0.06) 0%, transparent 40%),
            radial-gradient(ellipse at 55% 75%, rgba(99, 102, 241, 0.04) 0%, transparent 45%);
          pointer-events: none;
        }

        .register-card-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 650px;
          height: 400px;
          background: radial-gradient(
            ellipse at center,
            rgba(135, 200, 245, 0.10) 0%,
            rgba(135, 210, 240, 0.05) 40%,
            transparent 70%
          );
          border-radius: 50%;
          filter: blur(60px);
          pointer-events: none;
          z-index: 5;
          opacity: 0.5;
        }

        .register-card-wrapper {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 1.5rem;
          overflow-y: auto;
          gap: 1.5rem;
        }

        .register-card {
          display: flex;
          max-width: 900px;
          width: 100%;
          min-height: 540px;
          border-radius: 24px;
          overflow: visible;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(4px) saturate(1.05);
          -webkit-backdrop-filter: blur(4px) saturate(1.05);
          border: 1px solid rgba(255, 255, 255, 0.95);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.02);
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .register-card.mounted {
          opacity: 1;
          transform: translateY(0);
        }

        .register-left {
          display: none;
          width: 42%;
          padding: 3rem 2.5rem;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          position: relative;
          border-right: 1px solid rgba(200, 215, 235, 0.4);
          border-radius: 24px 0 0 24px;
          overflow: hidden;
        }

        @media (min-width: 768px) {
          .register-left { display: flex; }
        }

        .register-right {
          flex: 1;
          padding: 2.5rem 2.75rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          position: relative;
          border-radius: 0 24px 24px 0;
          overflow: hidden;
        }

        @media (max-width: 767px) {
          .register-right { padding: 2rem 1.75rem; }
        }

        .register-input-group {
          position: relative;
          margin-bottom: 1rem;
        }

        .register-input-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          width: 18px;
          height: 18px;
          color: #94a3b8;
          transition: color 0.3s ease;
          z-index: 2;
          pointer-events: none;
        }

        .register-input {
          width: 100%;
          padding: 13px 48px 13px 46px;
          font-size: 0.88rem;
          font-family: 'Inter', sans-serif;
          font-weight: 400;
          color: #1e293b;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(148, 163, 184, 0.30);
          border-radius: 12px;
          outline: none;
          transition: all 0.3s ease;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .register-input::placeholder {
          color: #94a3b8 !important;
          opacity: 1 !important;
          font-weight: 400;
        }

        .register-input:focus {
          background: #ffffff;
          border-color: rgba(59, 130, 246, 0.5);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.10), 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .register-input:focus ~ .register-input-icon {
          color: #3b82f6;
        }

        .register-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .register-eye-btn {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: #94a3b8;
          transition: color 0.2s;
          z-index: 2;
        }

        .register-eye-btn:hover { color: #64748b; }

        .register-submit-btn {
          width: 100%;
          padding: 13px 24px;
          margin-top: 0.5rem;
          font-family: 'Inter', sans-serif;
          font-size: 0.92rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: #ffffff;
          background: linear-gradient(135deg, #3b9de8 0%, #2cb8cc 100%);
          border: none;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 4px 14px rgba(59, 157, 232, 0.35), 0 2px 4px rgba(0, 0, 0, 0.08);
        }

        .register-submit-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(86, 180, 240, 0.28), 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .register-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .register-error {
          padding: 12px 16px;
          margin-bottom: 1rem;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.18);
          border-radius: 12px;
          color: #b91c1c;
          font-size: 0.8rem;
          line-height: 1.5;
          display: flex;
          gap: 10px;
          align-items: flex-start;
          animation: regErrorSlide 0.3s ease-out;
        }

        @keyframes regErrorSlide {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .register-corner-accent {
          position: absolute;
          width: 120px;
          height: 120px;
          border-radius: 50%;
          filter: blur(60px);
          pointer-events: none;
          opacity: 0.08;
        }

        .register-corner-accent.top-right {
          top: -40px;
          right: -40px;
          background: #87bef5;
        }

        .register-corner-accent.bottom-left {
          bottom: -40px;
          left: -40px;
          background: #7dd3e8;
        }

        .register-mobile-brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          margin-bottom: 1.5rem;
        }

        @media (min-width: 768px) {
          .register-mobile-brand { display: none; }
        }
      `}</style>

      <div className="register-page-root">
        {/* Background */}
        <div className="register-bg">
          <Image
            src="/images/warehouse-bg.png"
            alt=""
            fill
            priority
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
        </div>
        <div className="register-bg-overlay" />
        <div className="register-bg-particles" />
        <div className="register-card-glow" />

        {/* Card */}
        <div className="register-card-wrapper">
          <div className={`register-card ${mounted ? "mounted" : ""}`}>
            <div className="register-corner-accent top-right" />
            <div className="register-corner-accent bottom-left" />

            {/* Left Panel */}
            <div className="register-left">
              <div style={{ marginBottom: "1.25rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Image
                  src="/logo.png"
                  alt="DPE Logo"
                  width={160}
                  height={100}
                  style={{ objectFit: "contain", width: "160px", height: "auto" }}
                  priority
                />
              </div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#0f2b4a", letterSpacing: "-0.01em", textAlign: "center" }}>
                Deckta<span style={{ color: "#1a8cc7" }}>GO</span>
              </div>
              <p style={{ fontSize: "0.78rem", color: "#64748b", textAlign: "center", marginTop: "0.75rem", lineHeight: 1.6 }}>
                Barcode-Based Inventory Monitoring &amp; Sales Management System
              </p>
            </div>

            {/* Right Panel */}
            <div className="register-right">
              {/* Mobile Branding */}
              <div className="register-mobile-brand">
                <Image
                  src="/logo.png"
                  alt="DPE Logo"
                  width={100}
                  height={62}
                  style={{ objectFit: "contain", width: "100px", height: "auto" }}
                  priority
                />
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0f2b4a" }}>
                  Deckta<span style={{ color: "#1a8cc7" }}>GO</span>
                </div>
              </div>

              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.3rem", letterSpacing: "-0.02em" }}>
                Create Account
              </h2>
              <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "1.5rem", fontWeight: 400 }}>
                Register as an employee
              </p>

              <form onSubmit={handleSubmit} autoComplete="off">
                {error && (
                  <div className="register-error">
                    <AlertTriangle style={{ flexShrink: 0, width: 16, height: 16, marginTop: 1 }} />
                    <div>{error}</div>
                  </div>
                )}

                {/* Full Name */}
                <div className="register-input-group">
                  <User className="register-input-icon" />
                  <input
                    id="register-name"
                    type="text"
                    placeholder="Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={loading}
                    className="register-input"
                  />
                </div>

                {/* Email */}
                <div className="register-input-group">
                  <Mail className="register-input-icon" />
                  <input
                    id="register-email"
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="register-input"
                  />
                </div>

                {/* Phone */}
                <div className="register-input-group">
                  <Phone className="register-input-icon" />
                  <input
                    id="register-phone"
                    type="tel"
                    placeholder="Phone Number (optional)"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={loading}
                    className="register-input"
                  />
                </div>

                {/* Password */}
                <div className="register-input-group">
                  <Lock className="register-input-icon" />
                  <input
                    id="register-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Password (min 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="register-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="register-eye-btn"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Confirm Password */}
                <div className="register-input-group">
                  <Lock className="register-input-icon" />
                  <input
                    id="register-confirm"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="register-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="register-eye-btn"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  className="register-submit-btn"
                  disabled={loading}
                >
                  <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: "8px" }}>
                    {loading && <Loader2 size={18} className="animate-spin" />}
                    {loading ? "Creating Account..." : "Create Account"}
                  </span>
                </button>
              </form>

              {/* Login Link */}
              <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
                <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    style={{ color: "#3b82f6", fontWeight: 600, textDecoration: "none" }}
                    onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
                    onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
                  >
                    Sign In
                  </Link>
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={`transition-all duration-1000 delay-300 ${mounted ? "opacity-60 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <p style={{ fontSize: "11px", fontWeight: 500, color: "#64748b", letterSpacing: "0.05em" }}>
              Need help? Contact <a href="mailto:support@decktago.com" style={{ color: "#3b82f6", textDecoration: "none" }}>System Administrator</a>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
