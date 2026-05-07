import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, Roboto_Mono } from "next/font/google"
import { ConditionalLayout } from "@/components/layout/conditional-layout"
import { ConditionalHtmlClass } from "@/components/layout/conditional-html-class"
import "./globals.css"

// Fonts
const geistSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
})

const geistMono = Roboto_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})
// ✅ GLOBAL METADATA (fix tab title + favicon)
export const metadata: Metadata = {
  title: "DecktaGo",
  description: "DecktaGo Inventory System",
  icons: {
    icon: [{ url: "/logo.png" }],
    apple: [{ url: "/logo.png" }],
  },
}

// ✅ VIEWPORT
export const viewport: Viewport = {
  themeColor: "#2563eb",
}

// ✅ Anti-flicker theme script
const themeInitScript = `
(function() {
  try {
    var theme = localStorage.getItem('theme');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  } catch (e) {}
})();
`

// ✅ ROOT LAYOUT (ONLY ONE!)
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>

      <body className="font-sans antialiased">
        <ConditionalHtmlClass />
        <ConditionalLayout>{children}</ConditionalLayout>
      </body>
    </html>
  )
}