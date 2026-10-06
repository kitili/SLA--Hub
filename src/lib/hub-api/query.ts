export function readLimit(search: URLSearchParams, fallback = 200, max = 500) {
  const raw = Number.parseInt(search.get("limit") ?? "", 10);
  if (!Number.isFinite(raw) || raw < 1) return fallback;
  return Math.min(raw, max);
}

export function readOffset(search: URLSearchParams) {
  const raw = Number.parseInt(search.get("offset") ?? "", 10);
  if (!Number.isFinite(raw) || raw < 0) return 0;
  return raw;
}

export function readSince(search: URLSearchParams) {
  const raw = search.get("since")?.trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}
