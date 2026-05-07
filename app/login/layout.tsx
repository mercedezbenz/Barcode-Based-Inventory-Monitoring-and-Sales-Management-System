"use client"

import { AuthProvider } from "@/hooks/use-auth"

// Minimal layout for login page - only provides AuthProvider
// No ThemeProvider, no SidebarProvider, no other wrappers
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthProvider>{children}</AuthProvider>
}

