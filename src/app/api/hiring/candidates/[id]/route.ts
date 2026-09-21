import { NextResponse } from "next/server";

import {
  completeApplicationSchema,
  patchCandidateSchema,
} from "@/lib/hiring/admin-schemas";
import {
  hiringErrorResponse,
  invalidIdResponse,
  trimmedCandidate,
} from "@/lib/hiring/http";
import { parseUuidParam } from "@/lib/hiring/ids";
import {
  completeIncompleteApplication,
  updateCandidate,
} from "@/lib/hiring/pipeline";
import { requireAdminApi } from "@/lib/hiring/require-admin-api";
import { pickAllowedFields } from "@/lib/security/fields";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseUuidParam((await context.params).id);
  if (!id) return invalidIdResponse();

  const body = await request.json().catch(() => null);
  const parsed = patchCandidateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  }
  const patch = pickAllowedFields(parsed.data, [
    "notes",
    "linkedin",
    "cvLink",
    "performanceTaskLink",
    "cultureVideoFeedback",
    "clearCultureMarker",
    "clearPerformanceMarker",
  ]);

  try {
    const result = await updateCandidate(
      id,
      {
        notes: patch.notes !== undefined ? String(patch.notes) : undefined,
        linkedin:
          patch.linkedin !== undefined ? String(patch.linkedin) : undefined,
        cvLink: patch.cvLink !== undefined ? String(patch.cvLink) : undefined,
        performanceTaskLink:
          patch.performanceTaskLink !== undefined
            ? String(patch.performanceTaskLink)
            : undefined,
        cultureVideoFeedback:
          patch.cultureVideoFeedback !== undefined
            ? String(patch.cultureVideoFeedback)
            : undefined,
        clearCultureMarker: Boolean(patch.clearCultureMarker),
        clearPerformanceMarker: Boolean(patch.clearPerformanceMarker),
      },
      admin.id,
    );
    return NextResponse.json({
      candidate: trimmedCandidate(result.candidate),
      advanced: result.advanced,
      emailStubbed: result.emailStubbed,
    });
  } catch (err) {
    return hiringErrorResponse(err, "Could not update candidate");
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseUuidParam((await context.params).id);
  if (!id) return invalidIdResponse();

  const body = await request.json().catch(() => null);
  const parsed = completeApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  try {
    const result = await completeIncompleteApplication(
      id,
      {
        linkedin: parsed.data.linkedin || undefined,
        cvLink: parsed.data.cvLink || undefined,
      },
      admin.id,
    );
    return NextResponse.json({
      candidate: trimmedCandidate(result.candidate),
      emailStubbed: result.emailStubbed,
    });
  } catch (err) {
    return hiringErrorResponse(err, "Could not complete application");
  }
}
