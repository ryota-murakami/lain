import { useState } from 'react'

import {
  bindingFromKeyboardEvent,
  findConflict,
  isSameBinding,
} from '@/lib/shortcut-utils'
import type { KeyboardEventLike } from '@/lib/shortcut-utils'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
  resetShortcuts,
  swapShortcuts,
  updateShortcut,
} from '@/store/slices/settingsSlice'
import type {
  ShortcutActionId,
  ShortcutBinding,
  ShortcutMap,
} from '@/store/slices/settingsSlice'

/**
 * Editor phases: idle → capturing (waiting for a combo) → conflict (combo owned by another action).
 * `conflictingActionId` is a plain string because persisted maps may hold ids unknown to this build.
 */
export type ShortcutEditorState =
  | { status: 'idle' }
  | { status: 'capturing'; actionId: ShortcutActionId }
  | {
      status: 'conflict'
      actionId: ShortcutActionId
      binding: ShortcutBinding
      conflictingActionId: string
    }

export interface ShortcutEditorApi {
  shortcuts: ShortcutMap
  editorState: ShortcutEditorState
  /** Begin waiting for a key combo for `actionId`. */
  startCapture: (actionId: ShortcutActionId) => void
  /** Leave capturing/conflict without changing anything. */
  cancel: () => void
  /** Feed a keydown from the capture field; saves, flags a conflict, or ignores it. */
  captureKey: (event: KeyboardEventLike) => void
  /** Resolve the pending conflict by exchanging the two bindings. */
  confirmSwap: () => void
  /** Restore every default binding. */
  resetAll: () => void
}

const IDLE: ShortcutEditorState = { status: 'idle' }

/**
 * State machine behind {@link ShortcutEditor}: which action is being edited, whether the
 * captured combo collides with another action, and the store updates for save / swap / reset.
 *
 * @returns Current shortcuts, editor state and the transitions listed on {@link ShortcutEditorApi}
 * @example
 *   const editor = useShortcutEditor()
 *   editor.startCapture('newBookmark')
 *   editor.captureKey(keydownEvent) // ⌘⇧E → saved; ⌘K → editorState.status === 'conflict'
 *   editor.confirmSwap()            // newBookmark ⇄ search
 */
export function useShortcutEditor(): ShortcutEditorApi {
  const dispatch = useAppDispatch()
  const shortcuts = useAppSelector((state) => state.settings.shortcuts)
  const [editorState, setEditorState] = useState<ShortcutEditorState>(IDLE)

  const startCapture = (actionId: ShortcutActionId) => {
    setEditorState({ status: 'capturing', actionId })
  }

  const cancel = () => {
    setEditorState(IDLE)
  }

  const captureKey = (event: KeyboardEventLike) => {
    if (editorState.status !== 'capturing') return
    const binding = bindingFromKeyboardEvent(event)
    // Held modifiers / plain typing: keep waiting
    if (!binding) return

    const { actionId } = editorState
    const currentBinding = shortcuts[actionId]
    // Re-entering the existing combo is a no-op, not a conflict with itself
    if (currentBinding && isSameBinding(binding, currentBinding)) {
      setEditorState(IDLE)
      return
    }

    const conflictingActionId = findConflict(shortcuts, binding, actionId)
    if (conflictingActionId) {
      setEditorState({
        status: 'conflict',
        actionId,
        binding,
        conflictingActionId,
      })
      return
    }

    dispatch(updateShortcut({ actionId, binding }))
    setEditorState(IDLE)
  }

  const confirmSwap = () => {
    if (editorState.status !== 'conflict') return
    dispatch(
      swapShortcuts({
        actionId: editorState.actionId,
        otherActionId: editorState.conflictingActionId,
      }),
    )
    setEditorState(IDLE)
  }

  const resetAll = () => {
    dispatch(resetShortcuts())
    setEditorState(IDLE)
  }

  return {
    shortcuts,
    editorState,
    startCapture,
    cancel,
    captureKey,
    confirmSwap,
    resetAll,
  }
}
