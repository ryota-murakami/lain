import Fuse from 'fuse.js'
import { match } from 'ts-pattern'

import type { Raindrop, SearchScope } from '@/lib/types'

/**
 * Fuzzy threshold for collection name matching.
 * 0 = exact only, 1 = match anything.
 */
export const COLLECTION_FUZZY_THRESHOLD = 0.4

/** Minimum meaningful query length after trim. */
const MIN_QUERY_LENGTH = 1

/** Simple token check for unquoted search operators. */
const SIMPLE_SEARCH_TOKEN_PATTERN = /^[A-Za-z0-9._-]+$/

/** Domain-like text without scheme (example: react.dev). */
const BARE_DOMAIN_PATTERN = /^(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/

/**
 * Text segment for rendering highlighted matches.
 */
export interface HighlightSegment {
  text: string
  matched: boolean
}

/**
 * Fuzzy search result with extracted indices for "name" matches.
 */
export interface FuzzyNameSearchResult<T extends { name: string }> {
  item: T
  score?: number
  indices: [number, number][]
}

/**
 * Normalize a free-text query.
 * @param query - Raw user input
 * @returns Trimmed search query
 */
function normalizeQuery(query: string): string {
  return query.trim()
}

/**
 * Case-insensitive "contains" helper.
 * @param value - Candidate text
 * @param query - Normalized lowercase query
 * @returns True when value contains query
 */
function includesNormalized(value: string | undefined, query: string): boolean {
  return (value ?? '').toLowerCase().includes(query)
}

/**
 * Convert any user-entered text into an operator-safe token.
 * @param value - Search token for operator payload
 * @returns Unquoted simple token or quoted/escaped phrase
 */
function toOperatorToken(value: string): string {
  if (SIMPLE_SEARCH_TOKEN_PATTERN.test(value)) return value
  return `"${value.replaceAll('"', '\\"')}"`
}

/**
 * Attempt to extract a hostname from query text.
 * Works for full URLs and bare domains.
 *
 * @param query - Raw user query
 * @returns Domain without "www." prefix, or empty string
 * @example
 *   extractSearchDomain('https://react.dev/docs') // => 'react.dev'
 *   extractSearchDomain('react.dev')              // => 'react.dev'
 */
export function extractSearchDomain(query: string): string {
  const normalized = normalizeQuery(query)
  if (!normalized) return ''

  try {
    return new URL(normalized).hostname.replace(/^www\./i, '')
  } catch {
    if (!BARE_DOMAIN_PATTERN.test(normalized)) return ''
  }

  try {
    return new URL(`https://${normalized}`).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

/**
 * Build API `search` query string from field scope.
 *
 * @param query - User-entered query text
 * @param scope - Field scope selector
 * @returns API-ready search query
 *
 * @example
 *   buildSearchQuery('react.dev', 'url') // => 'link:react.dev'
 *   buildSearchQuery('React docs', 'title') // => 'React docs'
 */
export function buildSearchQuery(query: string, scope: SearchScope): string {
  const normalized = normalizeQuery(query)
  if (!normalized) return ''

  if (scope === 'url') {
    const domain = extractSearchDomain(normalized)
    const token = domain || normalized
    return `link:${toOperatorToken(token)}`
  }

  return normalized
}

/**
 * Apply client-side field-specific filtering after API response.
 *
 * API can already handle broad search, but field-specific behavior
 * (title/description/url-only) is enforced here for deterministic UX.
 *
 * @param items - Candidate raindrops from API
 * @param query - Raw user query
 * @param scope - Search scope
 * @returns Filtered items matching the requested field scope
 */
export function filterByScope(
  items: Raindrop[],
  query: string,
  scope: SearchScope,
): Raindrop[] {
  const normalized = normalizeQuery(query).toLowerCase()
  if (normalized.length < MIN_QUERY_LENGTH) return items

  return match(scope)
    .with('url', () =>
      items.filter(
        (item) =>
          includesNormalized(item.url, normalized) ||
          includesNormalized(item.domain, normalized),
      ),
    )
    .with('title', () =>
      items.filter((item) => includesNormalized(item.title, normalized)),
    )
    .with('description', () =>
      items.filter(
        (item) =>
          includesNormalized(item.description, normalized) ||
          includesNormalized(item.notes, normalized),
      ),
    )
    .with('all', () => items)
    .exhaustive()
}

/**
 * Build highlight segments for case-insensitive substring matches.
 *
 * @param text - Text to render
 * @param query - Raw query string
 * @returns Ordered segments with `matched` flags
 */
export function buildSubstringHighlightSegments(
  text: string,
  query: string,
): HighlightSegment[] {
  if (!text) return []

  const normalized = normalizeQuery(query).toLowerCase()
  if (normalized.length < MIN_QUERY_LENGTH) {
    return [{ text, matched: false }]
  }

  const lowerText = text.toLowerCase()
  const segments: HighlightSegment[] = []
  let cursor = 0

  while (cursor < text.length) {
    const matchIndex = lowerText.indexOf(normalized, cursor)
    if (matchIndex === -1) {
      segments.push({ text: text.slice(cursor), matched: false })
      break
    }

    if (matchIndex > cursor) {
      segments.push({ text: text.slice(cursor, matchIndex), matched: false })
    }

    const end = matchIndex + normalized.length
    segments.push({ text: text.slice(matchIndex, end), matched: true })
    cursor = end
  }

  return segments.filter((segment) => segment.text.length > 0)
}

/**
 * Build highlight segments from inclusive index ranges.
 * Designed for Fuse.js `includeMatches` payload.
 *
 * @param text - Original text
 * @param indices - Inclusive [start, end] pairs
 * @returns Ordered segments with `matched` flags
 */
export function buildIndexedHighlightSegments(
  text: string,
  indices: Array<[number, number]>,
): HighlightSegment[] {
  if (!text) return []
  if (indices.length === 0) return [{ text, matched: false }]

  const maxIndex = text.length - 1
  const ranges = [...indices]
    .map(
      ([start, end]) =>
        [
          Math.max(0, Math.min(start, maxIndex)),
          Math.max(0, Math.min(end, maxIndex)),
        ] as [number, number],
    )
    .filter(([start, end]) => start <= end)
    .sort(([aStart], [bStart]) => aStart - bStart)

  const merged: [number, number][] = []
  for (const [start, end] of ranges) {
    const previous = merged.at(-1)
    if (!previous) {
      merged.push([start, end])
      continue
    }
    if (start <= previous[1] + 1) {
      previous[1] = Math.max(previous[1], end)
      continue
    }
    merged.push([start, end])
  }

  const segments: HighlightSegment[] = []
  let cursor = 0

  for (const [start, end] of merged) {
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), matched: false })
    }
    segments.push({ text: text.slice(start, end + 1), matched: true })
    cursor = end + 1
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), matched: false })
  }

  return segments.filter((segment) => segment.text.length > 0)
}

/**
 * Fuzzy-search objects by their `name` field.
 * Empty query intentionally returns all items (F5.5 behavior).
 *
 * @param items - Search candidates
 * @param query - User query
 * @returns Ordered fuzzy matches with score and match indices
 */
export function fuzzySearchByName<T extends { name: string }>(
  items: T[],
  query: string,
): FuzzyNameSearchResult<T>[] {
  const normalized = normalizeQuery(query)
  if (normalized.length < MIN_QUERY_LENGTH) {
    return items.map((item) => ({ item, indices: [] }))
  }

  const fuse = new Fuse(items, {
    keys: ['name'],
    threshold: COLLECTION_FUZZY_THRESHOLD,
    includeScore: true,
    includeMatches: true,
    ignoreLocation: true,
  })

  return fuse.search(normalized).map((result) => {
    const nameMatch = result.matches?.find(
      (candidate) => candidate.key === 'name',
    )
    const indices = (nameMatch?.indices ?? []).map(
      ([start, end]) => [start, end] as [number, number],
    )

    return {
      item: result.item,
      score: result.score,
      indices,
    }
  })
}
