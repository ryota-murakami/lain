import { RotateCcw } from 'lucide-react'
import React, { useCallback, useState } from 'react'
import { match } from 'ts-pattern'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useShortcutEditor } from '@/hooks/useShortcutEditor'
import type { ShortcutEditorState } from '@/hooks/useShortcutEditor'
import { formatShortcut, isSameBinding } from '@/lib/shortcut-utils'
import type { KeyboardEventLike } from '@/lib/shortcut-utils'
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_DEFINITIONS,
} from '@/store/slices/settingsSlice'
import type {
  ShortcutActionId,
  ShortcutBinding,
  ShortcutCategory,
  ShortcutDefinition,
} from '@/store/slices/settingsSlice'

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: 'Navigation',
  editing: 'Editing',
  view: 'View',
  system: 'System',
}

const CATEGORY_ORDER: ShortcutCategory[] = [
  'navigation',
  'editing',
  'view',
  'system',
]

/** Actions whose key belongs to the platform (Radix dialogs own Escape) — listed but not editable. */
const FIXED_ACTION_IDS: ReadonlySet<ShortcutActionId> = new Set(['escape'])

const IDLE_STATE: ShortcutEditorState = { status: 'idle' }

/**
 * Human label for an action id; falls back to the id for keys only known to an older build.
 * @example labelFor('search') // => 'Global Search'
 */
function labelFor(actionId: string): string {
  return (
    SHORTCUT_DEFINITIONS.find((definition) => definition.actionId === actionId)
      ?.label ?? actionId
  )
}

/**
 * Keyboard shortcut editor (SPEC F8): name filter, per-action Edit with key capture,
 * conflict warning with Swap, and Reset to Defaults. Rendered by {@link SettingsDialog}.
 *
 * @example
 *   <ShortcutEditor />
 */
export const ShortcutEditor = React.memo(function ShortcutEditor() {
  const {
    shortcuts,
    editorState,
    startCapture,
    cancel,
    captureKey,
    confirmSwap,
    resetAll,
  } = useShortcutEditor()
  const [filterText, setFilterText] = useState('')

  const handleFilterChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setFilterText(event.target.value)
    },
    [],
  )

  const normalizedFilter = filterText.trim().toLowerCase()
  const visibleDefinitions = SHORTCUT_DEFINITIONS.filter((definition) =>
    definition.label.toLowerCase().includes(normalizedFilter),
  )

  return (
    <div className="space-y-3" data-testid="shortcut-editor">
      <div className="flex items-center gap-2">
        <Input
          value={filterText}
          onChange={handleFilterChange}
          placeholder="Filter actions..."
          aria-label="Filter actions"
          className="h-8"
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0">
              <RotateCcw data-icon="inline-start" />
              Reset to Defaults
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset all shortcuts?</AlertDialogTitle>
              <AlertDialogDescription>
                Every custom binding will be replaced with its default.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={resetAll}>Reset</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {visibleDefinitions.length === 0 && (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No actions match “{filterText.trim()}”.
          </p>
        )}
        {CATEGORY_ORDER.map((category) => {
          const definitions = visibleDefinitions.filter(
            (definition) => definition.category === category,
          )
          if (definitions.length === 0) return null
          return (
            <section key={category} className="mb-4">
              <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                {CATEGORY_LABELS[category]}
              </h4>
              <div className="space-y-1">
                {definitions.map((definition) => (
                  <ShortcutRow
                    key={definition.actionId}
                    definition={definition}
                    binding={shortcuts[definition.actionId]}
                    rowState={
                      editorState.status !== 'idle' &&
                      editorState.actionId === definition.actionId
                        ? editorState
                        : IDLE_STATE
                    }
                    onEdit={startCapture}
                    onCancel={cancel}
                    onCaptureKey={captureKey}
                    onSwap={confirmSwap}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
})

interface ShortcutRowProps {
  definition: ShortcutDefinition
  /** Undefined only when a persisted map predates this action. */
  binding: ShortcutBinding | undefined
  /** Editor state scoped to this row — idle unless this action is being edited. */
  rowState: ShortcutEditorState
  onEdit: (actionId: ShortcutActionId) => void
  onCancel: () => void
  onCaptureKey: (event: KeyboardEventLike) => void
  onSwap: () => void
}

/** One action row: label + Custom badge, then binding/Edit, the capture field, or the conflict prompt. */
const ShortcutRow = React.memo(function ShortcutRow({
  definition,
  binding,
  rowState,
  onEdit,
  onCancel,
  onCaptureKey,
  onSwap,
}: ShortcutRowProps) {
  const { actionId, label } = definition
  const isFixed = FIXED_ACTION_IDS.has(actionId)
  const handleEdit = useCallback(() => onEdit(actionId), [onEdit, actionId])
  const isCustom =
    binding !== undefined &&
    !isSameBinding(binding, DEFAULT_SHORTCUTS[actionId])

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5"
      data-testid={`shortcut-row-${actionId}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm">{label}</span>
        {isCustom && <Badge variant="secondary">Custom</Badge>}
      </div>
      {match(rowState)
        .with({ status: 'idle' }, () => (
          <div className="flex items-center gap-2">
            {binding && (
              <kbd className="bg-muted text-muted-foreground rounded border px-1.5 py-0.5 font-mono text-xs">
                {formatShortcut(binding)}
              </kbd>
            )}
            {isFixed ? (
              <span className="text-muted-foreground w-12 text-center text-xs">
                Fixed
              </span>
            ) : (
              <Button
                variant="ghost"
                size="xs"
                className="w-12"
                aria-label={`Edit ${label} shortcut`}
                onClick={handleEdit}
              >
                Edit
              </Button>
            )}
          </div>
        ))
        .with({ status: 'capturing' }, () => (
          <div className="flex items-center gap-2">
            <ShortcutCaptureField
              label={label}
              onCancel={onCancel}
              onCaptureKey={onCaptureKey}
            />
            <Button variant="ghost" size="xs" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        ))
        .with({ status: 'conflict' }, (conflict) => (
          <div className="flex items-center gap-2" role="alert">
            <span className="text-destructive text-xs">
              {formatShortcut(conflict.binding)} is used by{' '}
              {labelFor(conflict.conflictingActionId)}
            </span>
            <Button variant="outline" size="xs" onClick={onSwap}>
              Swap
            </Button>
            <Button variant="ghost" size="xs" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        ))
        .exhaustive()}
    </div>
  )
})

interface ShortcutCaptureFieldProps {
  label: string
  onCancel: () => void
  onCaptureKey: (event: KeyboardEventLike) => void
}

/** Read-only input that turns the next keydown into a binding (Escape cancels); mounted only while capturing, so autofocus starts the capture at once. */
const ShortcutCaptureField = React.memo(function ShortcutCaptureField({
  label,
  onCancel,
  onCaptureKey,
}: ShortcutCaptureFieldProps) {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      // Swallow every key: nothing may type into the field or reach the global shortcut hook
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        onCancel()
        return
      }
      onCaptureKey(event)
    },
    [onCancel, onCaptureKey],
  )

  return (
    <Input
      autoFocus
      readOnly
      data-shortcut-capture="true"
      aria-label={`Press new shortcut for ${label}`}
      placeholder="Press keys… (Esc cancels)"
      className="h-7 w-44 text-xs"
      onKeyDown={handleKeyDown}
    />
  )
})
