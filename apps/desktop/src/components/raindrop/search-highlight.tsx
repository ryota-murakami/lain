import React from 'react'

import { buildSubstringHighlightSegments } from '@/lib/search'

/**
 * Highlight literal query matches consistently across bookmark views and search results.
 * Called by result text renderers after their field-scope check; text remains escaped JSX.
 *
 * @param text - Original text, including its casing and punctuation.
 * @param query - Query to match without interpreting regular-expression syntax.
 * @example
 * <SearchHighlight text="React documentation" query="react" />
 */
export const SearchHighlight = React.memo(function SearchHighlight({
  text,
  query,
  enabled = true,
}: {
  enabled?: boolean
  text: string
  query: string
}) {
  if (!enabled) return text
  return buildSubstringHighlightSegments(text, query).map((segment, index) =>
    segment.matched ? (
      <mark
        key={`${segment.text}-${index}`}
        className="bg-primary/20 text-foreground rounded-sm px-0.5"
      >
        {segment.text}
      </mark>
    ) : (
      <React.Fragment key={`${segment.text}-${index}`}>
        {segment.text}
      </React.Fragment>
    ),
  )
})
