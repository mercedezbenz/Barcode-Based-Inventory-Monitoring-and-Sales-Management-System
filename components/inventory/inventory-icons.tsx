"use client"

import type React from "react"

interface InventoryIconProps {
    className?: string
}

/**
 * Total Items Icon - Blue palette with package/box symbol
 * Modern gradient with hover glow effect
 */
export function TotalItemsIcon({ className }: InventoryIconProps) {
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

            {/* Package/Cube Icon */}
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="relative z-10 transition-transform duration-300 group-hover:rotate-[-6deg]"
            >
                <path
                    d="M21 16V8C21 7.46957 20.7893 6.96086 20.4142 6.58579C20.0391 6.21071 19.5304 6 19 6H5C4.46957 6 3.96086 6.21071 3.58579 6.58579C3.21071 6.96086 3 7.46957 3 8V16C3 16.5304 3.21071 17.0391 3.58579 17.4142C3.96086 17.7893 4.46957 18 5 18H19C19.5304 18 20.0391 17.7893 20.4142 17.4142C20.7893 17.0391 21 16.5304 21 16Z"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M3 8L12 13L21 8"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M12 2V13"
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
 * Total Stock Icon - Green palette with trending up symbol
 * Shows stock increase with dynamic effect
 */
export function TotalStockIcon({ className }: InventoryIconProps) {
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

            {/* Trending Up / Chart Icon */}
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="relative z-10 transition-transform duration-300 group-hover:translate-y-[-2px]"
            >
                <path
                    d="M23 6L13.5 15.5L8.5 10.5L1 18"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M17 6H23V12"
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
 * Low Stock Alert Icon - Orange/Red gradient with warning symbol
 * Includes subtle pulse animation on hover
 */
export function LowStockAlertIcon({ className }: InventoryIconProps) {
    return (
        <div
            className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 hover:scale-110 ${className}`}
            style={{
                background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                boxShadow: "0 6px 20px rgba(249, 115, 22, 0.45)",
            }}
        >
            {/* Glow effect on hover */}
            <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: "linear-gradient(135deg, #fb923c 0%, #f97316 100%)",
                    boxShadow: "0 0 32px rgba(249, 115, 22, 0.7)",
                }}
            />

            {/* Pulse ring */}
            <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 group-hover:animate-ping"
                style={{
                    background: "rgba(249, 115, 22, 0.3)",
                    animationDuration: "1.5s",
                }}
            />

            {/* Alert Triangle Icon */}
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="relative z-10 transition-transform duration-300 group-hover:scale-110"
            >
                <path
                    d="M10.29 3.86L1.82 18A2 2 0 003.64 21H20.36A2 2 0 0022.18 18L13.71 3.86A2 2 0 0010.29 3.86Z"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M12 9V13"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <circle cx="12" cy="17" r="1.5" fill="white" />
            </svg>
        </div>
    )
}

/**
 * Expiry Alert Icon - Purple/Magenta gradient with clock/calendar symbol
 * Shows expiration warning
 */
export function ExpiryAlertIcon({ className }: InventoryIconProps) {
    return (
        <div
            className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 hover:scale-110 ${className}`}
            style={{
                background: "linear-gradient(135deg, #a855f7 0%, #9333ea 100%)",
                boxShadow: "0 6px 20px rgba(168, 85, 247, 0.45)",
            }}
        >
            {/* Glow effect on hover */}
            <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: "linear-gradient(135deg, #c084fc 0%, #a855f7 100%)",
                    boxShadow: "0 0 32px rgba(168, 85, 247, 0.7)",
                }}
            />

            {/* Clock/Timer Icon */}
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="relative z-10 transition-transform duration-300 group-hover:rotate-[15deg]"
            >
                <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="white"
                    strokeWidth="2.5"
                />
                <path
                    d="M12 6V12L16 14"
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
 * Returns Summary Icon - Teal gradient with return/rotate arrow
 * Shows return activity
 */
export function ReturnsSummaryIcon({ className }: InventoryIconProps) {
    return (
        <div
            className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 hover:scale-110 ${className}`}
            style={{
                background: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
                boxShadow: "0 6px 20px rgba(20, 184, 166, 0.45)",
            }}
        >
            {/* Glow effect on hover */}
            <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: "linear-gradient(135deg, #2dd4bf 0%, #14b8a6 100%)",
                    boxShadow: "0 0 32px rgba(20, 184, 166, 0.7)",
                }}
            />

            {/* Return Arrow Icon */}
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="relative z-10 transition-transform duration-300 group-hover:rotate-[-20deg]"
            >
                <path
                    d="M1 4V10H7"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M3.51 15C4.15839 16.8404 5.38734 18.4202 7.01166 19.5014C8.63598 20.5826 10.5677 21.1066 12.5157 20.9945C14.4637 20.8824 16.3226 20.1402 17.8121 18.8798C19.3017 17.6193 20.3413 15.909 20.7742 14.0064C21.2072 12.1037 21.0101 10.1139 20.2126 8.33122C19.4152 6.54852 18.0605 5.06985 16.3528 4.12051C14.6451 3.17118 12.6769 2.80246 10.7377 3.06973C8.79849 3.33701 7.0003 4.22562 5.64 5.59L1 10"
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
 * Quality Good Icon - Green checkmark badge
 */
export function QualityGoodIcon({ className }: InventoryIconProps) {
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 ${className}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                <path
                    d="M20 6L9 17L4 12"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
            GOOD
        </span>
    )
}

/**
 * Quality Damaged Icon - Red X badge
 */
export function QualityDamagedIcon({ className }: InventoryIconProps) {
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 ${className}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
            DAMAGED
        </span>
    )
}

/**
 * Today's Movement Icon - Indigo gradient with arrows up/down
 */
export function TodaysMovementIcon({ className }: InventoryIconProps) {
    return (
        <div
            className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 hover:scale-110 ${className}`}
            style={{
                background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                boxShadow: "0 6px 20px rgba(99, 102, 241, 0.45)",
            }}
        >
            <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: "linear-gradient(135deg, #818cf8 0%, #6366f1 100%)",
                    boxShadow: "0 0 32px rgba(99, 102, 241, 0.7)",
                }}
            />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                className="relative z-10 transition-transform duration-300 group-hover:scale-110">
                <path d="M12 3V21" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M5 10L12 3L19 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 17H19" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
            </svg>
        </div>
    )
}

/**
 * Stock Overview Icon - Blue gradient with bar-chart symbol
 */
export function StockOverviewIcon({ className }: InventoryIconProps) {
    return (
        <div
            className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 hover:scale-110 ${className}`}
            style={{
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                boxShadow: "0 6px 20px rgba(59, 130, 246, 0.45)",
            }}
        >
            <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)",
                    boxShadow: "0 0 32px rgba(59, 130, 246, 0.7)",
                }}
            />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                className="relative z-10 transition-transform duration-300 group-hover:translate-y-[-2px]">
                <rect x="3" y="12" width="4" height="8" rx="1" fill="white" opacity="0.5" />
                <rect x="10" y="6" width="4" height="14" rx="1" fill="white" opacity="0.75" />
                <rect x="17" y="2" width="4" height="18" rx="1" fill="white" />
            </svg>
        </div>
    )
}

/**
 * Fast Moving Products Icon - Rose/Red gradient with flame
 */
export function FastMovingIcon({ className }: InventoryIconProps) {
    return (
        <div
            className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 hover:scale-110 ${className}`}
            style={{
                background: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)",
                boxShadow: "0 6px 20px rgba(244, 63, 94, 0.45)",
            }}
        >
            <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: "linear-gradient(135deg, #fb7185 0%, #f43f5e 100%)",
                    boxShadow: "0 0 32px rgba(244, 63, 94, 0.7)",
                }}
            />
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                className="relative z-10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg]">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="white" strokeWidth="2" opacity="0.3" />
                <path d="M12 2C12 2 8 6 8 10C8 12.2091 9.79086 14 12 14C14.2091 14 16 12.2091 16 10C16 6 12 2 12 2Z" fill="white" opacity="0.9" />
                <path d="M12 10C12 10 10.5 12 10.5 13.5C10.5 14.3284 11.1716 15 12 15C12.8284 15 13.5 14.3284 13.5 13.5C13.5 12 12 10 12 10Z" fill="white" opacity="0.5" />
            </svg>
        </div>
    )
}

/**
 * Out of Stock Icon - Red gradient with empty box / X symbol
 * Indicates zero remaining inventory
 */
export function OutOfStockIcon({ className }: InventoryIconProps) {
    return (
        <div
            className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 hover:scale-110 ${className}`}
            style={{
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                boxShadow: "0 6px 20px rgba(239, 68, 68, 0.45)",
            }}
        >
            <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: "linear-gradient(135deg, #f87171 0%, #ef4444 100%)",
                    boxShadow: "0 0 32px rgba(239, 68, 68, 0.7)",
                }}
            />
            {/* Pulse ring */}
            <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 group-hover:animate-ping"
                style={{
                    background: "rgba(239, 68, 68, 0.3)",
                    animationDuration: "1.5s",
                }}
            />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                className="relative z-10 transition-transform duration-300 group-hover:scale-110">
                <path d="M21 16V8C21 7.46957 20.7893 6.96086 20.4142 6.58579C20.0391 6.21071 19.5304 6 19 6H5C4.46957 6 3.96086 6.21071 3.58579 6.58579C3.21071 6.96086 3 7.46957 3 8V16C3 16.5304 3.21071 17.0391 3.58579 17.4142C3.96086 17.7893 4.46957 18 5 18H19C19.5304 18 20.0391 17.7893 20.4142 17.4142C20.7893 17.0391 21 16.5304 21 16Z"
                    stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
                <path d="M8.5 8.5L15.5 15.5M15.5 8.5L8.5 15.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
        </div>
    )
}

/**
 * Export all icons as a collection
 */
export const InventoryIcons = {
    TotalItems: TotalItemsIcon,
    TotalStock: TotalStockIcon,
    LowStockAlert: LowStockAlertIcon,
    ExpiryAlert: ExpiryAlertIcon,
    ReturnsSummary: ReturnsSummaryIcon,
    TodaysMovement: TodaysMovementIcon,
    StockOverview: StockOverviewIcon,
    FastMoving: FastMovingIcon,
    OutOfStock: OutOfStockIcon,
    QualityGood: QualityGoodIcon,
    QualityDamaged: QualityDamagedIcon,
}
