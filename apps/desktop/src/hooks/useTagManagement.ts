import { useCallback, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type {
  TagEntry,
  TagManagementProps,
} from '@/components/raindrop/tag-management.types'

import { usePendingWork } from './usePendingWork'

type SelectionSetter = Dispatch<SetStateAction<Set<string>>>

/** Own filtering and visible-row selection while preserving selections hidden by search. */
function useTagSelection(tags: TagEntry[]) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<'name' | 'count'>('count')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const filteredAndSortedTags = useMemo(() => {
    const lower = searchQuery.toLowerCase()
    const filtered = tags.filter((tag) =>
      tag.name.toLowerCase().includes(lower),
    )
    return filtered.sort((a, b) =>
      sortMode === 'name' ? a.name.localeCompare(b.name) : b.count - a.count,
    )
  }, [tags, searchQuery, sortMode])
  const allVisibleSelected =
    filteredAndSortedTags.length > 0 &&
    filteredAndSortedTags.every((tag) => selectedTags.has(tag.name))
  const toggleTag = useCallback(
    (name: string) =>
      setSelectedTags((previous) => {
        const next = new Set(previous)
        if (next.has(name)) next.delete(name)
        else next.add(name)
        return next
      }),
    [],
  )
  const toggleAll = useCallback(
    () =>
      setSelectedTags((previous) => {
        const next = new Set(previous)
        // Hidden selections survive toggling the currently visible rows.
        for (const tag of filteredAndSortedTags) {
          if (allVisibleSelected) next.delete(tag.name)
          else next.add(tag.name)
        }
        return next
      }),
    [allVisibleSelected, filteredAndSortedTags],
  )
  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setSearchQuery(event.target.value),
    [],
  )
  const handleSortByName = useCallback(() => setSortMode('name'), [])
  const handleSortByCount = useCallback(() => setSortMode('count'), [])
  return {
    searchQuery,
    sortMode,
    selectedTags,
    setSelectedTags,
    filteredAndSortedTags,
    allVisibleSelected,
    toggleTag,
    toggleAll,
    handleSearchChange,
    handleSortByName,
    handleSortByCount,
  }
}

/** Serialize tag writes and retain failures in the active dialog without swallowing its draft. */
function useTagWriteState() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pendingRef = useRef(false)
  const run = useCallback(
    async (operation: () => Promise<void>, fallback: string): Promise<void> => {
      if (pendingRef.current) return
      pendingRef.current = true
      setBusy(true)
      setError('')
      try {
        await operation()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : fallback)
      } finally {
        pendingRef.current = false
        setBusy(false)
      }
    },
    [],
  )
  return { busy, error, setError, pendingRef, run }
}

type TagWriteState = ReturnType<typeof useTagWriteState>

/** Retain the proposed tag name until a rename is confirmed by the API. */
function useTagRename(
  onRename: TagManagementProps['onRename'],
  setSelection: SelectionSetter,
  writes: TagWriteState,
) {
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const { pendingRef, setError, run } = writes
  const startRename = useCallback(
    (name: string) => {
      if (pendingRef.current) return
      setError('')
      setEditingTag(name)
      setEditValue(name)
    },
    [pendingRef, setError],
  )
  const cancelRename = useCallback(() => {
    if (pendingRef.current) return
    setEditingTag(null)
    setEditValue('')
    setError('')
  }, [pendingRef, setError])
  const confirmRename = useCallback(async (): Promise<void> => {
    const name = editValue.trim()
    if (!editingTag || !name || name === editingTag || !onRename) return
    await run(async () => {
      await onRename(editingTag, name)
      setSelection((previous) => {
        const next = new Set(previous)
        if (next.delete(editingTag)) next.add(name)
        return next
      })
      setEditingTag(null)
      setEditValue('')
    }, 'Could not rename the tag. Your name is preserved; try again.')
  }, [editValue, editingTag, onRename, run, setSelection])
  return {
    editingTag,
    editValue,
    startRename,
    cancelRename,
    confirmRename,
    handleEditValueChange: setEditValue,
  }
}

/** Keep merge selections and target text through failed writes, allowing the same merge to be retried. */
function useTagMerge(
  onMerge: TagManagementProps['onMerge'],
  selectedTags: Set<string>,
  setSelection: SelectionSetter,
  writes: TagWriteState,
) {
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [mergeTargetName, setMergeTargetName] = useState('')
  const { pendingRef, setError, run } = writes
  const handleMerge = useCallback(async (): Promise<void> => {
    const target = mergeTargetName.trim()
    if (selectedTags.size < 2 || !target || !onMerge) return
    await run(async () => {
      await onMerge([...selectedTags], target)
      setSelection(new Set())
      setMergeDialogOpen(false)
      setMergeTargetName('')
    }, 'Could not merge tags. Your selection is preserved; try again.')
  }, [mergeTargetName, selectedTags, onMerge, run, setSelection])
  const handleOpenMergeDialog = useCallback(() => {
    if (pendingRef.current) return
    setError('')
    setMergeTargetName('')
    setMergeDialogOpen(true)
  }, [pendingRef, setError])
  const handleMergeOpenChange = useCallback(
    (open: boolean) => {
      if (pendingRef.current) return
      setMergeDialogOpen(open)
      setError('')
    },
    [pendingRef, setError],
  )
  const handleCloseMergeDialog = useCallback(
    () => handleMergeOpenChange(false),
    [handleMergeOpenChange],
  )
  const handleMergeTargetChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setMergeTargetName(event.target.value),
    [],
  )
  const handleMergeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') void handleMerge()
    },
    [handleMerge],
  )
  return {
    mergeDialogOpen,
    mergeTargetName,
    handleMerge,
    handleOpenMergeDialog,
    handleMergeOpenChange,
    handleCloseMergeDialog,
    handleMergeTargetChange,
    handleMergeKeyDown,
  }
}

/** Delete only confirmed tag selections; partial bulk failures keep the unfinished tags available for retry. */
function useTagDelete(
  onDelete: TagManagementProps['onDelete'],
  selectedTags: Set<string>,
  setSelection: SelectionSetter,
  writes: TagWriteState,
) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const { pendingRef, setError, run } = writes
  const handleDelete = useCallback(async (): Promise<void> => {
    if (!deleteTarget || !onDelete) return
    await run(async () => {
      await onDelete(deleteTarget)
      setSelection((previous) => {
        const next = new Set(previous)
        next.delete(deleteTarget)
        return next
      })
      setDeleteTarget(null)
    }, 'Could not delete the tag. Please retry.')
  }, [deleteTarget, onDelete, run, setSelection])
  const handleBulkDelete = useCallback(async (): Promise<void> => {
    if (!onDelete || !selectedTags.size) return
    await run(async () => {
      let completed = 0
      try {
        for (const name of selectedTags) {
          await onDelete(name)
          completed++
          setSelection((previous) => {
            const next = new Set(previous)
            next.delete(name)
            return next
          })
        }
      } catch {
        throw new Error(
          `Deleted ${completed} tags. The remaining selected tags could not be deleted; retry to continue.`,
        )
      }
    }, 'Could not delete the tags. Please retry.')
  }, [onDelete, selectedTags, run, setSelection])
  const handleDeleteDialogOpenChange = useCallback(
    (open: boolean) => {
      if (open || pendingRef.current) return
      setDeleteTarget(null)
      setError('')
    },
    [pendingRef, setError],
  )
  const handleSetDeleteTarget = useCallback(
    (name: string) => {
      if (pendingRef.current) return
      setDeleteTarget(name)
      setError('')
    },
    [pendingRef, setError],
  )
  return {
    deleteTarget,
    handleDelete,
    handleBulkDelete,
    handleDeleteDialogOpenChange,
    handleSetDeleteTarget,
  }
}

/**
 * Compose independent tag-selection and write flows for the management panel.
 * The panel renders this controller; pending writes and unsaved rename/merge drafts protect app shutdown.
 * @example const tags = useTagManagement(props)
 */
export function useTagManagement({
  tags,
  open,
  onOpenChange,
  onRename,
  onMerge,
  onDelete,
}: TagManagementProps) {
  const selection = useTagSelection(tags)
  const writes = useTagWriteState()
  const rename = useTagRename(onRename, selection.setSelectedTags, writes)
  const merge = useTagMerge(
    onMerge,
    selection.selectedTags,
    selection.setSelectedTags,
    writes,
  )
  const deletion = useTagDelete(
    onDelete,
    selection.selectedTags,
    selection.setSelectedTags,
    writes,
  )
  const { pendingRef, busy, error } = writes
  usePendingWork(
    busy ||
      (open &&
        (rename.editingTag !== null ||
          (merge.mergeDialogOpen && merge.mergeTargetName.length > 0))),
  )
  const handlePanelOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!pendingRef.current) onOpenChange(nextOpen)
    },
    [pendingRef, onOpenChange],
  )
  const handleCloseDialog = useCallback(
    () => handlePanelOpenChange(false),
    [handlePanelOpenChange],
  )
  return {
    ...selection,
    ...rename,
    ...merge,
    ...deletion,
    busy,
    error,
    handlePanelOpenChange,
    handleCloseDialog,
  }
}
