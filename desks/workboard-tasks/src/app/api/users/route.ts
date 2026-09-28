import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assertApiSecret } from "@/lib/auth/api-secret";

export async function GET(request: NextRequest) {
  try {
    assertApiSecret(request);
    const organizationId = request.nextUrl.searchParams.get("organizationId") ?? undefined;
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 100), 500);
    const offset = Number(request.nextUrl.searchParams.get("offset") ?? 0);

    const [users, total] = await Promise.all([
      db.user.findMany({
        where: { organizationId, isActive: true },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.user.count({ where: { organizationId, isActive: true } }),
    ]);

    return NextResponse.json({ users, total, limit, offset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
