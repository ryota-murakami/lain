import React, { useCallback, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useIconCandidates } from '@/hooks/useIconCandidates'

const previewSizes = [16, 32, 64] as const

/**
 * Compare a candidate at application and small UI sizes before applying it.
 * Used by {@link IconSettings}; an unloaded catalog has no preview yet.
 * @example
 * <IconCandidatePreview candidate={candidate} />
 */
const IconCandidatePreview = React.memo(function IconCandidatePreview({
  candidate,
}: {
  candidate?: ReturnType<typeof useIconCandidates>['candidates'][number]
}) {
  return (
    <>
      {' '}
      {candidate && (
        <div
          className="bg-muted/20 flex flex-wrap gap-4 rounded-xl border p-4"
          aria-label="Selected candidate preview"
        >
          <div className="space-y-1 text-center">
            <img
              src={`.${candidate.src}`}
              width={128}
              height={128}
              className="h-32 w-32 object-contain"
              alt={`${candidate.id} 128 pixel preview`}
            />
            <span className="text-muted-foreground text-xs">128 px</span>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <p className="text-muted-foreground text-xs">
                {candidate.family}
              </p>
              <h4 className="font-medium">
                {candidate.id} · {candidate.name}
              </h4>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {candidate.intent}
            </p>
            <div
              className="flex items-end gap-4"
              aria-label="Small icon previews"
            >
              {previewSizes.map((size) => (
                <div key={size} className="space-y-1 text-center">
                  <img
                    src={`.${candidate.thumbnail}`}
                    width={size}
                    height={size}
                    alt={`${candidate.id} ${size} pixel preview`}
                  />
                  <span className="text-muted-foreground block text-[10px]">
                    {size} px
                  </span>
                </div>
              ))}
              <div
                className="ml-auto flex gap-1 self-end pb-5"
                aria-label="Intended color palette"
              >
                {candidate.palette.map((color) => (
                  <span
                    key={color}
                    title={color}
                    className="size-3 rounded-full border"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
})

/**
 * Compare the 64 generated icons and apply an explicit, reversible native preference.
 * Settings mounts this gallery; choosing a preview does not change the running application icon.
 * {@link useIconCandidates} loads and validates artwork metadata and handles native failures.
 * @returns The candidate grid, four preview sizes, current selection, and apply/reset controls.
 * @example
 * <IconSettings />
 */
export const IconSettings = React.memo(function IconSettings() {
  const {
    candidates,
    capabilities,
    loading,
    busy,
    error,
    status,
    retry,
    apply,
  } = useIconCandidates()
  const [previewId, setPreviewId] = useState<string>()
  const candidate =
    candidates.find(
      (item) => item.id === (previewId ?? capabilities?.selectedIcon),
    ) ?? candidates[0]
  const selectedId = capabilities?.selectedIcon
  const handlePreview = (event: React.MouseEvent<HTMLButtonElement>): void => {
    setPreviewId(event.currentTarget.value)
  }
  const handleApply = useCallback(() => {
    if (candidate) void apply(candidate.id)
  }, [apply, candidate])
  const handleReset = useCallback(() => {
    void apply(null)
  }, [apply])

  return (
    <section
      aria-label="Icon candidates"
      className="space-y-4"
      aria-busy={loading}
    >
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Find your Lain icon</h3>
        <p className="text-muted-foreground text-sm">
          64 designs, eight directions. Preview a candidate, then apply it to
          this computer’s {capabilities?.iconTarget ?? 'Dock/window'}. Your
          choice is remembered on restart.
        </p>
        {capabilities && (
          <p className="text-xs">
            Current icon: {selectedId ?? 'Release default'}
          </p>
        )}
      </div>

      {loading && (
        <p role="status" className="text-muted-foreground text-sm">
          Loading icon candidates…
        </p>
      )}

      <IconCandidatePreview candidate={candidate} />

      {candidates.length > 0 && (
        <div
          role="group"
          aria-label="64 icon candidates"
          className="grid max-h-64 grid-cols-6 gap-2 overflow-y-auto rounded-lg border p-2 sm:grid-cols-8"
        >
          {candidates.map((item) => (
            <button
              key={item.id}
              value={item.id}
              type="button"
              title={`${item.id} ${item.name}`}
              aria-label={`${item.id} ${item.name}`}
              aria-pressed={candidate?.id === item.id}
              onClick={handlePreview}
              className={`focus-visible:ring-ring rounded-lg border p-1 text-xs focus-visible:ring-2 focus-visible:outline-none ${candidate?.id === item.id ? 'border-primary bg-accent' : 'hover:bg-muted border-transparent'}`}
            >
              <img
                className="aspect-square w-full rounded-md"
                loading="lazy"
                src={`.${item.thumbnail}`}
                alt=""
                width={128}
                height={128}
              />
              <span>
                {item.id}
                {selectedId === item.id ? ' ✓' : ''}
              </span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-3">
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
          {!busy && (
            <Button type="button" variant="outline" size="sm" onClick={retry}>
              Retry
            </Button>
          )}
        </div>
      )}
      {status && (
        <p role="status" className="text-sm">
          {status}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={
            busy ||
            loading ||
            !capabilities ||
            !candidate ||
            selectedId === candidate.id
          }
          onClick={handleApply}
        >
          {busy ? 'Applying…' : 'Apply previewed icon'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || loading || !selectedId}
          onClick={handleReset}
        >
          Restore default
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        The installed bundle icon and Linux desktop launcher icon remain the
        release default.
      </p>
    </section>
  )
})
