import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { createRoute, listRoutes } from "@/lib/db/routes";
import type { TripDirection } from "@/types/database";

/**
 * GET  /api/routes — list routes
 * POST /api/routes — create route (admin)
 */
export async function GET(request: Request) {
  const auth = await requireUser(["admin", "transport", "matron", "driver", "finance"]);
  if ("response" in auth) return auth.response;

  const schoolId = new URL(request.url).searchParams.get("schoolId") ?? undefined;
  const routes = await listRoutes(schoolId);
  return NextResponse.json({ routes });
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    name?: string;
    direction?: TripDirection;
  };

  if (!body.schoolId?.trim() || !body.name?.trim()) {
    return NextResponse.json(
      { error: "schoolId and name are required" },
      { status: 400 },
    );
  }

  const direction = body.direction ?? "am";
  if (direction !== "am" && direction !== "pm") {
    return NextResponse.json({ error: "direction must be am|pm" }, { status: 400 });
  }

  const outcome = await createRoute({
    schoolId: body.schoolId.trim(),
    name: body.name.trim(),
    direction,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json({ route: outcome.route }, { status: 201 });
}
