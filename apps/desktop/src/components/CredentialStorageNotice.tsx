import React from 'react'

import { useCredentialStorageMode } from '@/hooks/useCredentialStorageMode'

/**
 * Explain session-only sign-in when the desktop cannot encrypt credentials.
 * Login and account settings mount this notice so Linux users know whether a restart requires sign-in.
 * @example
 * <CredentialStorageNotice />
 */
export const CredentialStorageNotice = React.memo(
  function CredentialStorageNotice() {
    const mode = useCredentialStorageMode()
    // Only a confirmed session fallback displays the notice.
    if (mode !== 'session') return null
    return (
      <p
        role="status"
        className="text-muted-foreground rounded-md border p-3 text-xs"
      >
        Secure credential storage is unavailable on this system. Your sign-in
        lasts for this session only. Enable a system keyring to stay signed in
        after restarting Lain.
      </p>
    )
  },
)
