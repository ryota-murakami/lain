import {
  Globe,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Star,
  MoreHorizontal,
  ExternalLink,
  Pencil,
  FolderInput,
  Tag,
  Copy,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react'
import React, { useState, useMemo, useCallback } from 'react'
import { toast } from 'sonner'

import { FaviconIcon } from '@/components/raindrop/favicon-icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Raindrop } from '@/lib/types'
import { cn } from '@/lib/utils'

import { ContentTypeIcon } from './content-type-icon'

/**
 * Format a date string to a human-readable relative format.
 * @param dateStr - ISO date string
 * @returns Formatted date string
 * @example formatDate("2026-02-08T10:00:00Z") // => "Feb 8, 2026"
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (!Number.isFinite(date.getTime())) return '—'
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`
  if (diffDays < 2) return 'Yesterday'
  if (diffDays < 7) return `${Math.floor(diffDays)}d ago`
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

type SortKey = 'title' | 'domain' | 'type' | 'createdAt' | 'updatedAt'
type SortDir = 'asc' | 'desc'
const PAGE_SIZE = 50
const EMPTY_SELECTION = new Set<string>()

/**
 * Sort only loaded rows after a table column is explicitly chosen.
 * {@link TableView} otherwise preserves the API's complete ordering preference.
 * @returns A sorted copy, or the original API-ordered input when no local sort is active.
 * @example sortLoadedRaindrops(bookmarks, 'title', 'asc')
 */
function sortLoadedRaindrops(
  raindrops: Raindrop[],
  key: SortKey | null,
  direction: SortDir,
): Raindrop[] {
  if (key === null) return raindrops
  return [...raindrops].sort((left, right) => {
    const comparison =
      key === 'createdAt' || key === 'updatedAt'
        ? (Date.parse(left[key]) || 0) - (Date.parse(right[key]) || 0)
        : (left[key] ?? '').localeCompare(right[key] ?? '')
    return direction === 'asc' ? comparison : -comparison
  })
}

/**
 * Keep the current loaded-results page valid when deletion or filtering shrinks the list.
 * {@link TableView} uses a guarded render adjustment to avoid a transient empty page.
 * @returns The bounded page and a setter for explicit navigation.
 * @example const pagination = useLoadedTablePage(105)
 */
function useLoadedTablePage(count: number) {
  const [state, setState] = useState({ page: 0, count })
  const totalPages = Math.ceil(count / PAGE_SIZE)
  const page = Math.min(state.page, Math.max(0, totalPages - 1))
  // Remember the bounded page so subsequent loading cannot resurrect an invalid old page.
  if (state.count !== count) setState({ page, count })
  const setPage = useCallback(
    (nextPage: number): void =>
      setState((previous) => ({ ...previous, page: Math.max(0, nextPage) })),
    [],
  )
  return { page, totalPages, setPage }
}

/**
 * Column visibility configuration.
 */
interface ColumnVisibility {
  type: boolean
  title: boolean
  domain: boolean
  tags: boolean
  created: boolean
  updated: boolean
  contentType: boolean
}

/**
 * Props for the TableView component.
 */
interface TableViewProps {
  /** Raindrops to display in the table */
  raindrops: Raindrop[]
  /** Currently selected raindrop IDs */
  selectedIds?: Set<string>
  /** Callback when selection changes */
  onSelectionChange?: (ids: Set<string>) => void
  /** Callback when a raindrop is clicked for detail view */
  onSelect?: (raindrop: Raindrop) => void
  /** Callback when opening a URL externally */
  onOpenUrl?: (url: string) => void
  /** Callback when moving raindrop(s) to a collection */
  onMoveToCollection?: (ids: string[]) => void
  /** Callback when adding tags to raindrop(s) */
  onAddTags?: (ids: string[]) => void
  /** Callback when deleting raindrop(s) */
  onDelete?: (ids: string[]) => void
  /** Callback when toggling important status */
  onToggleImportant?: (id: string) => void
  onMarkImportant?: (ids: string[]) => Promise<void>
}

/**
 * Sortable column header component.
 */
const SortHeader = React.memo(function SortHeader({
  label,
  sortKeyName,
  className,
  sortKey,
  sortDir,
  onToggleSort,
}: {
  label: string
  sortKeyName: SortKey
  className?: string
  sortKey: SortKey | null
  sortDir: SortDir
  onToggleSort: (key: SortKey) => void
}) {
  const isActive = sortKey === sortKeyName
  return (
    <TableHead
      aria-sort={
        isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
      }
      className={cn('cursor-pointer select-none', className)}
    >
      <button
        type="button"
        className="hover:text-foreground flex items-center gap-1"
        onClick={() => onToggleSort(sortKeyName)}
      >
        {label}
        {isActive ? (
          sortDir === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  )
})

interface TableRowItemProps {
  raindrop: Raindrop
  index: number
  isSelected: boolean
  columnVisibility: ColumnVisibility
  onSelect?: (raindrop: Raindrop) => void
  onOpenUrl?: (url: string) => void
  onMoveToCollection?: (ids: string[]) => void
  onAddTags?: (ids: string[]) => void
  onDelete?: (ids: string[]) => void
  onToggleImportant?: (id: string) => void
  onToggleSelect: (id: string) => void
}

/** Bind a table bookmark's pointer, checkbox and menu actions without coupling them to cell visibility. */
function useTableRowActions({
  raindrop,
  onSelect,
  onOpenUrl,
  onMoveToCollection,
  onAddTags,
  onDelete,
  onToggleImportant,
  onToggleSelect,
}: Omit<TableRowItemProps, 'index' | 'isSelected' | 'columnVisibility'>) {
  const handleRowClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.metaKey || event.ctrlKey) onToggleSelect(raindrop.id)
      else onSelect?.(raindrop)
    },
    [onSelect, onToggleSelect, raindrop],
  )
  const handleRowDoubleClick = useCallback(
    () => onOpenUrl?.(raindrop.url),
    [onOpenUrl, raindrop.url],
  )
  const handleCheckboxChange = useCallback(
    () => onToggleSelect(raindrop.id),
    [onToggleSelect, raindrop.id],
  )
  const handleStopPropagation = useCallback(
    (e: React.MouseEvent) => e.stopPropagation(),
    [],
  )
  const handleOpenUrl = useCallback(
    () => onOpenUrl?.(raindrop.url),
    [onOpenUrl, raindrop.url],
  )
  const handleEdit = useCallback(
    () => onSelect?.(raindrop),
    [onSelect, raindrop],
  )
  const handleMove = useCallback(
    () => onMoveToCollection?.([raindrop.id]),
    [onMoveToCollection, raindrop.id],
  )
  const handleAddTags = useCallback(
    () => onAddTags?.([raindrop.id]),
    [onAddTags, raindrop.id],
  )
  const handleCopyUrl = useCallback(
    async () => navigator.clipboard.writeText(raindrop.url),
    [raindrop.url],
  )
  const handleToggleImportant = useCallback(
    () => onToggleImportant?.(raindrop.id),
    [onToggleImportant, raindrop.id],
  )
  const handleDeleteItem = useCallback(
    () => onDelete?.([raindrop.id]),
    [onDelete, raindrop.id],
  )

  return {
    handleRowClick,
    handleRowDoubleClick,
    handleCheckboxChange,
    handleStopPropagation,
    handleOpenUrl,
    handleEdit,
    handleMove,
    handleAddTags,
    handleCopyUrl,
    handleToggleImportant,
    handleDeleteItem,
  }
}

/** Render only the enabled bookmark data cells; selection and action menus remain in the row container. */
const TableBookmarkCells = React.memo(function TableBookmarkCells({
  raindrop,
  columnVisibility,
}: Pick<TableRowItemProps, 'raindrop' | 'columnVisibility'>) {
  return (
    <>
      {columnVisibility.type && (
        <TableCell className="w-8">
          <FaviconIcon url={raindrop.url} type={raindrop.type} size={16} />
        </TableCell>
      )}
      {columnVisibility.title && (
        <TableCell className="min-w-[200px] font-medium">
          <div className="flex items-center gap-1.5">
            <span className="truncate">{raindrop.title}</span>
            {raindrop.isImportant && (
              <span className="flex-shrink-0 text-amber-500">★</span>
            )}
          </div>
        </TableCell>
      )}
      {columnVisibility.domain && (
        <TableCell className="text-muted-foreground text-xs">
          {raindrop.domain || ''}
        </TableCell>
      )}
      {columnVisibility.tags && (
        <TableCell>
          <div className="flex items-center gap-1 truncate">
            {raindrop.tags.slice(0, 2).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="h-4 px-1.5 text-[10px]"
              >
                {tag}
              </Badge>
            ))}
            {raindrop.tags.length > 2 && (
              <span className="text-muted-foreground text-[10px]">
                +{raindrop.tags.length - 2}
              </span>
            )}
          </div>
        </TableCell>
      )}
      {columnVisibility.created && (
        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
          {formatDate(raindrop.createdAt)}
        </TableCell>
      )}
      {columnVisibility.updated && (
        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
          {formatDate(raindrop.updatedAt)}
        </TableCell>
      )}
      {columnVisibility.contentType && (
        <TableCell className="text-muted-foreground text-xs capitalize">
          <div className="flex items-center gap-1">
            <ContentTypeIcon type={raindrop.type} className="h-3 w-3" />
            {raindrop.type}
          </div>
        </TableCell>
      )}
    </>
  )
})

/**
 * A single table row with context menu for a raindrop.
 * Extracted from .map() to allow useCallback for event handlers.
 */
const TableRowItem = React.memo(function TableRowItem({
  raindrop,
  index,
  isSelected,
  columnVisibility,
  onSelect,
  onOpenUrl,
  onMoveToCollection,
  onAddTags,
  onDelete,
  onToggleImportant,
  onToggleSelect,
}: TableRowItemProps) {
  const {
    handleRowClick,
    handleRowDoubleClick,
    handleCheckboxChange,
    handleStopPropagation,
    handleOpenUrl,
    handleEdit,
    handleMove,
    handleAddTags,
    handleCopyUrl,
    handleToggleImportant,
    handleDeleteItem,
  } = useTableRowActions({
    raindrop,
    onSelect,
    onOpenUrl,
    onMoveToCollection,
    onAddTags,
    onDelete,
    onToggleImportant,
    onToggleSelect,
  })

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableRow
          data-raindrop-id={raindrop.id}
          aria-selected={isSelected}
          tabIndex={-1}
          className={cn(
            'focus-visible:bg-accent h-10 cursor-pointer transition-colors focus-visible:outline-none',
            isSelected && 'bg-accent',
            index % 2 === 1 && !isSelected && 'bg-muted/30',
          )}
          onClick={handleRowClick}
          onDoubleClick={handleRowDoubleClick}
        >
          <TableCell className="w-10">
            <Checkbox
              checked={isSelected}
              onCheckedChange={handleCheckboxChange}
              onClick={handleStopPropagation}
              aria-label={`Select ${raindrop.title}`}
            />
          </TableCell>
          <TableBookmarkCells
            raindrop={raindrop}
            columnVisibility={columnVisibility}
          />
          <TableCell className="w-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleStopPropagation}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleOpenUrl}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open URL
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleMove}>
                  <FolderInput className="mr-2 h-4 w-4" />
                  Move to Collection...
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAddTags}>
                  <Tag className="mr-2 h-4 w-4" />
                  Add Tags...
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyUrl}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy URL
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleToggleImportant}>
                  <Star className="mr-2 h-4 w-4" />
                  {raindrop.isImportant
                    ? 'Remove Important'
                    : 'Mark as Important'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleDeleteItem}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Move to Trash
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleOpenUrl}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Open URL
        </ContextMenuItem>
        <ContextMenuItem onClick={handleEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleMove}>
          <FolderInput className="mr-2 h-4 w-4" />
          Move to Collection...
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyUrl}>
          <Copy className="mr-2 h-4 w-4" />
          Copy URL
        </ContextMenuItem>
        <ContextMenuItem onClick={handleToggleImportant}>
          <Star className="mr-2 h-4 w-4" />
          {raindrop.isImportant ? 'Remove Important' : 'Mark as Important'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onClick={handleDeleteItem}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Move to Trash
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})

/**
 * Column visibility toggle item extracted for useCallback.
 */
const ColumnToggleItem = React.memo(function ColumnToggleItem({
  col,
  checked,
  onToggle,
}: {
  col: keyof ColumnVisibility
  checked: boolean
  onToggle: (col: keyof ColumnVisibility, checked: boolean) => void
}) {
  const handleCheckedChange = useCallback(
    (value: boolean) => onToggle(col, !!value),
    [onToggle, col],
  )
  return (
    <DropdownMenuCheckboxItem
      checked={checked}
      onCheckedChange={handleCheckedChange}
    >
      {col.charAt(0).toUpperCase() + col.slice(1)}
    </DropdownMenuCheckboxItem>
  )
})

/**
 * Share column controls between the empty-selection toolbar and the bulk-action toolbar.
 * {@link TableView} keeps visibility state; this menu only exposes its toggles.
 * @example <ColumnVisibilityMenu visibility={columnVisibility} onChange={changeVisibility} />
 */
const ColumnVisibilityMenu = React.memo(function ColumnVisibilityMenu({
  visibility,
  onChange,
  outlined = false,
}: {
  visibility: ColumnVisibility
  onChange: (column: keyof ColumnVisibility, checked: boolean) => void
  outlined?: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={outlined ? 'outline' : 'ghost'}
          size="sm"
          className="h-7 gap-1 text-xs"
        >
          {visibility.type ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(visibility) as (keyof ColumnVisibility)[]).map(
          (column) => (
            <ColumnToggleItem
              key={column}
              col={column}
              checked={visibility[column]}
              onToggle={onChange}
            />
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

/**
 * Pagination page number button extracted for useCallback.
 */
const PageButton = React.memo(function PageButton({
  pageNum,
  isActive,
  onSetPage,
}: {
  pageNum: number
  isActive: boolean
  onSetPage: (page: number) => void
}) {
  const handleClick = useCallback(
    () => onSetPage(pageNum),
    [onSetPage, pageNum],
  )
  return (
    <Button
      variant={isActive ? 'default' : 'outline'}
      size="sm"
      className="h-7 w-7 p-0 text-xs"
      onClick={handleClick}
      aria-label={`Page ${pageNum + 1}`}
      aria-current={isActive ? 'page' : undefined}
    >
      {pageNum + 1}
    </Button>
  )
})

/** Own local column sorting and bounded pagination while preserving API order until a column is explicitly chosen. */
function useTableData(raindrops: Raindrop[]) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const { page, totalPages, setPage } = useLoadedTablePage(raindrops.length)

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortKey(key)
        setSortDir('asc')
      }
      setPage(0)
    },
    [setPage, sortKey],
  )

  const sortedRaindrops = useMemo(
    () => sortLoadedRaindrops(raindrops, sortKey, sortDir),
    [raindrops, sortKey, sortDir],
  )
  const paginatedRaindrops = useMemo(
    () => sortedRaindrops.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [sortedRaindrops, page],
  )
  const resetSort = useCallback((): void => {
    setSortKey(null)
    setPage(0)
  }, [setPage])
  const handlePrevPage = useCallback(() => setPage(page - 1), [page, setPage])
  const handleNextPage = useCallback(() => setPage(page + 1), [page, setPage])
  return {
    sortKey,
    sortDir,
    page,
    totalPages,
    setPage,
    toggleSort,
    sortedRaindrops,
    paginatedRaindrops,
    resetSort,
    handlePrevPage,
    handleNextPage,
  }
}

/** Apply table selection only to visible rows and expose bulk actions without discarding off-page selections. */
function useTableSelection({
  selectedIds,
  onSelectionChange,
  onMoveToCollection,
  onAddTags,
  onDelete,
  onMarkImportant,
  paginatedRaindrops,
}: Pick<
  TableViewProps,
  | 'onSelectionChange'
  | 'onMoveToCollection'
  | 'onAddTags'
  | 'onDelete'
  | 'onMarkImportant'
> & { selectedIds: Set<string>; paginatedRaindrops: Raindrop[] }) {
  const allPageSelected =
    paginatedRaindrops.length > 0 &&
    paginatedRaindrops.every((row) => selectedIds.has(row.id))
  const toggleSelectAll = useCallback(() => {
    const next = new Set(selectedIds)
    // Page selection changes only visible rows, preserving selections on other pages.
    for (const row of paginatedRaindrops) {
      if (allPageSelected) next.delete(row.id)
      else next.add(row.id)
    }
    onSelectionChange?.(next)
  }, [selectedIds, paginatedRaindrops, allPageSelected, onSelectionChange])

  const handleBulkMoveSelected = useCallback(
    () => onMoveToCollection?.(Array.from(selectedIds)),
    [onMoveToCollection, selectedIds],
  )
  const handleBulkAddTagsSelected = useCallback(
    () => onAddTags?.(Array.from(selectedIds)),
    [onAddTags, selectedIds],
  )
  const handleBulkMarkImportant = useCallback(() => {
    void onMarkImportant?.([...selectedIds]).catch(() =>
      toast.error('Could not mark the selection important. Please retry.'),
    )
  }, [selectedIds, onMarkImportant])

  const handleBulkDelete = useCallback(
    () => onDelete?.(Array.from(selectedIds)),
    [onDelete, selectedIds],
  )
  const toggleSelect = useCallback(
    (id: string) => {
      const next = new Set(selectedIds)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      onSelectionChange?.(next)
    },
    [selectedIds, onSelectionChange],
  )

  return {
    allPageSelected,
    toggleSelectAll,
    handleBulkMoveSelected,
    handleBulkAddTagsSelected,
    handleBulkMarkImportant,
    handleBulkDelete,
    toggleSelect,
  }
}

/** Render visible table headers and their sort/selection controls independently of the bookmark body. */
const BookmarkTableHeader = React.memo(function BookmarkTableHeader({
  allPageSelected,
  toggleSelectAll,
  columnVisibility,
  sortKey,
  sortDir,
  toggleSort,
}: Pick<ReturnType<typeof useTableData>, 'sortKey' | 'sortDir' | 'toggleSort'> &
  Pick<
    ReturnType<typeof useTableSelection>,
    'allPageSelected' | 'toggleSelectAll'
  > & { columnVisibility: ColumnVisibility }) {
  return (
    <TableHeader className="bg-background sticky top-0 z-10">
      <TableRow className="h-10">
        <TableHead className="w-10">
          <Checkbox
            checked={allPageSelected}
            onCheckedChange={toggleSelectAll}
            aria-label="Select all"
          />
        </TableHead>
        {columnVisibility.type && (
          <TableHead className="w-8">
            <span className="sr-only">Type icon</span>
          </TableHead>
        )}
        {columnVisibility.title && (
          <SortHeader
            label="Title"
            sortKeyName="title"
            className="min-w-[200px]"
            sortKey={sortKey}
            sortDir={sortDir}
            onToggleSort={toggleSort}
          />
        )}
        {columnVisibility.domain && (
          <SortHeader
            label="Domain"
            sortKeyName="domain"
            sortKey={sortKey}
            sortDir={sortDir}
            onToggleSort={toggleSort}
          />
        )}
        {columnVisibility.tags && <TableHead>Tags</TableHead>}
        {columnVisibility.created && (
          <SortHeader
            label="Created"
            sortKeyName="createdAt"
            sortKey={sortKey}
            sortDir={sortDir}
            onToggleSort={toggleSort}
          />
        )}
        {columnVisibility.updated && (
          <SortHeader
            label="Updated"
            sortKeyName="updatedAt"
            sortKey={sortKey}
            sortDir={sortDir}
            onToggleSort={toggleSort}
          />
        )}
        {columnVisibility.contentType && (
          <SortHeader
            label="Type"
            sortKeyName="type"
            sortKey={sortKey}
            sortDir={sortDir}
            onToggleSort={toggleSort}
          />
        )}
        <TableHead className="w-10">
          <span className="sr-only">Actions</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  )
})

/** Render loaded-result pagination with a bounded five-page window and accurate visible-row counts. */
const TablePagination = React.memo(function TablePagination({
  page,
  totalPages,
  setPage,
  handlePrevPage,
  handleNextPage,
  count,
}: Pick<
  ReturnType<typeof useTableData>,
  'page' | 'totalPages' | 'setPage' | 'handlePrevPage' | 'handleNextPage'
> & { count: number }) {
  return (
    <>
      {/* Pagination */}
      {count > 0 && (
        <div className="flex items-center justify-between border-t px-4 py-2">
          <span className="text-muted-foreground text-xs">
            Showing {page * PAGE_SIZE + 1}-
            {Math.min((page + 1) * PAGE_SIZE, count)} of {count}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={page === 0}
              onClick={handlePrevPage}
            >
              Previous
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pageNum =
                totalPages <= 5
                  ? i
                  : Math.max(0, Math.min(page - 2, totalPages - 5)) + i
              return (
                <PageButton
                  key={pageNum}
                  pageNum={pageNum}
                  isActive={page === pageNum}
                  onSetPage={setPage}
                />
              )
            })}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={page >= totalPages - 1}
              onClick={handleNextPage}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  )
})

/**
 * Dense sortable data table view for displaying raindrops.
 * Features sortable columns, column visibility toggles, multi-select,
 * context menus, and pagination controls.
 *
 * @param raindrops - Array of raindrops to display
 * @param selectedIds - Set of currently selected raindrop IDs
 * @param onSelectionChange - Callback when selection changes
 * @param onSelect - Callback when a row is clicked for detail
 * @param onOpenUrl - Callback when opening URL externally
 * @param onMoveToCollection - Callback for moving items
 * @param onAddTags - Callback for adding tags
 * @param onDelete - Callback for deleting items
 * @param onToggleImportant - Callback for toggling important flag
 *
 * @example
 *   <TableView
 *     raindrops={filteredRaindrops}
 *     selectedIds={selected}
 *     onSelectionChange={setSelected}
 *     onSelect={(rd) => openDetail(rd)}
 *     onOpenUrl={(url) => window.shell.openExternal(url)}
 *   />
 */
const TableView = React.memo(function TableView({
  raindrops,
  selectedIds = EMPTY_SELECTION,
  onSelectionChange,
  onSelect,
  onOpenUrl,
  onMoveToCollection,
  onAddTags,
  onDelete,
  onToggleImportant,
  onMarkImportant,
}: TableViewProps) {
  const {
    sortKey,
    sortDir,
    page,
    totalPages,
    setPage,
    toggleSort,
    sortedRaindrops,
    paginatedRaindrops,
    resetSort,
    handlePrevPage,
    handleNextPage,
  } = useTableData(raindrops)
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    type: true,
    title: true,
    domain: true,
    tags: true,
    created: true,
    updated: true,
    contentType: false,
  })
  const {
    allPageSelected,
    toggleSelectAll,
    handleBulkMoveSelected,
    handleBulkAddTagsSelected,
    handleBulkMarkImportant,
    handleBulkDelete,
    toggleSelect,
  } = useTableSelection({
    selectedIds,
    onSelectionChange,
    onMoveToCollection,
    onAddTags,
    onDelete,
    onMarkImportant,
    paginatedRaindrops,
  })
  const handleColumnVisibilityChange = useCallback(
    (col: keyof ColumnVisibility, checked: boolean) => {
      setColumnVisibility((prev) => ({ ...prev, [col]: checked }))
    },
    [],
  )

  return (
    <div className="flex h-full flex-col">
      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="bg-muted/50 flex items-center gap-2 border-b px-4 py-2">
          <span className="text-muted-foreground text-sm">
            {selectedIds.size} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={handleBulkMoveSelected}
          >
            <FolderInput className="h-3.5 w-3.5" />
            Move to...
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={handleBulkAddTagsSelected}
          >
            <Tag className="h-3.5 w-3.5" />
            Add Tag...
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={handleBulkMarkImportant}
          >
            <Star className="h-3.5 w-3.5" />
            Mark Important
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive h-7 gap-1 text-xs"
            onClick={handleBulkDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
          <div className="ml-auto">
            <ColumnVisibilityMenu
              visibility={columnVisibility}
              onChange={handleColumnVisibilityChange}
              outlined
            />
          </div>
        </div>
      )}

      {/* Column visibility toggle (when no selection) */}
      {selectedIds.size === 0 && (
        <div className="flex items-center justify-end border-b px-4 py-1">
          <ColumnVisibilityMenu
            visibility={columnVisibility}
            onChange={handleColumnVisibilityChange}
          />
        </div>
      )}

      <div className="text-muted-foreground flex items-center justify-between border-b px-4 py-1 text-xs">
        <span>
          {sortKey
            ? 'Column sorting applies to loaded bookmarks only.'
            : 'Showing bookmarks in the selected library sort order.'}
        </span>
        {sortKey && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={resetSort}
          >
            Use library order
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <BookmarkTableHeader
            allPageSelected={allPageSelected}
            toggleSelectAll={toggleSelectAll}
            columnVisibility={columnVisibility}
            sortKey={sortKey}
            sortDir={sortDir}
            toggleSort={toggleSort}
          />
          <TableBody>
            {paginatedRaindrops.map((raindrop, index) => (
              <TableRowItem
                key={raindrop.id}
                raindrop={raindrop}
                index={index}
                isSelected={selectedIds.has(raindrop.id)}
                columnVisibility={columnVisibility}
                onSelect={onSelect}
                onOpenUrl={onOpenUrl}
                onMoveToCollection={onMoveToCollection}
                onAddTags={onAddTags}
                onDelete={onDelete}
                onToggleImportant={onToggleImportant}
                onToggleSelect={toggleSelect}
              />
            ))}
          </TableBody>
        </Table>

        {paginatedRaindrops.length === 0 && (
          <div className="text-muted-foreground flex flex-col items-center justify-center py-16">
            <Globe className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">No bookmarks to display</p>
          </div>
        )}
      </div>

      <TablePagination
        page={page}
        totalPages={totalPages}
        setPage={setPage}
        handlePrevPage={handlePrevPage}
        handleNextPage={handleNextPage}
        count={sortedRaindrops.length}
      />
    </div>
  )
})
export { TableView }
