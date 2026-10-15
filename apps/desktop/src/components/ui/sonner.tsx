'use client'

import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from 'lucide-react'
import React from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

import { useTheme } from '@/store/hooks'

const Toaster = React.memo(function Toaster({ ...props }: ToasterProps) {
  const { resolvedTheme } = useTheme()

  const icons = React.useMemo(
    () => ({
      success: <CircleCheckIcon className="size-4" />,
      info: <InfoIcon className="size-4" />,
      warning: <TriangleAlertIcon className="size-4" />,
      error: <OctagonXIcon className="size-4" />,
      loading: <Loader2Icon className="size-4 animate-spin" />,
    }),
    [],
  )

  const style = React.useMemo(
    () =>
      ({
        '--normal-bg': 'var(--popover)',
        '--normal-text': 'var(--popover-foreground)',
        '--normal-border': 'var(--border)',
        '--border-radius': 'var(--radius)',
      }) as React.CSSProperties,
    [],
  )

  const toastOptions = React.useMemo(
    () => ({
      classNames: {
        toast: 'cn-toast',
      },
    }),
    [],
  )

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      icons={icons}
      style={style}
      toastOptions={toastOptions}
      {...props}
    />
  )
})

export { Toaster }
