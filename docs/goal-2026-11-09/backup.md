# Pre-QA backup verification

Verified 2026-11-09 using existing authorized Raindrop OAuth credentials; account name normalized to RyotaMurakami. No credential or bookmark content is stored in this repository.

Private destination: `/Users/ryotamurakami/laststance/backup/lain/raindrop-20261109T123750Z/`.

- Official service-generated HTML and CSV: 4,917 entries each.
- API JSON: 4,917 unique active bookmarks, 182 unique trash bookmarks, 407 unique collections, 37 groups, tags/user metadata.
- All 99 active pages and 4 trash pages fetched; terminating partial pages observed.
- Official HTML/CSV counts and URL multisets match the API snapshot exactly.
- Initial/final counts and changedBookmarksDate match; all collection references resolve.
- Two collection endpoints overlap on 123 identical records; union deduplicated with equality verified.
- 116 files parsed/nonempty and SHA-256 recorded; independent readback validated all checksums. Directory 0700 and files 0600.
- Official backup download redirected to Brotli-encoded export data; original service content decoded locally before parsing.

Limitations: uploaded binaries and cached permanent web copies were not downloaded. API-returned highlight fields are included, but separate highlight endpoint completeness has not been audited. No restore/import was executed; IDs, ownership, dates and all settings cannot be promised restorable. The sequential API snapshot is not an atomic service transaction.

Official references: [Backups](https://developer.raindrop.io/v1/backups), [Multiple raindrops](https://developer.raindrop.io/v1/raindrops/multiple).

Account write QA is authorized after this verified snapshot. Root exclusively owns write QA/cleanup; use isolated prefixed objects and record only their IDs privately. Never empty the account trash.
