import { lainAxios } from '@/lib/axios'
import type { ContentType } from '@/lib/types'

/**
 * Extract domain from URL, stripping www prefix.
 * @param url - Full URL string
 * @returns Clean domain string
 * @example extractDomain("https://www.react.dev/docs") // => "react.dev"
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return ''
  }
}

/**
 * Get favicon URL using Google's favicon service.
 * @example getFaviconUrl("react.dev", 32) // => "https://www.google.com/s2/favicons?domain=react.dev&sz=32"
 */
export function getFaviconUrl(domain: string, size = 32): string {
  if (!domain) return ''
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`
}

/**
 * Resolve the best available icon URL for a bookmark URL.
 * Fallback chain:
 * 1) `/raindrop/suggest?url=...` meta.icon
 * 2) Google favicon service by domain
 * 3) null (caller should render domain initial fallback)
 *
 * @param url - Bookmark URL
 * @returns Best icon URL or null when unavailable
 * @example
 *   await resolveIcon('https://react.dev')
 */
export async function resolveIcon(url: string): Promise<string | null> {
  const domain = extractDomain(url)
  if (!domain) return null

  try {
    const response = await lainAxios.get('/raindrop/suggest', {
      params: { url },
    })
    const suggestedIcon = (
      response.data as { item?: { meta?: { icon?: string } } }
    )?.item?.meta?.icon
    if (typeof suggestedIcon === 'string' && suggestedIcon.length > 0) {
      return suggestedIcon
    }
  } catch {
    // Intentionally ignored; fall back to Google favicon below.
  }

  const googleIcon = getFaviconUrl(domain, 64)
  return googleIcon || null
}

/**
 * Generate a consistent OKLCH color from a domain string via hash.
 * @example getDomainColor("react.dev") // => "oklch(0.65 0.15 142)"
 */
export function getDomainColor(domain: string): string {
  if (!domain) return 'oklch(0.7 0.15 250)'
  let hash = 0
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash)
  }
  return `oklch(0.65 0.15 ${Math.abs(hash % 360)})`
}

/**
 * Get first letter of domain for fallback avatar display.
 * @example getDomainInitial("react.dev") // => "R"
 */
export function getDomainInitial(domain: string): string {
  if (!domain) return '?'
  return domain
    .replace(/^(www\.|m\.)/i, '')
    .charAt(0)
    .toUpperCase()
}

/**
 * Map content type to lucide icon name.
 * @example getTypeIcon("video") // => "Video"
 */
export function getTypeIcon(type: ContentType): string {
  const map: Record<ContentType, string> = {
    link: 'Globe',
    article: 'FileText',
    image: 'Image',
    video: 'Video',
    document: 'FileIcon',
    audio: 'Music',
  }
  return map[type] || 'Globe'
}

/**
 * Extract domain and generate all favicon-related data from a URL.
 * @example getFaviconFromUrl("https://react.dev") // => { domain: "react.dev", faviconUrl: "...", initial: "R", color: "oklch(...)" }
 */
export function getFaviconFromUrl(url: string, size = 32) {
  const domain = extractDomain(url)
  return {
    domain,
    faviconUrl: getFaviconUrl(domain, size),
    initial: getDomainInitial(domain),
    color: getDomainColor(domain),
  }
}
