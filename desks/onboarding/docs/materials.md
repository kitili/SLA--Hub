# Materials & file storage

Uploaded files (onboarding documents, videos) are split into two concerns:

- **Bytes** live in a pluggable storage backend — `src/lib/storage/`.
- **Metadata** (filename, content type, size, owner item, URL, uploader) lives
  in the `materials` table — `src/lib/db/schema/materials.ts`, accessed via
  `materialsRepo` (`src/lib/db/repositories/materials.ts`).

## The storage contract

```ts
interface MaterialStorage {
  upload(file: UploadInput): Promise<{ key: string; url: string }>;
  getUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}
```

`UploadInput` is `{ filename, contentType, data }` where `data` is a
`Buffer | Uint8Array` — deliberately runtime-portable (no web `File`
dependency), so it works from Server Actions and route handlers alike.

`upload` returns a `key` (opaque handle) and a `url` (how the app fetches the
file). Persist **both** on the `materials` row.

## Backend selection

`getStorage()` (`src/lib/storage/index.ts`) caches and returns the adapter the
environment dictates:

| Condition                       | Adapter             |
| ------------------------------- | ------------------- |
| `BLOB_READ_WRITE_TOKEN` is set  | `VercelBlobStorage` |
| otherwise                       | `LocalFileStorage`  |

```ts
import { getStorage } from "@/lib/storage";
import { materialsRepo } from "@/lib/db/repositories";

const storage = getStorage();
const { key, url } = await storage.upload({ filename, contentType, data });
await materialsRepo.createMaterial({
  filename, contentType, size: data.byteLength,
  storageKey: key, url, ownerItemId, language: "en", uploadedBy,
});
```

## Local filesystem adapter (default in dev)

`LocalFileStorage` writes bytes under a **gitignored `.storage/`** directory and
serves them by key.

- **Keys** are collision-resistant and filesystem-safe
  (`<timestamp>-<uuid>-<sanitized-name>`). They contain no path separators or
  `..`; `resolveLocalPath(key)` hardens against traversal and throws on anything
  that would escape the storage root.
- **Serving.** `getUrl(key)` returns an app-routable path,
  `"/api/materials/<key>"` (`LOCAL_SERVE_BASE_PATH`). The **key → path mapping**
  is simply the key as a filename under `.storage/`. A route handler (owned by
  the app layer, not this task) can stream the file by calling
  `resolveLocalPath(key)` and piping it with the stored `contentType`. The
  exported `LocalFileStorage#exists(key)` helps such a handler 404 cleanly.

This adapter is fully functional and is what the verification smoke test
exercised (upload → URL → metadata row → delete).

## Vercel Blob adapter (production) — SKELETON, not wired up

`VercelBlobStorage` is a **skeleton** and is intentionally incomplete:

- Constructing it **throws "not configured"** unless `BLOB_READ_WRITE_TOKEN` is
  present.
- Even with a token, its methods **throw "not implemented"** so the gap is loud
  rather than silently dropping uploads.

### Completing it (future task)

1. **Add the dependency** (NOT installed by this task):

   ```bash
   npm install @vercel/blob
   ```

2. **Provision Blob** on Vercel (dashboard → Storage → Blob). Vercel then
   auto-injects `BLOB_READ_WRITE_TOKEN` into preview/production. For local
   testing you can set it in `.env.local`.

3. **Implement the methods** in `src/lib/storage/vercel-blob.ts` using the SDK
   (the file already contains the reference shape in a comment):

   ```ts
   import { put, del } from "@vercel/blob";

   // upload
   const { url } = await put(file.filename, file.data, {
     access: "public",
     contentType: file.contentType,
     token: this.token,
   });
   return { key: url, url };   // Blob uses the public URL as the object identity

   // delete
   await del(key, { token: this.token });
   ```

   With Blob, the `key` and `url` are the same public URL, so `getUrl(key)`
   simply returns `key`. No app serving route is needed (unlike the local
   adapter) because Blob URLs are directly fetchable.

4. No factory change is required — `getStorage()` already routes to
   `VercelBlobStorage` whenever the token is present.

> Until step 1–3 are done, deploying with a Blob token set will fail fast on the
> first upload. If a deploy needs working uploads before Blob is implemented,
> leave `BLOB_READ_WRITE_TOKEN` unset to fall back to the local adapter (note:
> the local adapter's `.storage/` is **not** durable on serverless — it is for
> dev only).
