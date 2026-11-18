import { useMemo } from 'react'
import type { RefObject } from 'react'
import { toast } from 'sonner'

import type { Raindrop, ViewMode } from '@/lib/types'
import { useAppDispatch } from '@/store/hooks'
import { openSettings } from '@/store/slices/dialogSlice'
import { setSearchMode, setSearchOpen } from '@/store/slices/searchSlice'
import { selectAllRaindrops } from '@/store/slices/uiSlice'

import { useKeyboardShortcuts } from './useKeyboardShortcuts'

interface MainAppShortcutOptions {
  isSearchOpen: boolean
  selectedRaindropIds: string[]
  selectedRaindrop?: Raindrop
  searchInputRef: RefObject<HTMLInputElement | null>
  handleAddBookmark: () => void
  handleAddCollection: () => void
  handleManageTags: () => void
  handleViewModeChange: (mode: ViewMode) => void
  handleToggleImportant: (id: string) => void
  handleBatchDelete: (ids: string[]) => Promise<void>
}

/**
 * Register application-level shortcuts independently of view-local row navigation.
 * MainApp supplies the current selection and shared actions; rendered rows define Select All.
 * @example useMainAppShortcuts({ ...actions, searchInputRef, selectedRaindropIds })
 */
export function useMainAppShortcuts({
  isSearchOpen,
  selectedRaindropIds,
  selectedRaindrop,
  searchInputRef,
  handleAddBookmark,
  handleAddCollection,
  handleManageTags,
  handleViewModeChange,
  handleToggleImportant,
  handleBatchDelete,
}: MainAppShortcutOptions): void {
  const dispatch = useAppDispatch()
  const actions = useMemo(
    () => ({
      search: () => dispatch(setSearchOpen(!isSearchOpen)),
      newBookmark: handleAddBookmark,
      newCollection: handleAddCollection,
      viewGrid: (): void => handleViewModeChange('grid'),
      viewList: (): void => handleViewModeChange('list'),
      viewTable: (): void => handleViewModeChange('table'),
      viewDirectory: (): void => handleViewModeChange('directory'),
      settings: () => dispatch(openSettings()),
      editShortcuts: () => dispatch(openSettings({ tab: 'shortcuts' })),
      delete: (): void => {
        const ids = selectedRaindropIds.length
          ? selectedRaindropIds
          : selectedRaindrop
            ? [selectedRaindrop.id]
            : []
        if (ids.length)
          void handleBatchDelete(ids).catch(() =>
            toast.error('Could not delete the selection. Please retry.'),
          )
      },
      selectAll: (): void => {
        const rows =
          document.querySelectorAll<HTMLElement>('[data-raindrop-id]')
        const ids = Array.from(rows, (row) => row.dataset.raindropId).filter(
          (id): id is string => Boolean(id),
        )
        dispatch(selectAllRaindrops([...new Set(ids)]))
      },
      searchInView: () => searchInputRef.current?.focus(),
      searchGlobal: (): void => {
        dispatch(setSearchMode('global'))
        dispatch(setSearchOpen(true))
      },
      toggleImportant: (): void => {
        const id =
          selectedRaindropIds.length === 1
            ? selectedRaindropIds[0]
            : selectedRaindrop?.id
        if (id) handleToggleImportant(id)
      },
      manageTags: handleManageTags,
    }),
    [
      dispatch,
      handleAddBookmark,
      handleAddCollection,
      handleBatchDelete,
      handleManageTags,
      handleToggleImportant,
      handleViewModeChange,
      isSearchOpen,
      searchInputRef,
      selectedRaindrop,
      selectedRaindropIds,
    ],
  )
  useKeyboardShortcuts(actions)
}
