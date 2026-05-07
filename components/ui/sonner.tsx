'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      position="top-right"
      duration={3500}
      richColors
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--success-bg': '#f0fdf4',
          '--success-border': '#bbf7d0',
          '--success-text': '#15803d',
          '--error-bg': '#fef2f2',
          '--error-border': '#fecaca',
          '--error-text': '#b91c1c',
        } as React.CSSProperties
      }
      toastOptions={{
        style: {
          borderRadius: '12px',
          boxShadow: '0 4px 24px 0 rgba(0,0,0,0.10)',
          fontFamily: 'inherit',
          fontSize: '14px',
          padding: '14px 16px',
        },
        classNames: {
          toast: 'group toast',
          title: 'font-semibold',
          description: 'text-sm opacity-90',
          success: 'border-green-200 bg-green-50 text-green-800',
          error: 'border-red-200 bg-red-50 text-red-800',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
