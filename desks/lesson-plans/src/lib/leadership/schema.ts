import { z } from "zod";

/**
 * Payload the Instructional Leadership Dashboard works from. It is exactly what
 * `buildPayload` in integrations/instructional-leadership/Code.gs produces from
 * the two Google trackers; the Apps Script pushes it to /api/leadership/ingest.
 *
 * Every string is length-capped and every list is size-capped, so a bad push
 * cannot fill the database. Unknown keys (buildMs, fromCache, …) are dropped.
 */

const short = z.string().max(200);
const long = z.string().max(5000);
/** '' or yyyy-mm-dd, the only date shapes the dashboard reads. */
const isoDate = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Dates must be yyyy-mm-dd or empty.");

/** Links in the footer come from stored data, so only Google sheet/file links are kept. */
const sourceUrl = z
  .string()
  .max(500)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && ["docs.google.com", "drive.google.com"].includes(url.hostname);
    } catch {
      return false;
    }
  }, "Source links must be https Google Docs or Drive links.");

export const walkthroughSchema = z.object({
  date: isoDate,
  term: short,
  campus: short,
  facilitator: short,
  roles: long,
  present: long,
  ampm: short,
  pd: short,
  assign: short,
  target: isoDate,
  glows: long,
  grows: long,
  notes: long,
});

export const observationSchema = z.object({
  campus: short,
  date: isoDate,
  teacher: short,
  grade: short,
  observer: short,
  type: short,
  subject: short,
  track: short,
  step: short,
});

export const leadershipPayloadSchema = z.object({
  campuses: z.array(short).max(20),
  terms: z
    .array(z.object({ name: short, label: short, start: isoDate, end: isoDate }))
    .max(20),
  pdLists: z.object({
    management: z.array(short).max(100),
    rigor: z.array(short).max(100),
  }),
  walkthroughs: z.array(walkthroughSchema).max(20_000),
  walkOffline: z
    .array(z.object({ campus: short, term: short, count: z.number().int().min(0).max(100_000) }))
    .max(200),
  observations: z.array(observationSchema).max(50_000),
  obsRules: z.object({
    range: z.object({ start: isoDate, end: isoDate }),
    allowancePerTeacher: z.number().min(0).max(50),
    teachers: z.record(short, z.number().int().min(0).max(10_000)),
    roster: z.record(short, z.array(short).max(2000)),
  }),
  generatedAt: z.string().max(40).refine((value) => !Number.isNaN(Date.parse(value)), "generatedAt must be a date."),
  sources: z
    .array(z.object({ key: short, name: short, url: sourceUrl, updated: z.string().max(40) }))
    .max(5),
});

export type LeadershipPayload = z.infer<typeof leadershipPayloadSchema>;

/** Largest body /api/leadership/ingest reads. Vercel's own limit is 4.5 MB. */
export const MAX_INGEST_BYTES = 4_000_000;

export function parseLeadershipPayload(body: unknown):
  | { ok: true; data: LeadershipPayload }
  | { ok: false; issues: string[] } {
  const result = leadershipPayloadSchema.safeParse(body);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    issues: result.error.issues.slice(0, 8).map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`),
  };
}
