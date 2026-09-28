import "server-only";

/**
 * ed-admin staff directory client + sign-in verifier.
 *
 * Staff sign in with their work email + ed-admin Staff ID. Both are checked
 * against the live ed-admin directory (a single endpoint that returns the whole
 * staff list as XML — there is no server-side filter). We:
 *   1. fetch the directory (Bearer token), caching it briefly in-memory so a
 *      burst of login attempts doesn't re-pull ~227 KB each time;
 *   2. parse only the fields we need out of each <staff> record;
 *   3. match email + ID on the *same* record, and require the record to be
 *      active (StatusName "Current", not Disabled).
 *
 * This is the sole sign-in gate (see `signInMemberAction`): everyone, admins
 * included, must pass it. Admin privilege is layered on top via HR_ADMIN_EMAILS
 * but does not exempt anyone from the directory check.
 */

import { env } from "@/lib/env";
import { normalizeStaffEmail } from "@/lib/email";

const DEFAULT_STAFF_API_URL =
  "https://silverleafacademy.ed-space.net/api/general/v1/staff";

/** How long a fetched directory snapshot is reused before refetching. */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Network timeout for the directory fetch (keeps logins from hanging). */
const FETCH_TIMEOUT_MS = 10_000;

/** A single staff record, reduced to the fields sign-in cares about. */
export interface EdAdminStaff {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  statusName: string;
  disabled: boolean;
}

export type EdAdminVerification =
  | { ok: true; fullName: string; staffId: string; jobTitle: string }
  | { ok: false; reason: "not-found" | "inactive" | "api-error" };

let cache: { at: number; staff: EdAdminStaff[] } | null = null;

function getStaffApiUrl(): string {
  return env.ED_ADMIN_STAFF_API_URL ?? DEFAULT_STAFF_API_URL;
}

/** Decode the handful of XML entities that may appear in names. */
function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

/** Extract the (trimmed, entity-decoded) text of `<tag>…</tag>` from a block. */
function extractTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!match || match[1] === undefined) return "";
  return decodeEntities(match[1].trim());
}

/**
 * Parse the directory XML into staff records. The schema is flat
 * (`<staff><ID>…</ID><Email>…</Email>…</staff>`), so we slice on the closing
 * `</staff>` tag and pull the fields we need per block.
 */
export function parseStaffXml(xml: string): EdAdminStaff[] {
  const staff: EdAdminStaff[] = [];
  for (const segment of xml.split("</staff>")) {
    const start = segment.indexOf("<staff>");
    if (start === -1) continue;
    const block = segment.slice(start + "<staff>".length);
    const id = extractTag(block, "ID");
    const email = extractTag(block, "Email");
    if (!id && !email) continue;
    staff.push({
      id,
      email,
      firstName: extractTag(block, "FirstName"),
      lastName: extractTag(block, "LastName"),
      position: extractTag(block, "Position"),
      statusName: extractTag(block, "StatusName"),
      disabled: extractTag(block, "Disabled").trim() === "1",
    });
  }
  return staff;
}

/** True when a record represents a current, enabled staff member. */
function isActive(record: EdAdminStaff): boolean {
  return record.statusName.trim().toLowerCase() === "current" && !record.disabled;
}

/**
 * Fetch the staff directory, using the in-memory snapshot when still fresh.
 * Throws when the token is missing or the API is unreachable / errors.
 */
export async function fetchStaffDirectory(): Promise<EdAdminStaff[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.staff;
  }

  const token = env.ED_ADMIN_API_TOKEN;
  if (!token) {
    throw new Error("ED_ADMIN_API_TOKEN is not set; staff sign-in cannot verify accounts.");
  }

  const res = await fetch(getStaffApiUrl(), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    // We manage our own TTL cache above; don't let the platform cache the body.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`ed-admin staff API responded ${res.status}`);
  }

  const staff = parseStaffXml(await res.text());
  cache = { at: Date.now(), staff };
  return staff;
}

/**
 * Verify a sign-in attempt against the ed-admin directory.
 *
 * Matches `email` (case-insensitive) AND `staffId` on the same record. A single
 * generic `not-found` covers both "no such email" and "ID doesn't match" so we
 * don't leak which staff emails exist. A matched-but-inactive record returns
 * `inactive`; any fetch/parse failure returns `api-error`.
 */
export async function verifyEdAdminStaff(
  email: string,
  staffId: string,
): Promise<EdAdminVerification> {
  const wantEmail = normalizeStaffEmail(email);
  const wantId = staffId.trim();

  let directory: EdAdminStaff[];
  try {
    directory = await fetchStaffDirectory();
  } catch {
    return { ok: false, reason: "api-error" };
  }

  const matches = directory.filter(
    (s) => normalizeStaffEmail(s.email) === wantEmail && s.id.trim() === wantId,
  );
  if (matches.length === 0) {
    return { ok: false, reason: "not-found" };
  }

  const active = matches.find(isActive);
  if (!active) {
    return { ok: false, reason: "inactive" };
  }

  const fullName = `${active.firstName} ${active.lastName}`.trim();
  return { ok: true, fullName, staffId: active.id, jobTitle: active.position };
}

/**
 * Verify an admin sign-in by email only (after app-level admin password check).
 */
export async function verifyEdAdminStaffByEmail(
  email: string,
): Promise<EdAdminVerification> {
  const wantEmail = normalizeStaffEmail(email);

  let directory: EdAdminStaff[];
  try {
    directory = await fetchStaffDirectory();
  } catch {
    return { ok: false, reason: "api-error" };
  }

  const matches = directory.filter(
    (s) => normalizeStaffEmail(s.email) === wantEmail,
  );
  if (matches.length === 0) {
    return { ok: false, reason: "not-found" };
  }

  const active = matches.find(isActive);
  if (!active) {
    return { ok: false, reason: "inactive" };
  }

  const fullName = `${active.firstName} ${active.lastName}`.trim();
  return { ok: true, fullName, staffId: active.id, jobTitle: active.position };
}

/** Test-only: clear the cached directory snapshot. */
export function __clearEdAdminCache(): void {
  cache = null;
}
