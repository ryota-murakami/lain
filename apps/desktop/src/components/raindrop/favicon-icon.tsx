import { Globe, FileText, Image, Video, File, Music } from 'lucide-react'
import React, { useState, useMemo } from 'react'

import type { ContentType } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  extractDomain,
  getFaviconUrl,
  getDomainColor,
  getDomainInitial,
} from '@/utils/favicon'

/**
 * Props for the FaviconIcon component.
 */
interface FaviconIconProps {
  /** Full URL to extract favicon from */
  url: string
  /** Content type for fallback icon selection */
  type?: ContentType
  /** Icon size in pixels */
  size?: number
  /** Additional CSS classes */
  className?: string
  /** Optional selector for tests */
  'data-testid'?: string
}

/**
 * Static map of content type to its corresponding lucide icon component.
 */
const TYPE_ICON_MAP: Record<ContentType, typeof Globe> = {
  link: Globe,
  article: FileText,
  image: Image,
  video: Video,
  document: File,
  audio: Music,
}

/**
 * Favicon display with multi-level fallback chain:
 * 1. Fetched favicon from Google's service
 * 2. Domain initial in a colored circle
 * 3. Content type icon
 *
 * @param url - Full URL to extract domain and fetch favicon
 * @param type - Content type for last-resort fallback icon
 * @param size - Pixel size of the icon (default 32)
 * @param className - Additional CSS classes
 *
 * @example
 *   <FaviconIcon url="https://react.dev" type="article" size={20} />
 */
const FaviconIcon = React.memo(function FaviconIcon({
  url,
  type = 'link',
  size = 32,
  className,
  'data-testid': dataTestId,
}: FaviconIconProps) {
  const [imgError, setImgError] = useState(false)
  const domain = extractDomain(url)
  const faviconUrl = getFaviconUrl(domain, size)
  const initial = getDomainInitial(domain)
  const color = getDomainColor(domain)
  const TypeIcon = useMemo(() => TYPE_ICON_MAP[type] || Globe, [type])
  const typeIconStyle = useMemo(
    () => ({ width: size * 0.6, height: size * 0.6 }),
    [size],
  )

  if (domain && !imgError) {
    return (
      <img
        data-testid={dataTestId}
        src={faviconUrl}
        alt={`${domain} favicon`}
        width={size}
        height={size}
        className={cn('flex-shrink-0 rounded-sm object-cover', className)}
        onError={() => setImgError(true)}
        loading="lazy"
      />
    )
  }

  if (domain) {
    return (
      <div
        data-testid={dataTestId}
        className={cn(
          'flex flex-shrink-0 items-center justify-center rounded-sm',
          className,
        )}
        style={{
          width: size,
          height: size,
          backgroundColor: color,
        }}
      >
        <span
          className="font-semibold text-white"
          style={{ fontSize: size * 0.5 }}
        >
          {initial}
        </span>
      </div>
    )
  }

  return (
    <div
      data-testid={dataTestId}
      className={cn(
        'bg-muted flex flex-shrink-0 items-center justify-center rounded-sm',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <TypeIcon className="text-muted-foreground" style={typeIconStyle} />
    </div>
  )
})
export { FaviconIcon }
export default FaviconIcon
