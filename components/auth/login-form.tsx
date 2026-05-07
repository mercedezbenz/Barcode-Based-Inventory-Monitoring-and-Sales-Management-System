"use client";

import type React from "react";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, AlertTriangle, Clock, Eye, EyeOff, Mail, Lock } from "lucide-react";
import Image from "next/image";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { signIn, firebaseError } = useAuth();
  const router = useRouter();

  // Trigger mount animation
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (rateLimitCountdown > 0) {
      interval = setInterval(() => {
        setRateLimitCountdown((prev) => {
          if (prev <= 1) {
            setIsRateLimited(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [rateLimitCountdown]);

  const handleFirebaseError = useCallback((error: any) => {
    const errorCode = error.code || error.message;

    if (errorCode.includes("too-many-requests")) {
      setIsRateLimited(true);
      setRateLimitCountdown(300);
      setError(
        "Too many failed attempts. Please wait 5 minutes before trying again, or try from a different device/network."
      );
    } else if (errorCode.includes("wrong-password")) {
      setError("Wrong password. Please try again.");
    } else if (errorCode.includes("user-not-found")) {
      setError("Wrong email. User not found.");
    } else if (errorCode.includes("invalid-credential")) {
      setError("Invalid email or password. Please try again.");
    } else if (errorCode.includes("invalid-email")) {
      setError("Please enter a valid email address.");
    } else {
      setError("Failed to sign in. Please check your credentials.");
    }
  }, []);

  // Keep firebaseError wired into our generic error alert
  useEffect(() => {
    if (firebaseError) {
      handleFirebaseError({ message: firebaseError, code: firebaseError });
    }
  }, [firebaseError, handleFirebaseError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      console.log("[Login] Attempting login with:", email);
      await signIn(email, password);
      console.log("[Login] Login successful, redirecting...");
      router.replace("/");
    } catch (error: any) {
      console.error("[Login] Login error:", error);
      handleFirebaseError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Global login page styles */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        .login-page-root {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          position: fixed;
          inset: 0;
          overflow: hidden;
        }

        /* ───── Background layer ───── */
        .login-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
        }

        .login-bg img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: blur(3px) brightness(0.92) saturate(0.95);
        }

        /* Light sky-blue tint — warehouse stays clearly visible */
        .login-bg-overlay {
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

        /* Subtle ambient glow spots */
        .login-bg-particles {
          position: absolute;
          inset: 0;
          z-index: 2;
          background:
            radial-gradient(ellipse at 20% 40%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 75% 25%, rgba(6, 182, 212, 0.06) 0%, transparent 40%),
            radial-gradient(ellipse at 55% 75%, rgba(99, 102, 241, 0.04) 0%, transparent 45%);
          pointer-events: none;
        }

        /* ───── Card wrapper ───── */
        .login-card-wrapper {
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

        /* ───── Login card — solid frosted glass ───── */
        .login-card {
          display: flex;
          max-width: 860px;
          width: 100%;
          min-height: 470px;
          border-radius: 24px;
          overflow: visible;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(4px) saturate(1.05);
          -webkit-backdrop-filter: blur(4px) saturate(1.05);
          border: 1px solid rgba(255, 255, 255, 0.95);
          box-shadow:
            0 8px 24px rgba(0, 0, 0, 0.04),
            0 2px 8px rgba(0, 0, 0, 0.02);

          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .login-card.mounted {
          opacity: 1;
          transform: translateY(0);
        }

        /* Subtle ambient glow behind card */
        .login-card-glow {
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

        /* ───── Left panel — Logo + Brand ───── */
        .login-left {
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
          .login-left {
            display: flex;
          }
        }

        .login-logo-container {
          position: relative;
          margin-bottom: 1.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .login-brand-name {
          font-size: 1.4rem;
          font-weight: 700;
          color: #0f2b4a;
          letter-spacing: -0.01em;
          text-align: center;
        }

        .login-brand-name .brand-accent {
          color: #1a8cc7;
        }

        /* ───── Right panel — Form ───── */
        .login-right {
          flex: 1;
          padding: 3rem 2.75rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          position: relative;
          border-radius: 0 24px 24px 0;
          overflow: hidden;
        }

        @media (max-width: 767px) {
          .login-right {
            padding: 2.5rem 1.75rem;
          }
        }

        .login-form-title {
          font-size: 1.6rem;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 0.4rem;
          letter-spacing: -0.02em;
        }

        .login-form-subtitle {
          font-size: 0.88rem;
          color: #64748b;
          margin-bottom: 2rem;
          font-weight: 400;
        }

        /* ───── Input fields ───── */
        .login-input-group {
          position: relative;
          margin-bottom: 1.25rem;
        }

        .login-input-icon {
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

        .login-input {
          width: 100%;
          padding: 14px 48px 14px 46px;
          font-size: 0.9rem;
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

        .login-input::placeholder {
          color: #94a3b8 !important;
          opacity: 1 !important;
          font-weight: 400;
        }

        .login-input:focus {
          background: #ffffff;
          border-color: rgba(59, 130, 246, 0.5);
          box-shadow:
            0 0 0 3px rgba(59, 130, 246, 0.10),
            0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .login-input:focus ~ .login-input-icon {
          color: #3b82f6;
        }

        .login-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .login-eye-btn {
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

        .login-eye-btn:hover {
          color: #64748b;
        }

        /* ───── Submit button ───── */
        .login-submit-btn {
          width: 100%;
          padding: 14px 24px;
          margin-top: 0.75rem;
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
          box-shadow:
            0 4px 14px rgba(59, 157, 232, 0.35),
            0 2px 4px rgba(0, 0, 0, 0.08);
        }

        .login-submit-btn:hover {
          transform: translateY(-1px);
          box-shadow:
            0 6px 20px rgba(86, 180, 240, 0.28),
            0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .login-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .login-submit-btn span {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* ───── Error alert ───── */
        .login-error {
          padding: 12px 16px;
          margin-bottom: 1.25rem;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.18);
          border-radius: 12px;
          color: #b91c1c;
          font-size: 0.8rem;
          line-height: 1.5;
          display: flex;
          gap: 10px;
          align-items: flex-start;
          animation: errorSlide 0.3s ease-out;
        }

        @keyframes errorSlide {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .login-error-icon {
          flex-shrink: 0;
          width: 16px;
          height: 16px;
          margin-top: 1px;
        }

        .login-error ul {
          margin-top: 6px;
          padding-left: 16px;
          list-style-type: disc;
        }

        /* Decorative corner accents */
        .login-corner-accent {
          position: absolute;
          width: 120px;
          height: 120px;
          border-radius: 50%;
          filter: blur(60px);
          pointer-events: none;
          opacity: 0.08;
        }

        .login-corner-accent.top-right {
          top: -40px;
          right: -40px;
          background: #87bef5;
        }

        .login-corner-accent.bottom-left {
          bottom: -40px;
          left: -40px;
          background: #7dd3e8;
        }

        /* Mobile branding */
        .login-mobile-brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          margin-bottom: 2rem;
        }

        @media (min-width: 768px) {
          .login-mobile-brand {
            display: none;
          }
        }
      `}</style>

      <div className="login-page-root">
        {/* Background */}
        <div className="login-bg">
          <Image
            src="/images/warehouse-bg.png"
            alt=""
            fill
            priority
            sizes="100vw"
            style={{ objectFit: 'cover' }}
          />
        </div>
        <div className="login-bg-overlay" />
        <div className="login-bg-particles" />
        <div className="login-card-glow" />

        {/* Card container */}
        <div className="login-card-wrapper">
          <div className={`login-card ${mounted ? 'mounted' : ''}`}>
            {/* Corner accents */}
            <div className="login-corner-accent top-right" />
            <div className="login-corner-accent bottom-left" />

            {/* Left Panel */}
            <div className="login-left">
              <div className="login-logo-container">
                <Image
                  src="/logo.png"
                  alt="DPE Logo"
                  width={160}
                  height={100}
                  style={{ objectFit: 'contain', width: '160px', height: 'auto' }}
                  priority
                />
              </div>
              <div className="login-brand-name">
                Deckta<span className="brand-accent">GO</span>
              </div>
            </div>

            {/* Right Panel */}
            <div className="login-right">
              {/* Mobile branding */}
              <div className="login-mobile-brand">
                <Image
                  src="/logo.png"
                  alt="DPE Logo"
                  width={100}
                  height={62}
                  style={{ objectFit: 'contain', width: '100px', height: 'auto' }}
                  priority
                />
                <div className="login-brand-name">
                  Deckta<span className="brand-accent">GO</span>
                </div>
              </div>

              <h2 className="login-form-title">Login</h2>
              <p className="login-form-subtitle">Sign in to your account</p>

              <form onSubmit={handleSubmit} autoComplete="off">
                {error && (
                  <div className="login-error">
                    {error.includes("wait") || error.includes("too-many-requests") ? (
                      <Clock className="login-error-icon" />
                    ) : (
                      <AlertTriangle className="login-error-icon" />
                    )}
                    <div>
                      {error}
                      {isRateLimited && rateLimitCountdown > 0 && (
                        <div style={{ marginTop: '6px', fontWeight: 600 }}>
                          Time remaining: {Math.floor(rateLimitCountdown / 60)}:
                          {(rateLimitCountdown % 60).toString().padStart(2, "0")}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Email */}
                <div className="login-input-group">
                  <Mail className="login-input-icon" />
                  <input
                    id="login-email"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading || isRateLimited}
                    className="login-input"
                  />
                </div>

                {/* Password */}
                <div className="login-input-group">
                  <Lock className="login-input-icon" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading || isRateLimited}
                    className="login-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="login-eye-btn"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  className="login-submit-btn"
                  disabled={loading || isRateLimited}
                >
                  <span>
                    {loading && <Loader2 size={18} className="animate-spin" />}
                    {isRateLimited && <Clock size={18} />}
                    {isRateLimited
                      ? `Wait ${Math.floor(rateLimitCountdown / 60)}:${(rateLimitCountdown % 60).toString().padStart(2, "0")}`
                      : "Login"}
                  </span>
                </button>
              </form>
            </div>
          </div>

          {/* Optional Footer Link */}
          <div className={`transition-all duration-1000 delay-300 ${mounted ? 'opacity-60 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <p className="text-[11px] font-medium text-slate-500 tracking-wide">
              Need help? Contact <a href="mailto:support@decktago.com" className="text-blue-500 hover:underline">System Administrator</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
