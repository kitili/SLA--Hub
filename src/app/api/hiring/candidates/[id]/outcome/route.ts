import { NextResponse } from "next/server";

import { outcomeSchema } from "@/lib/hiring/admin-schemas";
import {
  hiringErrorResponse,
  invalidIdResponse,
} from "@/lib/hiring/http";
import { parseUuidParam } from "@/lib/hiring/ids";
import { setCandidateOutcome } from "@/lib/hiring/pipeline";
import { requireAdminApi } from "@/lib/hiring/require-admin-api";

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
  const parsed = outcomeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "outcome must be hired or rejected" },
      { status: 400 },
    );
  }

  try {
    const result = await setCandidateOutcome(id, parsed.data.outcome, admin.id);
    return NextResponse.json({
      ok: true,
      emailStubbed: result.emailStubbed,
      staffProvisioned: result.staffProvisioned,
    });
  } catch (err) {
    return hiringErrorResponse(err, "Could not update outcome");
  }
}
