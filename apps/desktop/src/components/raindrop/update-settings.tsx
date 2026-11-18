import React, { useCallback, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useAppUpdates } from '@/hooks/useAppUpdates'
import type { UpdateApi, UpdateState } from '@/lib/update-contract'

interface UpdateSettingsProps {
  hasPendingWork?: boolean
  api?: UpdateApi
}

const statusText: Record<UpdateState['phase'], string> = {
  idle: 'Check for a new version of Lain.',
  checking: 'Checking for updates…',
  current: 'You are using the latest version.',
  available: 'A new version is available.',
  downloading: 'Downloading the update…',
  ready: 'The update is ready. Restart when your work is saved.',
  installing: 'Preparing to restart…',
  error: 'The update could not finish. You can retry.',
  unavailable: 'Updates are available in installed release builds.',
}

/**
 * Present native state independently from user-action controls.
 * Rendered by {@link UpdateSettings} for progress, errors and distribution instructions.
 * @example <UpdateStatus state={state} error={state.error} />
 */
const UpdateStatus = React.memo(function UpdateStatus({
  state,
  error,
}: {
  state: UpdateState
  error: string | null
}) {
  return (
    <>
      <div>
        <h3 id="app-update-heading" className="text-sm font-medium">
          App updates
        </h3>
        <p className="text-muted-foreground text-sm">
          Current version: {state.currentVersion}
        </p>
      </div>
      <p role="status" className="text-sm">
        {statusText[state.phase]}
      </p>
      {state.availableVersion && (
        <p className="text-sm">Available version: {state.availableVersion}</p>
      )}
      {state.mode === 'manual' && (
        <p className="text-muted-foreground text-sm">
          Linux deb installations update through a downloaded package. Install
          the new .deb with your package manager; Lain will not replace it
          automatically.
        </p>
      )}
      {state.progress && (
        <div className="space-y-2">
          <Progress
            aria-label="Update download progress"
            className="h-2 w-full"
            max={100}
            value={state.progress.percent}
          />
          <p className="text-muted-foreground text-xs">
            {Math.round(state.progress.percent)}%
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </>
  )
})

/**
 * Expose explicit update consent, progress and restart controls inside Settings.
 * The settings dialog mounts this card and disables restart while unsaved work exists.
 * @param props.hasPendingWork - Unsaved edits or active transfers that must finish before restarting.
 * @returns Version/status and controls appropriate to the installed distribution.
 * @example
 * <UpdateSettings hasPendingWork={uploading || hasUnsavedEdits} />
 */
export const UpdateSettings = React.memo(function UpdateSettings({
  hasPendingWork = false,
  api = window.updates,
}: UpdateSettingsProps) {
  const state = useAppUpdates(api)
  const [actionError, setActionError] = useState<string | null>(null)
  const busy = ['checking', 'downloading', 'installing'].includes(state.phase)
  const canDownload =
    (state.mode === 'manual' || Boolean(state.availableVersion)) &&
    !['ready', 'installing'].includes(state.phase)
  const run = useCallback(
    async (action: 'check' | 'download' | 'install') => {
      setActionError(null)
      try {
        await api?.[action]()
      } catch {
        setActionError('The update service is unavailable. Try again.')
      }
    },
    [api],
  )
  const handleCheck = useCallback(() => {
    void run('check')
  }, [run])
  const handleDownload = useCallback(() => {
    void run('download')
  }, [run])
  const handleInstall = useCallback(() => {
    if (!hasPendingWork) void run('install')
  }, [hasPendingWork, run])

  return (
    <section aria-labelledby="app-update-heading" className="space-y-4">
      <UpdateStatus state={state} error={actionError ?? state.error} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleCheck}
          disabled={
            !api ||
            busy ||
            state.mode === 'development' ||
            state.phase === 'ready'
          }
        >
          Check for updates
        </Button>
        {canDownload && (
          <Button type="button" onClick={handleDownload} disabled={busy}>
            {state.mode === 'manual'
              ? 'Open package download'
              : 'Download update'}
          </Button>
        )}
        {state.phase === 'ready' && state.mode === 'in-app' && (
          <Button
            type="button"
            onClick={handleInstall}
            disabled={hasPendingWork}
          >
            Restart and install
          </Button>
        )}
      </div>
      {state.phase === 'ready' && (
        <p className="text-muted-foreground text-sm">
          You can leave this for later. Closing Lain normally will not install
          the update.
        </p>
      )}
      {hasPendingWork && (
        <p className="text-muted-foreground text-sm">
          Finish uploads and save or discard your edits before restarting.
        </p>
      )}
    </section>
  )
})
