/**
 * app/print-label/layout.tsx
 * ─────────────────────────────────────────────────────────────────────────
 * Minimal layout for the /print-label page.
 *
 * This ensures the print-label page gets a clean, bare HTML shell
 * without any theme providers, sidebars, or other app-level wrappers
 * that could interfere with thermal printer output.
 */

export const metadata = {
  title: "Print Label",
  description: "Compact 48mm thermal printing interface",
}

export default function PrintLabelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
