"use client"

import { Loader2 } from "lucide-react"

export function LoggingOutOverlay() {
  return (
    <>
      <style jsx global>{`
        .logout-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          animation: logoutFadeIn 0.25s ease-out forwards;
        }

        .dark .logout-overlay {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        }

        @keyframes logoutFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .logout-spinner-ring {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 3px solid rgba(148, 163, 184, 0.2);
          border-top-color: #3b82f6;
          animation: logoutSpin 0.8s linear infinite;
          margin-bottom: 1.5rem;
        }

        @keyframes logoutSpin {
          to {
            transform: rotate(360deg);
          }
        }

        .logout-text {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 1.1rem;
          font-weight: 500;
          color: #475569;
          letter-spacing: -0.01em;
          animation: logoutPulse 2s ease-in-out infinite;
        }

        .dark .logout-text {
          color: #94a3b8;
        }

        @keyframes logoutPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>

      <div className="logout-overlay">
        <div className="logout-spinner-ring" />
        <p className="logout-text">Logging out...</p>
      </div>
    </>
  )
}
