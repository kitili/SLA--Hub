/**
 * In-memory sliding-window limiter. Per-instance only — enough to blunt abuse
 * on a single serverless isolate.
 */

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

/** True when the request is allowed; false when the window is exhausted. */
export function takeToken(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): boolean {
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
  if (bucket.timestamps.length >= limit) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return true;
}
