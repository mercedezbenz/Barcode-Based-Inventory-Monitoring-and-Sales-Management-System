"use client"

import type React from "react"

interface DeliveryIconProps {
    className?: string
}

/**
 * Total Deliveries Icon - Package with blue gradient
 */
export function TotalDeliveriesIcon({ className }: DeliveryIconProps) {
    return (
        <div
            className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 hover:scale-110 ${className}`}
            style={{
                background: "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
                boxShadow: "0 6px 20px rgba(59, 130, 246, 0.45)",
            }}
        >
            {/* Glow effect on hover */}
            <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)",
                    boxShadow: "0 0 32px rgba(59, 130, 246, 0.7)",
                }}
            />

            {/* Package Icon */}
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="relative z-10 transition-transform duration-300 group-hover:rotate-[-6deg]"
            >
                <path
                    d="M20 7L12 3L4 7M20 7L12 11M20 7V17L12 21M12 11L4 7M12 11V21M4 7V17L12 21"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    )
}

/**
 * Pending Deliveries Icon - Alert circle with yellow/orange gradient
 */
export function PendingDeliveriesIcon({ className }: DeliveryIconProps) {
    return (
        <div
            className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 hover:scale-110 ${className}`}
            style={{
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                boxShadow: "0 6px 20px rgba(245, 158, 11, 0.45)",
            }}
        >
            {/* Glow effect on hover */}
            <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
                    boxShadow: "0 0 32px rgba(245, 158, 11, 0.7)",
                }}
            />

            {/* Pulse ring */}
            <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 group-hover:animate-ping"
                style={{
                    background: "rgba(245, 158, 11, 0.3)",
                    animationDuration: "1.5s",
                }}
            />

            {/* Alert Circle Icon */}
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="relative z-10 transition-transform duration-300 group-hover:scale-110"
            >
                <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="white"
                    strokeWidth="2.5"
                />
                <path
                    d="M12 8V12"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />
                <circle cx="12" cy="16" r="1.5" fill="white" />
            </svg>
        </div>
    )
}

/**
 * On Delivery Icon - Truck with blue gradient
 */
export function OnDeliveryIcon({ className }: DeliveryIconProps) {
    return (
        <div
            className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 hover:scale-110 overflow-hidden ${className}`}
            style={{
                background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
                boxShadow: "0 6px 20px rgba(14, 165, 233, 0.45)",
            }}
        >
            {/* Glow effect on hover */}
            <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)",
                    boxShadow: "0 0 32px rgba(14, 165, 233, 0.7)",
                }}
            />

            {/* Motion trail effect */}
            <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-0.5 bg-white/30 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:-translate-x-2"
            />
            <div
                className="absolute left-1 top-1/2 mt-1 -translate-y-1/2 w-2 h-0.5 bg-white/20 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 delay-75 group-hover:-translate-x-2"
            />

            {/* Truck Icon */}
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="relative z-10 transition-transform duration-300 group-hover:translate-x-0.5"
            >
                <path
                    d="M16 3H1V16H16V3Z"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M16 8H20L23 11V16H16V8Z"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <circle
                    cx="5.5"
                    cy="18.5"
                    r="2.5"
                    stroke="white"
                    strokeWidth="2.5"
                />
                <circle
                    cx="18.5"
                    cy="18.5"
                    r="2.5"
                    stroke="white"
                    strokeWidth="2.5"
                />
            </svg>
        </div>
    )
}

/**
 * Completed Deliveries Icon - Check circle with green gradient
 */
export function CompletedDeliveriesIcon({ className }: DeliveryIconProps) {
    return (
        <div
            className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 hover:scale-110 ${className}`}
            style={{
                background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                boxShadow: "0 6px 20px rgba(34, 197, 94, 0.45)",
            }}
        >
            {/* Glow effect on hover */}
            <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: "linear-gradient(135deg, #4ade80 0%, #22c55e 100%)",
                    boxShadow: "0 0 32px rgba(34, 197, 94, 0.7)",
                }}
            />

            {/* Success animation ring */}
            <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100"
                style={{
                    background: "rgba(34, 197, 94, 0.2)",
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                }}
            />

            {/* Check Circle Icon */}
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="relative z-10 transition-transform duration-300 group-hover:scale-110"
            >
                <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="white"
                    strokeWidth="2.5"
                />
                <path
                    d="M9 12L11 14L15 10"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    )
}

/**
 * Export all delivery icons as a collection
 */
export const DeliveryIcons = {
    TotalDeliveries: TotalDeliveriesIcon,
    Pending: PendingDeliveriesIcon,
    OnDelivery: OnDeliveryIcon,
    Completed: CompletedDeliveriesIcon,
}
