import { useEffect, useState } from 'react'

import type { DesktopCapabilities } from '@/lib/desktop-contract'

/**
 * Read native credential persistence for login and account settings notices.
 * Browser previews and unavailable native bridges remain unknown instead of implying insecure storage.
 * @example
 * const mode = useCredentialStorageMode()
 */
export function useCredentialStorageMode():
  DesktopCapabilities['credentialStorage'] | null {
  const [mode, setMode] = useState<
    DesktopCapabilities['credentialStorage'] | null
  >(null)
  useEffect(() => {
    let active = true
    void window.desktop
      ?.getCapabilities()
      .then((capabilities) => {
        if (active) setMode(capabilities.credentialStorage)
      })
      .catch(() => {})
    return (): void => {
      active = false
    }
  }, [])
  return mode
}
