import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { hiringCandidates } from "@/lib/db/schema";
import { requireAdminApi } from "@/lib/hiring/require-admin-api";
import {
  searchByPosition,
  searchByEmail,
  listRoles,
  type SheetCandidate,
} from "@/lib/hiring/google-sheets";
import { applicationCheck } from "@/lib/hiring/types";

/** GET /api/admin/hiring/sheet-import?position=xxx  or  ?email=xxx */
export async function GET(request: Request) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const position = searchParams.get("position")?.trim();
  const email = searchParams.get("email")?.trim();
  const rolesOnly = searchParams.get("roles") === "true";

  // Return unique role list without a candidate search
  if (rolesOnly) {
    const roles = await listRoles();
    return NextResponse.json({ roles });
  }

  if (!position && !email) {
    return NextResponse.json({ error: "Provide position or email query param" }, { status: 400 });
  }

  let candidates: SheetCandidate[];
  if (email) {
    const found = await searchByEmail(email);
    candidates = found ? [found] : [];
  } else {
    candidates = await searchByPosition(position!);
  }

  if (candidates.length === 0) {
    return NextResponse.json({ candidates: [] });
  }

  // Check which emails are already in the system
  const emails = candidates.map((c) => c.email).filter(Boolean);
  const existing = await db
    .select({ email: hiringCandidates.email })
    .from(hiringCandidates)
    .where(inArray(hiringCandidates.email, emails));
  const existingEmails = new Set(existing.map((r) => r.email.toLowerCase()));

  const result = candidates.map((c) => ({
    ...c,
    alreadyImported: existingEmails.has(c.email.toLowerCase()),
  }));

  return NextResponse.json({ candidates: result });
}

/** POST /api/admin/hiring/sheet-import  body: { rowIndices: number[] } */
export async function POST(request: Request) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const candidates: SheetCandidate[] = body?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return NextResponse.json({ error: "candidates array required" }, { status: 400 });
  }

  // Check which emails already exist
  const emails = candidates.map((c) => c.email).filter(Boolean);
  const existing = await db
    .select({ email: hiringCandidates.email })
    .from(hiringCandidates)
    .where(inArray(hiringCandidates.email, emails));
  const existingEmails = new Set(existing.map((r) => r.email.toLowerCase()));

  const toInsert = candidates.filter(
    (c) => c.email && c.fullName && !existingEmails.has(c.email.toLowerCase()),
  );

  if (toInsert.length === 0) {
    return NextResponse.json({ imported: 0, skipped: candidates.length, ids: [] });
  }

  const rows = toInsert.map((c) => {
    const notes = [
      c.hearAboutUs && `How they heard: ${c.hearAboutUs}`,
      c.location && `Location: ${c.location}`,
      c.employed === "Yes" && c.currentRole && `Current role: ${c.currentRole}`,
      c.employed === "Yes" && c.employer && `Employer: ${c.employer}`,
      c.yearsExperience && `Years experience: ${c.yearsExperience}`,
      c.noticePeriod && `Notice period: ${c.noticePeriod}`,
      c.expectedSalary && `Expected salary: ${c.expectedSalary}`,
      c.relevantExperience && `Relevant experience:\n${c.relevantExperience}`,
      c.whySilverleaf && `Why Silverleaf:\n${c.whySilverleaf}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      fullName: c.fullName,
      email: c.email,
      preferredEmail: c.preferredEmail || null,
      linkedin: c.linkedin || null,
      cvLink: c.cvLink || null,
      roleApplied: c.roleApplied || "Other",
      applicationCheck: applicationCheck(c.linkedin, c.cvLink),
      stage: "new" as const,
      notes: notes || null,
    };
  });

  const inserted = await db
    .insert(hiringCandidates)
    .values(rows)
    .returning();

  return NextResponse.json({
    imported: inserted.length,
    skipped: candidates.length - inserted.length,
    ids: inserted.map((r) => r.id),
  });
}
