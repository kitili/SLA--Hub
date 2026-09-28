import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import {
  createHireOut,
  listHireOuts,
  updateHireOut,
  type HirePurpose,
  type HireStatus,
} from "@/lib/db/finance";

const PURPOSES: HirePurpose[] = ["wedding", "burial", "event", "other"];
const STATUSES: HireStatus[] = [
  "inquiry",
  "booked",
  "in_progress",
  "completed",
  "cancelled",
];

/** GET/POST /api/hire-outs */
export async function GET(request: Request) {
  const auth = await requireUser(["admin", "transport", "finance", "matron", "driver"]);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const hire_outs = await listHireOuts({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    busId: searchParams.get("busId") ?? undefined,
  });
  return NextResponse.json({ hire_outs });
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport", "finance"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    busId?: string;
    schoolId?: string;
    clientName?: string;
    purpose?: HirePurpose;
    startAt?: string;
    endAt?: string;
    quotedAmount?: number;
    currency?: string;
    status?: HireStatus;
    notes?: string;
    createRevenue?: boolean;
  };

  if (
    !body.busId?.trim() ||
    !body.clientName?.trim() ||
    !body.startAt ||
    !body.endAt
  ) {
    return NextResponse.json(
      { error: "busId, clientName, startAt, endAt are required" },
      { status: 400 },
    );
  }
  if (body.purpose && !PURPOSES.includes(body.purpose)) {
    return NextResponse.json({ error: "invalid purpose" }, { status: 400 });
  }
  if (body.status && !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const outcome = await createHireOut({
    busId: body.busId.trim(),
    schoolId: body.schoolId,
    clientName: body.clientName,
    purpose: body.purpose,
    startAt: body.startAt,
    endAt: body.endAt,
    quotedAmount: body.quotedAmount,
    currency: body.currency,
    status: body.status,
    notes: body.notes,
    createdBy: auth.userId,
    createRevenue: body.createRevenue ?? true,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 409 });
  }
  return NextResponse.json(outcome, { status: 201 });
}

/** PATCH /api/hire-outs?id= */
export async function PATCH(request: Request) {
  const auth = await requireUser(["admin", "transport", "finance"]);
  if ("response" in auth) return auth.response;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id query param required" }, { status: 400 });
  }

  const body = (await request.json()) as {
    status?: HireStatus;
    notes?: string | null;
    quotedAmount?: number;
    startAt?: string;
    endAt?: string;
  };

  if (body.status && !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const outcome = await updateHireOut(id, body);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ hire_out: outcome.hire_out });
}
