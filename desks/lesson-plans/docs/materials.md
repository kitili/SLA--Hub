# File storage

Uploaded file **bytes** (today: textbook PDFs and their per-page PNGs for the
OCR ingest) live behind a pluggable storage adapter — `src/lib/storage/`.
There is **no** file-metadata table: consumers persist the returned `key` on
their own rows (e.g. `textbooks.file_key`) and read bytes back with
`read(key)`.

## The storage contract

```ts
interface MaterialStorage {
  upload(file: UploadInput): Promise<{ key: string; url: string }>;
  getUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
  read(key: string): Promise<Buffer | null>;
}
```

`UploadInput` is `{ filename, contentType, data }` where `data` is a
`Buffer | Uint8Array` — deliberately runtime-portable (no web `File`
dependency), so it works from Server Actions and route handlers alike.

**What is actually used:** the current consumers
(`src/app/api/ai/textbooks/route.ts`, `src/lib/ai/workflows/textbookIngest.ts`,
`src/lib/actions/textbooks.ts`) call only `upload().key`, `read(key)`, and
`delete(key)`. The `url` field and `getUrl()` are unused surface kept for a
future user-facing download feature — note that the local adapter's URLs
(`/api/materials/<key>`) have **no route handler** yet, so do not hand them to
a browser until one exists (`resolveLocalPath` already provides the traversal
guard such a route would need).

## Backend selection

`getStorage()` (`src/lib/storage/index.ts`) caches and returns the adapter the
environment dictates:

| Condition                       | Adapter             |
| ------------------------------- | ------------------- |
| `BLOB_READ_WRITE_TOKEN` is set  | `VercelBlobStorage` |
| otherwise                       | `LocalFileStorage`  |

## Local filesystem adapter (default in dev)

`LocalFileStorage` writes bytes under a **gitignored `.storage/`** directory.

- **Keys** are collision-resistant and filesystem-safe
  (`<timestamp>-<uuid>-<sanitized-name>`). They contain no path separators or
  `..`; `resolveLocalPath(key)` hardens against traversal and throws on
  anything that would escape the storage root.
- `.storage/` is **not durable on serverless** — the local adapter is for dev
  only.

## Vercel Blob adapter (production)

`VercelBlobStorage` (`src/lib/storage/vercel-blob.ts`) is fully implemented on
`@vercel/blob`:

- Constructing it throws unless `env.BLOB_READ_WRITE_TOKEN` is set —
  `getStorage()` only routes to it when the token is present, so this is a
  misconfiguration guard, not a runtime hazard.
- Blob uses the public URL as the object identity, so `key === url` and
  `getUrl(key)` returns the key unchanged; `read(key)` fetches the URL.

Provision Blob from the Vercel dashboard (Project → Storage → Blob); Vercel
auto-injects `BLOB_READ_WRITE_TOKEN`. See DEPLOYMENT.md.
