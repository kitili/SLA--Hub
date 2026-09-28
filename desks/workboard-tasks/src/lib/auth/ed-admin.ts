import { normalizeStaffEmail } from "@/lib/email";

const DEFAULT_STAFF_API_URL = "https://silverleafacademy.ed-space.net/api/general/v1/staff";
const CACHE_TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;
const NEGATIVE_CACHE_MS = 15_000;

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
let inFlight: Promise<EdAdminStaff[]> | null = null;
let negativeUntil = 0;

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

function extractTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!match || match[1] === undefined) return "";
  return decodeEntities(match[1].trim());
}

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

function isActive(record: EdAdminStaff): boolean {
  return record.statusName.trim().toLowerCase() === "current" && !record.disabled;
}

export async function fetchStaffDirectory(): Promise<EdAdminStaff[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.staff;
  }
  if (Date.now() < negativeUntil) {
    throw new Error("ed-admin staff API recently failed; backing off.");
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const token = process.env.ED_ADMIN_API_TOKEN?.trim();
    if (!token) {
      throw new Error("ED_ADMIN_API_TOKEN is not set; staff sign-in cannot verify accounts.");
    }
    const url = process.env.ED_ADMIN_STAFF_API_URL?.trim() || DEFAULT_STAFF_API_URL;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[ed-admin] staff directory fetch failed: HTTP ${res.status}`);
      throw new Error(`ed-admin staff API responded ${res.status}`);
    }
    const staff = parseStaffXml(await res.text());
    cache = { at: Date.now(), staff };
    return staff;
  })();

  try {
    return await inFlight;
  } catch (err) {
    negativeUntil = Date.now() + NEGATIVE_CACHE_MS;
    if (err instanceof Error && !err.message.includes("responded")) {
      console.error("[ed-admin] staff directory fetch error:", err.message);
    }
    throw err;
  } finally {
    inFlight = null;
  }
}

export async function verifyEdAdminStaff(email: string, staffId: string): Promise<EdAdminVerification> {
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
  if (matches.length === 0) return { ok: false, reason: "not-found" };

  const active = matches.find(isActive);
  if (!active) return { ok: false, reason: "inactive" };

  return {
    ok: true,
    fullName: `${active.firstName} ${active.lastName}`.trim(),
    staffId: active.id,
    jobTitle: active.position,
  };
}

export async function verifyEdAdminStaffByEmail(email: string): Promise<EdAdminVerification> {
  const wantEmail = normalizeStaffEmail(email);

  let directory: EdAdminStaff[];
  try {
    directory = await fetchStaffDirectory();
  } catch {
    return { ok: false, reason: "api-error" };
  }

  const matches = directory.filter((s) => normalizeStaffEmail(s.email) === wantEmail);
  if (matches.length === 0) return { ok: false, reason: "not-found" };

  const active = matches.find(isActive);
  if (!active) return { ok: false, reason: "inactive" };

  return {
    ok: true,
    fullName: `${active.firstName} ${active.lastName}`.trim(),
    staffId: active.id,
    jobTitle: active.position,
  };
}
