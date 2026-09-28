import { NextResponse } from "next/server";

import { ingestApplication } from "@/lib/hiring/pipeline";
import {
  createCandidateSchema,
} from "@/lib/hiring/admin-schemas";
import { buildApplicationNotes } from "@/lib/hiring/application-fields";
import { hiringErrorResponse, trimmedCandidate } from "@/lib/hiring/http";
import { requireAdminApi } from "@/lib/hiring/require-admin-api";
import { parseRoleApplied } from "@/lib/hiring/roles";
import { pickAllowedFields } from "@/lib/security/fields";

export async function POST(request: Request) {
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createCandidateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid candidate" }, { status: 400 });
  }
  const data = pickAllowedFields(parsed.data, [
    "fullName",
    "email",
    "preferredEmail",
    "linkedin",
    "cvLink",
    "notes",
    "roleApplied",
    "roleOther",
    "whatsapp",
    "phone",
    "otherPhone",
    "location",
    "hearAboutUs",
    "employed",
    "currentRole",
    "employer",
    "yearsExperience",
    "relevantExperience",
    "whySilverleaf",
    "noticePeriod",
    "expectedSalary",
  ]);

  let roleApplied: string;
  try {
    roleApplied = parseRoleApplied({
      roleApplied: String(data.roleApplied || ""),
      roleOther: String(data.roleOther || ""),
    });
  } catch {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  try {
    const result = await ingestApplication({
      fullName: data.fullName!,
      email: data.email!,
      preferredEmail: data.preferredEmail || undefined,
      linkedin: data.linkedin || undefined,
      cvLink: data.cvLink || undefined,
      roleApplied,
      notes:
        data.notes?.trim() ||
        buildApplicationNotes(data, {
          source: "Hiring admin manual entry",
        }) ||
        undefined,
    });
    return NextResponse.json(
      {
        candidate: trimmedCandidate(result.candidate),
        duplicate: Boolean(result.duplicate),
      },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (err) {
    return hiringErrorResponse(err, "Could not create candidate", 500);
  }
}
