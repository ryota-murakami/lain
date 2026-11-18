# Uploaded-file download route: primary-source research

Checked 2026-11-10. Research used only Raindrop's public documentation and public repositories. No Raindrop account requests, credentials, or downloaded user files were accessed in this investigation.

## Finding

The official web application's single-file Download action constructs:

```text
GET https://api.raindrop.io/v1/raindrop/{id}/file?download
```

The query is the bare `download` flag. The source constructs this route from the bookmark ID instead of reusing the bookmark's `link` and its `type` query.

Evidence at public app commit `fa5085be51b885a1215f41110fd86ce51af8d65c`:

- [Bookmark context menu](https://github.com/raindropio/app/blob/fa5085be51b885a1215f41110fd86ce51af8d65c/src/co/bookmarks/item/contextmenu.js): the ordinary open action uses `link`; a separate `fileType` branch renders Download with `${API_ENDPOINT_URL}raindrop/${_id}/file?download`.
- [API endpoint constant](https://github.com/raindropio/app/blob/fa5085be51b885a1215f41110fd86ce51af8d65c/src/data/constants/app.js): the production prefix is `https://api.raindrop.io/v1/`.
- [Official Files help](https://help.raindrop.io/files#downloading-files): single-file download is the context-menu Download action; multiple-file download uses Export → ZIP. The same help page describes reading TXT and Markdown uploads inside the built-in reader.

This supports trying the exact Download action route for byte verification. It does not establish that the previously observed HTTP-200 response was a viewer: its content type, redirects, and body still need inspection by the QA owner. Comparing only status or the bookmark preview URL is insufficient evidence of byte preservation.

## Other official paths and limitations

The [web export implementation](https://github.com/raindropio/app/blob/fa5085be51b885a1215f41110fd86ce51af8d65c/src/co/bookmarks/export/popover.js) uses `/v1/raindrops/{collectionId}/export.zip` with the active query and optional selected IDs. This is a batch-file export path, not necessary for the single synthetic upload check.

The public Cupertino repository redirects to `raindropio/ios`. Its [ShareRaindropLink](https://github.com/raindropio/ios/blob/main/Features/Raindrop/ShareRaindrop.swift) passes the file bookmark's `link` into [ShareRemoteFile](https://github.com/raindropio/ios/blob/main/UI/Share/ShareRemoteFile.swift), which calls `URLSession.shared.download(from:)`. That path alone does not document a special query or prove that every current `link` response is the original payload.

The [public REST single-raindrop documentation](https://developer.raindrop.io/v1/raindrops/single) documents the multipart upload endpoint and an example uploaded-item link, but does not specify the single-file GET Download route. Therefore the route above is grounded in the official app's public implementation, not a promised public REST contract. The reviewed Download menu code does not establish OAuth Bearer support for `/v1/`, nor was a `/rest/v1/` equivalent tested in this investigation.

The remaining QA step is a read-only download by the already authorized QA owner, followed by comparison with the original file's exact bytes/hash. This memo does not claim that byte comparison passed.
