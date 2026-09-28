import { NextRequest, NextResponse } from "next/server";
import { format, startOfDay } from "date-fns";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { listUpdatesForExport } from "@/lib/services/updates";

function csvCell(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

function parseDay(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const day = startOfDay(new Date(`${value}T00:00:00`));
  return Number.isNaN(day.getTime()) ? undefined : day;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Log in first" }, { status: 401 });

  const who = request.nextUrl.searchParams.get("who");
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const kindParam = request.nextUrl.searchParams.get("hk");
  const kind = kindParam === "PROGRESS" || kindParam === "CHALLENGE" ? kindParam : null;
  const person = who
    ? await db.user.findFirst({
        where: { id: who, organizationId: user.organizationId, isActive: true },
        select: { id: true },
      })
    : null;

  const rows = await listUpdatesForExport(user.organizationId, kind, {
    authorId: person?.id,
    query,
    from: parseDay(request.nextUrl.searchParams.get("from")) ?? startOfDay(new Date("2026-09-01")),
    to: parseDay(request.nextUrl.searchParams.get("to")),
  });

  const lines = [
    ["Date", "Kind", "Name", "Note"].join(","),
    ...rows.map((row) =>
      [
        format(row.planDate, "yyyy-MM-dd"),
        row.kind === "CHALLENGE" ? "Challenge" : "Progress",
        row.author.name ?? row.author.username ?? "Someone",
        row.body,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="updates-history.csv"',
    },
  });
}
