"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Clock, LogOut, CheckCircle2, ShieldCheck } from "lucide-react"

export default function PendingApprovalPage() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login")
    }
    // If user is approved (not pending), send them to dashboard
    if (!loading && user && user.role?.toLowerCase().trim() !== "pending") {
      router.replace("/")
    }
  }, [user, loading, router])

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        .pending-root {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          position: fixed;
          inset: 0;
          overflow: hidden;
        }

        .pending-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
        }

        .pending-bg img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: blur(3px) brightness(0.92) saturate(0.95);
        }

        .pending-bg-overlay {
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

        .pending-wrapper {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 1.5rem;
          gap: 1.5rem;
        }

        .pending-card {
          max-width: 520px;
          width: 100%;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(4px) saturate(1.05);
          border: 1px solid rgba(255, 255, 255, 0.95);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.02);
          padding: 3rem 2.5rem;
          text-align: center;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .pending-card.mounted {
          opacity: 1;
          transform: translateY(0);
        }

        @media (max-width: 640px) {
          .pending-card {
            padding: 2rem 1.5rem;
          }
        }

        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.05); opacity: 0.2; }
          100% { transform: scale(0.95); opacity: 0.5; }
        }

        @keyframes gentle-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="pending-root">
        <div className="pending-bg">
          <Image
            src="/images/warehouse-bg.png"
            alt=""
            fill
            priority
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
        </div>
        <div className="pending-bg-overlay" />

        <div className="pending-wrapper">
          <div className={`pending-card ${mounted ? "mounted" : ""}`}>
            {/* Logo */}
            <div style={{ marginBottom: "1.5rem" }}>
              <Image
                src="/logo.png"
                alt="DPE Logo"
                width={120}
                height={75}
                style={{ objectFit: "contain", width: "120px", height: "auto", margin: "0 auto" }}
                priority
              />
              <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0f2b4a", marginTop: "0.5rem" }}>
                Deckta<span style={{ color: "#1a8cc7" }}>GO</span>
              </div>
            </div>

            {/* Animated Clock Icon */}
            <div style={{ position: "relative", display: "inline-flex", marginBottom: "1.5rem" }}>
              <div
                style={{
                  position: "absolute",
                  inset: "-8px",
                  borderRadius: "50%",
                  background: "rgba(251, 191, 36, 0.15)",
                  animation: "pulse-ring 2s ease-in-out infinite",
                }}
              />
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 14px rgba(251, 191, 36, 0.35)",
                }}
              >
                <Clock size={32} color="#ffffff" />
              </div>
            </div>

            {/* Message */}
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.75rem" }}>
              Account Pending Approval
            </h2>
            <p style={{ fontSize: "0.9rem", color: "#64748b", lineHeight: 1.6, marginBottom: "2rem", maxWidth: "380px", margin: "0 auto 2rem" }}>
              Your account has been created successfully. Please wait for the company owner to review and approve your account.
            </p>

            {/* Status Steps */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "2rem", textAlign: "left", maxWidth: "320px", margin: "0 auto 2rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <CheckCircle2 size={20} color="#22c55e" />
                <span style={{ fontSize: "0.85rem", color: "#334155" }}>Account created</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    border: "2px solid #fbbf24",
                    borderTopColor: "transparent",
                    animation: "gentle-spin 1s linear infinite",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: "0.85rem", color: "#fbbf24", fontWeight: 600 }}>Waiting for owner approval</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", opacity: 0.4 }}>
                <ShieldCheck size={20} color="#94a3b8" />
                <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Role assignment</span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={() => logout()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 24px",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#64748b",
                background: "rgba(241, 245, 249, 0.8)",
                border: "1px solid rgba(148, 163, 184, 0.3)",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                fontFamily: "inherit",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "rgba(226, 232, 240, 0.9)"
                e.currentTarget.style.color = "#334155"
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "rgba(241, 245, 249, 0.8)"
                e.currentTarget.style.color = "#64748b"
              }}
            >
              <LogOut size={16} />
              Back to Login
            </button>
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
