export interface DesktopCapabilities {
  platform: string
  credentialStorage: 'encrypted' | 'session'
  selectedIcon: string | null
  iconTarget: 'Dock' | 'window'
}

/** Narrow native operations exposed by Electron preload; arbitrary filesystem paths are never accepted. */
export interface DesktopApi {
  getCapabilities: () => Promise<DesktopCapabilities>
  saveExport: (data: {
    format: 'html' | 'csv' | 'json'
    content: string
  }) => Promise<{ canceled: boolean; filename?: string }>
  selectIcon: (id: string | null) => Promise<void>
}
