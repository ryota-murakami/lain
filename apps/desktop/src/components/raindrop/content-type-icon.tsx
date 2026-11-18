import { Globe, FileText, Image, Video, File, Music } from 'lucide-react'
import React from 'react'

import type { ContentType } from '@/lib/types'
import { getTypeIcon } from '@/utils/favicon'

const ICONS: Record<string, typeof Globe> = {
  Globe,
  FileText,
  Image,
  Video,
  FileIcon: File,
  Music,
}

/**
 * Render the content-type icon shared by list, table, and command-palette results.
 * Uses the existing favicon type mapping so every bookmark view uses the same symbols.
 *
 * @example
 * <ContentTypeIcon type="article" className="h-3 w-3" />
 */
export const ContentTypeIcon = React.memo(function ContentTypeIcon({
  type,
  className,
}: {
  type: ContentType
  className?: string
}) {
  const Icon = ICONS[getTypeIcon(type)] ?? Globe
  return <Icon className={className} />
})
