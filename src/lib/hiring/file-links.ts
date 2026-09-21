/** HR-facing link for a stored culture video or performance file. */
export function hiringFileHref(storedUrl: string): string {
  if (
    storedUrl.includes("blob.vercel-storage.com") ||
    (storedUrl.startsWith("https://") &&
      !storedUrl.includes("/api/hiring/files/"))
  ) {
    return `/api/hiring/download?url=${encodeURIComponent(storedUrl)}`;
  }
  return storedUrl;
}
