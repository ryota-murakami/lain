import { useCallback, useEffect, useRef, useState } from 'react'
import { z } from 'zod'

import type { DesktopCapabilities } from '@/lib/desktop-contract'

const candidateSchema = z
  .object({
    id: z.string().regex(/^I(0[1-9]|[1-5][0-9]|6[0-4])$/),
    name: z.string().min(1),
    family: z.string().min(1),
    intent: z.string().min(1),
    palette: z.array(z.string().regex(/^#[\da-f]{6}$/i)).min(1),
    src: z.string(),
    thumbnail: z.string(),
  })
  .refine(
    (candidate) =>
      candidate.src === `/icon-candidates/${candidate.id}.png` &&
      candidate.thumbnail === `/icon-candidates/thumbnails/${candidate.id}.png`,
  )
const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  candidates: z
    .array(candidateSchema)
    .length(64)
    .refine(
      (candidates) =>
        new Set(candidates.map((candidate) => candidate.id)).size === 64,
    ),
})

interface IconSettingsState {
  candidates: z.infer<typeof candidateSchema>[]
  capabilities: DesktopCapabilities | null
  loading: boolean
  busy: boolean
  error: string
  status: string
}

const initialState: IconSettingsState = {
  candidates: [],
  capabilities: null,
  loading: true,
  busy: false,
  error: '',
  status: '',
}

/**
 * Load the packaged icon catalog and persist explicit native icon choices.
 * The settings gallery calls this hook when mounted; retries refresh the catalog and native preference.
 * Catalog loading remains independent of native availability so comparison works during a native failure.
 * @returns Validated candidates, native status, and retry/apply event handlers.
 * @example
 * const { candidates, capabilities, apply, retry } = useIconCandidates()
 */
export function useIconCandidates() {
  const [state, setState] = useState(initialState)
  const [attempt, setAttempt] = useState(0)
  const applying = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    const loadCatalog = async () => {
      const response = await fetch('./icon-candidates/manifest.json', {
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('Icon catalog request failed')
      return manifestSchema.parse(await response.json()).candidates
    }
    // A failed native bridge must not hide successfully loaded comparison artwork.
    void Promise.allSettled([
      loadCatalog(),
      Promise.resolve().then(async () => window.desktop.getCapabilities()),
    ]).then(([catalog, native]) => {
      if (controller.signal.aborted) return
      setState({
        candidates: catalog.status === 'fulfilled' ? catalog.value : [],
        capabilities: native.status === 'fulfilled' ? native.value : null,
        loading: false,
        busy: false,
        status: '',
        error:
          catalog.status === 'rejected'
            ? 'Icon candidates could not be loaded. Retry to load the gallery.'
            : native.status === 'rejected'
              ? 'The native icon service is unavailable. You can still compare candidates.'
              : '',
      })
    })
    return (): void => controller.abort()
  }, [attempt])

  const retry = useCallback(() => {
    if (applying.current) return
    setState(initialState)
    setAttempt((previous) => previous + 1)
  }, [])

  const apply = useCallback(
    async (id: string | null) => {
      // Lock synchronously so rapid activation cannot dispatch competing native writes.
      if (applying.current || !state.capabilities || state.loading) return
      if (
        id !== null &&
        !state.candidates.some((candidate) => candidate.id === id)
      )
        return
      applying.current = true
      setState((previous) => ({
        ...previous,
        busy: true,
        error: '',
        status: '',
      }))
      try {
        await window.desktop.selectIcon(id)
        // A fulfilled native write confirms the preference without a second, fallible read.
        setState((previous) => ({
          ...previous,
          capabilities: previous.capabilities
            ? { ...previous.capabilities, selectedIcon: id }
            : null,
          busy: false,
          status: id
            ? `${id} applied to the ${state.capabilities?.iconTarget}.`
            : 'Default icon restored.',
        }))
      } catch {
        setState((previous) => ({
          ...previous,
          busy: false,
          error: 'The icon could not be changed. Try again.',
        }))
      } finally {
        applying.current = false
      }
    },
    [state.capabilities, state.candidates, state.loading],
  )

  return { ...state, retry, apply }
}
