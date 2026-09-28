import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { getSessionUser } from "@/lib/auth/session";
import { dailyLineLabel } from "@/lib/daily-lines";
import { getMyHistory } from "@/lib/services/daily-sheet";

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Log in first" }, { status: 401 });

  const status = request.nextUrl.searchParams.get("status") ?? "all";
  const from = request.nextUrl.searchParams.get("from") || "2026-09-01";
  const to = request.nextUrl.searchParams.get("to") || "";
  const history = await getMyHistory(user.id);
  const start = new Date(from < "2026-09-01" ? "2026-09-01" : from);
  const end = to ? new Date(`${to}T23:59:59`) : null;

  const rows = history.entries.filter((entry) => {
    const day = new Date(entry.date);
    if (day < start) return false;
    if (end && day > end) return false;
    if (status === "done" && entry.status !== "COMPLETED") return false;
    if (status === "open" && entry.status === "COMPLETED") return false;
    return true;
  });

  const lines = [
    ["Date", "Line", "Task", "Priority", "Status", "Completed at"].join(","),
    ...rows.map((row) =>
      [
        format(new Date(row.date), "yyyy-MM-dd"),
        dailyLineLabel(row.slot),
        row.title,
        row.priority ?? "",
        row.status,
        row.completedAt ? format(new Date(row.completedAt), "yyyy-MM-dd HH:mm") : "",
      ]
        .map(csvCell)
        .join(","),
    ),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="my-tasks.csv"',
    },
  });
}
