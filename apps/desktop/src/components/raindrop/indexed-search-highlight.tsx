import React from 'react'

import { buildIndexedHighlightSegments } from '@/lib/search'

/**
 * Render fuzzy-match character ranges consistently in both collection search surfaces.
 * The existing segment builder handles inclusive Fuse indices and escapes text through JSX.
 * @example <IndexedSearchHighlight text="Reading" indices={[[0, 3]]} />
 */
export const IndexedSearchHighlight = React.memo(
  function IndexedSearchHighlight({
    text,
    indices,
  }: {
    text: string
    indices: [number, number][]
  }) {
    return buildIndexedHighlightSegments(text, indices).map((segment, index) =>
      segment.matched ? (
        <strong
          key={`${segment.text}-${index}`}
          className="text-primary font-semibold"
        >
          {segment.text}
        </strong>
      ) : (
        <React.Fragment key={`${segment.text}-${index}`}>
          {segment.text}
        </React.Fragment>
      ),
    )
  },
)
