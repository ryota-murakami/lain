import {
  Folder,
  Globe,
  Code2,
  BookOpen,
  Music,
  Video,
  Image,
  FileText,
  Star,
  Heart,
  Home,
  Settings,
  Mail,
  Phone,
  Camera,
  Bookmark,
  Tag,
  Search,
  Layout,
  Palette,
  Brain,
  Wrench,
  Component,
  Sparkles,
  Plane,
  CookingPot,
  ShoppingCart,
  Gamepad2,
  GraduationCap,
  Briefcase,
  Building2,
  Newspaper,
  Podcast,
  Rss,
  Database,
  Server,
  Cloud,
  Shield,
  Lock,
  Key,
  Zap,
  Flame,
  Trophy,
  Target,
  Flag,
  Map,
  Compass,
  Lightbulb,
  Puzzle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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
import { cn } from '@/lib/utils'

/**
 * Available icon entries for the picker grid.
 */
const ICON_ENTRIES: { name: string; icon: LucideIcon }[] = [
  { name: 'Folder', icon: Folder },
  { name: 'Globe', icon: Globe },
  { name: 'Code2', icon: Code2 },
  { name: 'BookOpen', icon: BookOpen },
  { name: 'Music', icon: Music },
  { name: 'Video', icon: Video },
  { name: 'Image', icon: Image },
  { name: 'FileText', icon: FileText },
  { name: 'Star', icon: Star },
  { name: 'Heart', icon: Heart },
  { name: 'Home', icon: Home },
  { name: 'Settings', icon: Settings },
  { name: 'Mail', icon: Mail },
  { name: 'Phone', icon: Phone },
  { name: 'Camera', icon: Camera },
  { name: 'Bookmark', icon: Bookmark },
  { name: 'Tag', icon: Tag },
  { name: 'Search', icon: Search },
  { name: 'Layout', icon: Layout },
  { name: 'Palette', icon: Palette },
  { name: 'Brain', icon: Brain },
  { name: 'Wrench', icon: Wrench },
  { name: 'Component', icon: Component },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Plane', icon: Plane },
  { name: 'CookingPot', icon: CookingPot },
  { name: 'ShoppingCart', icon: ShoppingCart },
  { name: 'Gamepad2', icon: Gamepad2 },
  { name: 'GraduationCap', icon: GraduationCap },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'Building2', icon: Building2 },
  { name: 'Newspaper', icon: Newspaper },
  { name: 'Podcast', icon: Podcast },
  { name: 'Rss', icon: Rss },
  { name: 'Database', icon: Database },
  { name: 'Server', icon: Server },
  { name: 'Cloud', icon: Cloud },
  { name: 'Shield', icon: Shield },
  { name: 'Lock', icon: Lock },
  { name: 'Key', icon: Key },
  { name: 'Zap', icon: Zap },
  { name: 'Flame', icon: Flame },
  { name: 'Trophy', icon: Trophy },
  { name: 'Target', icon: Target },
  { name: 'Flag', icon: Flag },
  { name: 'Map', icon: Map },
  { name: 'Compass', icon: Compass },
  { name: 'Lightbulb', icon: Lightbulb },
  { name: 'Puzzle', icon: Puzzle },
]

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
export default IconPicker
