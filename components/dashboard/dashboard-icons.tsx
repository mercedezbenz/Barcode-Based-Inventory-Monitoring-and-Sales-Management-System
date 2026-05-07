"use client"

import type React from "react"

interface DashboardIconProps {
    className?: string
}

/**
 * Total Stocks Icon - Blue palette with shopping cart/package symbol
 * Features soft gradient, rounded edges, and hover glow animation
 */
export function TotalStocksIcon({ className }: DashboardIconProps) {
    return (
        <div
            className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 hover:scale-110 ${className}`}
            style={{
                background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
            }}
        >
            {/* Glow effect on hover */}
            <div
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)",
                    boxShadow: "0 0 20px rgba(59, 130, 246, 0.6)",
                }}
            />

            {/* Icon SVG - Package/Box symbol */}
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="relative z-10 transition-transform duration-300 group-hover:rotate-[-8deg]"
            >
                <path
                    d="M20 7L12 3L4 7M20 7L12 11M20 7V17L12 21M12 11L4 7M12 11V21M4 7V17L12 21"
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
 * Low Stock Icon - Orange/Red palette with alert/warning symbol
 * Features soft gradient, rounded edges, and pulse animation on hover
 */
export function LowStockIcon({ className }: DashboardIconProps) {
    return (
        <div
            className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 hover:scale-110 ${className}`}
            style={{
                background: "linear-gradient(135deg, #f97316 0%, #dc2626 100%)",
                boxShadow: "0 4px 12px rgba(249, 115, 22, 0.3)",
            }}
        >
            {/* Glow effect on hover */}
            <div
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: "linear-gradient(135deg, #fb923c 0%, #f97316 100%)",
                    boxShadow: "0 0 20px rgba(249, 115, 22, 0.6)",
                }}
            />

            {/* Pulse ring animation */}
            <div
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 group-hover:animate-ping"
                style={{
                    background: "rgba(249, 115, 22, 0.3)",
                    animationDuration: "1.5s",
                }}
            />

            {/* Icon SVG - Alert triangle */}
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="relative z-10 transition-transform duration-300 group-hover:scale-110"
            >
                <path
                    d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18C1.64 18.3 1.55 18.64 1.55 19C1.55 19.36 1.64 19.7 1.82 20C2 20.3 2.26 20.56 2.56 20.74C2.87 20.92 3.22 21.01 3.58 21H20.42C20.78 21.01 21.13 20.92 21.44 20.74C21.74 20.56 22 20.3 22.18 20C22.36 19.7 22.45 19.36 22.45 19C22.45 18.64 22.36 18.3 22.18 18L13.71 3.86C13.53 3.56 13.27 3.32 12.96 3.15C12.66 2.98 12.31 2.89 11.96 2.89C11.61 2.89 11.26 2.98 10.96 3.15C10.65 3.32 10.39 3.56 10.21 3.86H10.29Z"
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
 * Expiring Soon Icon - Amber/Yellow palette with clock/calendar symbol
 * Features soft gradient, rounded edges, and tick animation on hover
 */
export function ExpiringSoonIcon({ className }: DashboardIconProps) {
    return (
        <div
            className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 hover:scale-110 overflow-hidden ${className}`}
            style={{
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)",
            }}
        >
            {/* Glow effect on hover */}
            <div
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
                    boxShadow: "0 0 20px rgba(245, 158, 11, 0.6)",
                }}
            />

            {/* Icon SVG - Clock/Timer symbol */}
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
 * Delivery Today Icon - Teal palette with delivery truck symbol
 * Features soft gradient, rounded edges, and slide animation on hover
 */
export function DeliveryTodayIcon({ className }: DashboardIconProps) {
    return (
        <div
            className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 hover:scale-110 overflow-hidden ${className}`}
            style={{
                background: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
                boxShadow: "0 4px 12px rgba(20, 184, 166, 0.3)",
            }}
        >
            {/* Glow effect on hover */}
            <div
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: "linear-gradient(135deg, #2dd4bf 0%, #14b8a6 100%)",
                    boxShadow: "0 0 20px rgba(20, 184, 166, 0.6)",
                }}
            />

            {/* Motion trail effect */}
            <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-0.5 bg-white/30 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:-translate-x-2"
            />
            <div
                className="absolute left-1 top-1/2 mt-1 -translate-y-1/2 w-2 h-0.5 bg-white/20 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 delay-75 group-hover:-translate-x-2"
            />

            {/* Icon SVG - Delivery truck */}
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="relative z-10 transition-transform duration-300 group-hover:translate-x-0.5"
            >
                <path
                    d="M16 3H1V16H16V3Z"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M16 8H20L23 11V16H16V8Z"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M5.5 21C6.88071 21 8 19.8807 8 18.5C8 17.1193 6.88071 16 5.5 16C4.11929 16 3 17.1193 3 18.5C3 19.8807 4.11929 21 5.5 21Z"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M18.5 21C19.8807 21 21 19.8807 21 18.5C21 17.1193 19.8807 16 18.5 16C17.1193 16 16 17.1193 16 18.5C16 19.8807 17.1193 21 18.5 21Z"
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
 * Export all icons as a collection
 */
export const DashboardIcons = {
    TotalStocks: TotalStocksIcon,
    LowStock: LowStockIcon,
    ExpiringSoon: ExpiringSoonIcon,
    DeliveryToday: DeliveryTodayIcon,
}
