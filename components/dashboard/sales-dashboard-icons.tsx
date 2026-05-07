"use client"

import type React from "react"

interface SalesIconProps {
  className?: string
}

/**
 * Total Orders Icon — Sky-blue palette with receipt/clipboard symbol
 * Matches the existing dashboard icon style: gradient bg, rounded-xl, hover glow + scale
 */
export function TotalOrdersIcon({ className }: SalesIconProps) {
  return (
    <div
      className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 hover:scale-110 ${className}`}
      style={{
        background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
      }}
    >
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)",
          boxShadow: "0 0 20px rgba(59, 130, 246, 0.6)",
        }}
      />
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 transition-transform duration-300 group-hover:rotate-[-8deg]"
      >
        <path
          d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5M9 12H15M9 16H13"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

/**
 * Pending Orders Icon — Amber/Yellow palette with hourglass symbol
 */
export function PendingOrdersIcon({ className }: SalesIconProps) {
  return (
    <div
      className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 hover:scale-110 overflow-hidden ${className}`}
      style={{
        background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)",
      }}
    >
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
          boxShadow: "0 0 20px rgba(245, 158, 11, 0.6)",
        }}
      />
      {/* Pulse ring animation */}
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 group-hover:animate-ping"
        style={{
          background: "rgba(245, 158, 11, 0.3)",
          animationDuration: "1.5s",
        }}
      />
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 transition-transform duration-300 group-hover:rotate-[12deg]"
      >
        <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2" />
        <path
          d="M12 7V12L15 15"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

/**
 * Completed Orders Icon — Emerald/Green palette with check-circle symbol
 */
export function CompletedOrdersIcon({ className }: SalesIconProps) {
  return (
    <div
      className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 hover:scale-110 ${className}`}
      style={{
        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
      }}
    >
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: "linear-gradient(135deg, #34d399 0%, #10b981 100%)",
          boxShadow: "0 0 20px rgba(16, 185, 129, 0.6)",
        }}
      />
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 transition-transform duration-300 group-hover:scale-110"
      >
        <path
          d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18457 2.99721 7.13633 4.39828 5.49707C5.79935 3.85782 7.69279 2.71538 9.79619 2.24015C11.8996 1.76491 14.1003 1.98234 16.07 2.86"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M22 4L12 14.01L9 11.01"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

/**
 * Revenue Icon — Purple palette with peso/currency symbol
 */
export function RevenueIcon({ className }: SalesIconProps) {
  return (
    <div
      className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 hover:scale-110 ${className}`}
      style={{
        background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
        boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
      }}
    >
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: "linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)",
          boxShadow: "0 0 20px rgba(139, 92, 246, 0.6)",
        }}
      />
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 transition-transform duration-300 group-hover:rotate-[-8deg]"
      >
        <path
          d="M12 1V23M17 5H9.5C8.57174 5 7.6815 5.36875 7.02513 6.02513C6.36875 6.6815 6 7.57174 6 8.5C6 9.42826 6.36875 10.3185 7.02513 10.9749C7.6815 11.6313 8.57174 12 9.5 12H14.5C15.4283 12 16.3185 12.3687 16.9749 13.0251C17.6313 13.6815 18 14.5717 18 15.5C18 16.4283 17.6313 17.3185 16.9749 17.9749C16.3185 18.6313 15.4283 19 14.5 19H6"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

export const SalesDashboardIcons = {
  TotalOrders: TotalOrdersIcon,
  PendingOrders: PendingOrdersIcon,
  CompletedOrders: CompletedOrdersIcon,
  Revenue: RevenueIcon,
}
