import { NextResponse } from "next/server";

import { securityLog } from "./log";
import { takeToken } from "./rate-limit";

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Returns a 429 response when the IP is over the limit; otherwise null. */
export function enforceIpRateLimit(
  request: Request,
  bucket: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  const ip = clientIp(request);
  if (takeToken(`${bucket}:${ip}`, limit, windowMs)) return null;
  securityLog("rate.limited", { bucket });
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: { "Retry-After": "60" },
    },
  );
}

/** Never leak Error.message to anonymous/public callers in production. */
export function publicErrorMessage(err: unknown, fallback: string): string {
  if (process.env.NODE_ENV !== "production" && err instanceof Error) {
    return err.message || fallback;
  }
  return fallback;
}
