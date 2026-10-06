import { and, asc, ilike, or, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { staff } from "@/lib/db/schema";
import { hubApiJson, hubApiOptions, requireHubApiKey } from "@/lib/hub-api/auth";
import { readLimit, readOffset } from "@/lib/hub-api/query";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return hubApiOptions();
}

export async function GET(request: Request) {
  const denied = requireHubApiKey(request);
  if (denied) return denied;

  const search = new URL(request.url).searchParams;
  const campus = search.get("campus")?.trim();
  const q = search.get("q")?.trim();
  const limit = readLimit(search);
  const offset = readOffset(search);

  const filters: SQL[] = [];
  if (campus) filters.push(ilike(staff.campus, campus));
  if (q) {
    const match = or(ilike(staff.fullName, `%${q}%`), ilike(staff.email, `%${q}%`));
    if (match) filters.push(match);
  }

  const rows = await db
    .select({
      id: staff.id,
      email: staff.email,
      fullName: staff.fullName,
      campus: staff.campus,
      jobTitle: staff.jobTitle,
      lastActiveAt: staff.lastActiveAt,
      startedAt: staff.startedAt,
      createdAt: staff.createdAt,
    })
    .from(staff)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(staff.fullName), asc(staff.email))
    .limit(limit)
    .offset(offset);

  return hubApiJson({
    ok: true,
    source: "sla-hub",
    generatedAt: new Date().toISOString(),
    count: rows.length,
    data: rows.map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      campus: row.campus,
      jobTitle: row.jobTitle,
      lastActiveAt: row.lastActiveAt?.toISOString() ?? null,
      startedAt: row.startedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}
