import { Check } from 'lucide-react'
import React, { useState, useCallback } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/**
 * Preset color palette for collection colors.
 * 12 curated colors that work well in both light and dark themes.
 */
const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
] as const

/**
 * Props for the ColorPicker component.
 */
interface ColorPickerProps {
  /** Currently selected color hex value */
  value?: string
  /** Callback when a color is selected */
  onChange: (color: string) => void
  /** Optional label text */
  label?: string
}

/**
 * Color picker with preset palette and custom hex input.
 * Shows a grid of 12 preset colors plus a text input for arbitrary hex values.
 *
 * @param value - Current color hex string
 * @param onChange - Callback fired when color changes
 * @param label - Optional label displayed above the picker
 *
 * @example
 *   <ColorPicker
 *     value="#8b5cf6"
 *     onChange={(color) => setColor(color)}
 *     label="Collection color"
 *   />
 */
const ColorPicker = React.memo(function ColorPicker({
  value,
  onChange,
  label,
}: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const [customColor, setCustomColor] = useState(value || '')

  const handleCustomColorChange = useCallback(
    (hex: string) => {
      setCustomColor(hex)
      if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
        onChange(hex)
      }
    },
    [onChange],
  )

  const handleCustomColorInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleCustomColorChange(e.target.value)
    },
    [handleCustomColorChange],
  )

  return (
    <div className="space-y-2">
      {label && <Label className="text-sm font-medium">{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 font-normal"
          >
            <div
              className="border-border h-4 w-4 flex-shrink-0 rounded-sm border"
              style={{ backgroundColor: value || '#8b5cf6' }}
            />
            <span className="text-sm">{value || 'Select color...'}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[232px] p-3" align="start">
          <div className="space-y-3">
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={cn(
                    'focus-visible:ring-ring h-7 w-7 rounded-md border-2 transition-all hover:scale-110 focus-visible:ring-2 focus-visible:outline-none',
                    value === color
                      ? 'border-foreground shadow-sm'
                      : 'border-transparent',
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    onChange(color)
                    setCustomColor(color)
                  }}
                  aria-label={`Select color ${color}`}
                >
                  {value === color && (
                    <Check className="mx-auto h-3.5 w-3.5 text-white drop-shadow-sm" />
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div
                className="border-border h-8 w-8 flex-shrink-0 rounded-md border"
                style={{
                  backgroundColor: /^#[0-9a-fA-F]{6}$/.test(customColor)
                    ? customColor
                    : '#cccccc',
                }}
              />
              <Input
                value={customColor}
                onChange={handleCustomColorInputChange}
                placeholder="#000000"
                className="h-8 font-mono text-xs"
                maxLength={7}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
})
export { ColorPicker }
export default ColorPicker
