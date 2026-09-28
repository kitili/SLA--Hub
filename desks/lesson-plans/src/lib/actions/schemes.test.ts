/**
 * Tests for `createSchemeFromUpload`'s scheme-meta guard, against the
 * in-memory PGlite that test/setup.ts migrates per worker.
 *
 * A scheme persisted with blank grade/subject/term — or a grade with no
 * digits (gradeNum 0) — cannot be batch-generated later: the batch route
 * derives its grade token as `G${gradeNum}` (silently filing plans under
 * "G0"), and a blank subject/term makes `savePlanStructured` reject every
 * plan AFTER a paid model call. The action must reject such uploads with an
 * authored `message` instead of persisting a degenerate scheme. This matters
 * for both upload surfaces: the Studio panel sends no meta overrides at all,
 * and CSV uploads carry no scheme header to derive meta from.
 *
 * `requireAdmin` and `revalidatePath` are mocked as in aiStudio.test.ts; the
 * parse + insert paths are real.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { staff } from "@/lib/db/schema";
import type { CurrentUser } from "@/lib/contracts";
import { createSchemeFromUpload } from "./schemes";

/** Minimal lesson-rows-only CSV — carries NO scheme meta (grade/subject/term). */
const CSV = [
  "Week,Lesson,Specific Competence,Learning Activities",
  "1,1,Count to ten,Practice counting with counters",
].join("\n");

beforeAll(async () => {
  // The inserted scheme row FKs `created_by` → staff, so back the mocked
  // admin with a real row and point the mock at its generated id.
  const [admin] = await db
    .insert(staff)
    .values({ email: "schemes-test@silverleaf.test", fullName: "Schemes Tester" })
    .returning();
  const user: CurrentUser = {
    id: admin!.id,
    email: "schemes-test@silverleaf.test",
    fullName: "Schemes Tester",
    isAdmin: true,
    roles: [],
    campus: null,
    jobTitle: null,
  };
  vi.mocked(requireAdmin).mockResolvedValue(user);
});

describe("createSchemeFromUpload — scheme meta guard", () => {
  it("rejects an upload whose grade/subject/term cannot be derived", async () => {
    const res = await createSchemeFromUpload({
      kind: "csv",
      text: CSV,
      filename: "sow.csv",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("invalid-input");
    // The authored safe detail names every missing field for the admin.
    expect(res.message).toMatch(/grade, subject, term/);
    expect(res.schemeId).toBeUndefined();
  });

  it('rejects a digitless grade that would derive gradeNum 0 (batch grade "G0")', async () => {
    const res = await createSchemeFromUpload({
      kind: "csv",
      text: CSV,
      filename: "sow.csv",
      grade: "Grade Two",
      subject: "Arithmetic",
      term: "1a",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("invalid-input");
    expect(res.message).toMatch(/grade/);
  });

  it("accepts the same upload once explicit meta overrides are supplied", async () => {
    const res = await createSchemeFromUpload({
      kind: "csv",
      text: CSV,
      filename: "sow.csv",
      grade: "Grade 2",
      subject: "Arithmetic",
      term: "1a",
    });
    expect(res.ok).toBe(true);
    expect(res.schemeId).toBeTruthy();
    expect(res.rowCount).toBe(1);
  });
});
