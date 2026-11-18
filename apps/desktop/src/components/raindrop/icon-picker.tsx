import { Folder } from 'lucide-react'
import React, { useState, useMemo, useCallback } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { collectionIcons } from '@/lib/collection-icons'
import { cn } from '@/lib/utils'

/**
 * Available icon entries for the picker grid.
 */
const ICON_ENTRIES = Object.entries(collectionIcons).map(([name, icon]) => ({
  name,
  icon,
}))

/**
 * Props for the IconPicker component.
 */
interface IconPickerProps {
  /** Currently selected icon name */
  value?: string
  /** Callback when an icon is selected */
  onChange: (iconName: string) => void
  /** Optional label text */
  label?: string
  /** Lock interaction while the owning form is saving. */
  disabled?: boolean
}

/**
 * Searchable grid icon picker using Lucide icons.
 * Displays a searchable popover with a grid of available icons.
 *
 * @param value - Currently selected icon name
 * @param onChange - Callback fired when an icon is selected
 * @param label - Optional label displayed above the picker
 *
 * @example
 *   <IconPicker
 *     value="Code2"
 *     onChange={(name) => setIcon(name)}
 *     label="Collection icon"
 *   />
 */
const IconPicker = React.memo(function IconPicker({
  value,
  onChange,
  label,
  disabled = false,
}: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredIcons = useMemo(() => {
    if (!searchQuery) return ICON_ENTRIES
    const lower = searchQuery.toLowerCase()
    return ICON_ENTRIES.filter((entry) =>
      entry.name.toLowerCase().includes(lower),
    )
  }, [searchQuery])

  const selectedIconEntry = useMemo(
    () => ICON_ENTRIES.find((e) => e.name === value),
    [value],
  )

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value),
    [],
  )

  return (
    <div className="space-y-2">
      {label && <Label className="text-sm font-medium">{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            aria-label={label || 'Collection icon'}
            disabled={disabled}
            variant="outline"
            className="w-full justify-start gap-2 font-normal"
          >
            {selectedIconEntry ? (
              <selectedIconEntry.icon className="h-4 w-4 flex-shrink-0" />
            ) : (
              <Folder className="h-4 w-4 flex-shrink-0" />
            )}
            <span className="text-sm">{value || 'Select icon...'}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-3" align="start">
          <div className="space-y-3">
            <Input
              aria-label="Search icons"
              placeholder="Search icons..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="h-8"
            />
            <ScrollArea className="h-[200px]">
              <div className="grid grid-cols-7 gap-1">
                {filteredIcons.map((entry) => {
                  const Icon = entry.icon
                  const isSelected = value === entry.name
                  return (
                    <button
                      key={entry.name}
                      type="button"
                      className={cn(
                        'hover:bg-accent flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                        isSelected &&
                          'bg-primary text-primary-foreground hover:bg-primary/90',
                      )}
                      onClick={() => {
                        onChange(entry.name)
                        setOpen(false)
                        setSearchQuery('')
                      }}
                      aria-label={`Select icon ${entry.name}`}
                      aria-pressed={isSelected}
                      title={entry.name}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  )
                })}
              </div>
              {filteredIcons.length === 0 && (
                <div className="text-muted-foreground py-6 text-center text-sm">
                  No icons found
                </div>
              )}
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
})
export { IconPicker }
