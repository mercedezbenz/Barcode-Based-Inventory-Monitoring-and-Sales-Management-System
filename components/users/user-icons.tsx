"use client"

import type React from "react"

interface UserIconProps {
    className?: string
}

/**
 * Total Users Icon - Blue gradient with users group symbol
 */
export function TotalUsersIcon({ className }: UserIconProps) {
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

            {/* Users Icon */}
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="relative z-10 transition-transform duration-300 group-hover:scale-110"
            >
                <path
                    d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <circle
                    cx="9"
                    cy="7"
                    r="4"
                    stroke="white"
                    strokeWidth="2.5"
                />
                <path
                    d="M23 21V19C23 18.0149 22.6534 17.0884 22.0352 16.3751C21.4169 15.6617 20.5723 15.2093 19.6514 15.1016"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M16 3.12988C16.9237 3.23731 17.7713 3.69012 18.3913 4.40482C19.0113 5.11951 19.3588 6.04767 19.3588 7.03488C19.3588 8.02209 19.0113 8.95025 18.3913 9.66495C17.7713 10.3796 16.9237 10.8325 16 10.9399"
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
 * Admins Icon - Red gradient with shield symbol
 */
export function AdminsIcon({ className }: UserIconProps) {
    return (
        <div
            className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 hover:scale-110 ${className}`}
            style={{
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                boxShadow: "0 6px 20px rgba(239, 68, 68, 0.45)",
            }}
        >
            {/* Glow effect on hover */}
            <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: "linear-gradient(135deg, #f87171 0%, #ef4444 100%)",
                    boxShadow: "0 0 32px rgba(239, 68, 68, 0.7)",
                }}
            />

            {/* Pulse ring for admin importance */}
            <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 group-hover:animate-ping"
                style={{
                    background: "rgba(239, 68, 68, 0.3)",
                    animationDuration: "1.5s",
                }}
            />

            {/* Shield Icon */}
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="relative z-10 transition-transform duration-300 group-hover:scale-110"
            >
                <path
                    d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z"
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
 * Staff Members Icon - Purple gradient with user check symbol
 */
export function StaffMembersIcon({ className }: UserIconProps) {
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

            {/* User Check Icon */}
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="relative z-10 transition-transform duration-300 group-hover:scale-110"
            >
                <path
                    d="M16 21V19C16 17.9391 15.5786 16.9217 14.8284 16.1716C14.0783 15.4214 13.0609 15 12 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <circle
                    cx="8.5"
                    cy="7"
                    r="4"
                    stroke="white"
                    strokeWidth="2.5"
                />
                <path
                    d="M17 11L19 13L23 9"
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
 * Delivery Staff Icon - Teal gradient with truck-user symbol
 */
export function DeliveryStaffIcon({ className }: UserIconProps) {
    return (
        <div
            className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 hover:scale-110 overflow-hidden ${className}`}
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

            {/* Motion trail effect */}
            <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-0.5 bg-white/30 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:-translate-x-2"
            />

            {/* Users Icon (for delivery staff) */}
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="relative z-10 transition-transform duration-300 group-hover:translate-x-0.5"
            >
                <path
                    d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <circle
                    cx="9"
                    cy="7"
                    r="4"
                    stroke="white"
                    strokeWidth="2.5"
                />
                <path
                    d="M23 21V19C23 18.0149 22.6534 17.0884 22.0352 16.3751C21.4169 15.6617 20.5723 15.2093 19.6514 15.1016"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M16 3.12988C16.9237 3.23731 17.7713 3.69012 18.3913 4.40482C19.0113 5.11951 19.3588 6.04767 19.3588 7.03488C19.3588 8.02209 19.0113 8.95025 18.3913 9.66495C17.7713 10.3796 16.9237 10.8325 16 10.9399"
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
 * Export all user icons as a collection
 */
export const UserIcons = {
    TotalUsers: TotalUsersIcon,
    Admins: AdminsIcon,
    StaffMembers: StaffMembersIcon,
    DeliveryStaff: DeliveryStaffIcon,
}
