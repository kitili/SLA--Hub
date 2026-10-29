import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import type { CurrentUser } from "@/lib/contracts";
import { env } from "@/lib/env";

/**
 * The dashboard names teachers and carries observation notes, so it is for
 * Academics admins and anyone tagged `instructional-leader`; other staff and
 * signed-out visitors never get the page or the figures.
 */
export function canViewLeadership(user: Pick<CurrentUser, "isAdmin" | "roles"> | null): boolean {
  if (!user) return false;
  return user.isAdmin || user.roles.includes("instructional-leader");
}

export const MIN_INGEST_KEY_LENGTH = 32;

export type IngestAuth = "ok" | "unconfigured" | "denied";

/** Checks `Authorization: Bearer <key>` against ILD_INGEST_KEY without leaking timing. */
export function checkIngestAuth(header: string | null, key = env.ILD_INGEST_KEY): IngestAuth {
  const secret = key?.trim() ?? "";
  if (secret.length < MIN_INGEST_KEY_LENGTH) return "unconfigured";
  const match = /^Bearer\s+(.+)$/i.exec(header?.trim() ?? "");
  if (!match) return "denied";
  const given = createHash("sha256").update(match[1]!.trim()).digest();
  const wanted = createHash("sha256").update(secret).digest();
  return timingSafeEqual(given, wanted) ? "ok" : "denied";
}
