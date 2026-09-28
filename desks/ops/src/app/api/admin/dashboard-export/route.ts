import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import {
  buildDashboardExportTabs,
  type DashboardSheetId,
} from "@/lib/export/build-dashboard-export";
import { DASHBOARD_SHEET_META } from "@/lib/export/dashboard-sheet-meta";
import {
  toCsvWithBom,
  toXlsxBuffer,
  zipStoreFiles,
} from "@/lib/export/xlsx";

const SHEET_IDS = new Set(DASHBOARD_SHEET_META.map((s) => s.id));

function parseInclude(raw: string | null): DashboardSheetId[] | undefined {
  if (!raw?.trim()) return undefined;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is DashboardSheetId => SHEET_IDS.has(s as DashboardSheetId));
  return ids.length > 0 ? ids : undefined;
}

/**
 * GET /api/admin/dashboard-export?from=&to=&format=xlsx|csvzip|csv&include=
 *
 * xlsx   — multi-tab Excel (best for Google Sheets / Excel)
 * csvzip — ZIP of one UTF-8 CSV per tab
 * csv    — single combined CSV (legacy)
 */
export async function GET(request: Request) {
  const auth = await requireUser(["admin", "transport", "finance"]);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const format = searchParams.get("format") ?? "xlsx";
  const include = parseInclude(searchParams.get("include"));

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to (YYYY-MM-DD) are required" },
      { status: 400 },
    );
  }
  if (from > to) {
    return NextResponse.json(
      { error: "from must be on or before to" },
      { status: 400 },
    );
  }

  const tabs = await buildDashboardExportTabs({ from, to, include });
  if (tabs.length === 0) {
    return NextResponse.json(
      { error: "Select at least one sheet to export" },
      { status: 400 },
    );
  }

  const stamp = `${from}_to_${to}`;

  if (format === "csvzip") {
    const files = tabs.map((tab) => ({
      name: `${tab.name.replaceAll(/[\\/*?:\[\]]/g, "-")}.csv`,
      content: toCsvWithBom(tab.rows),
    }));
    const zip = zipStoreFiles(files);
    return new NextResponse(Buffer.from(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="silverleaf-dashboard-${stamp}-csvs.zip"`,
      },
    });
  }

  if (format === "csv") {
    const body = `\uFEFF${tabs
      .map((tab) => [`# Sheet: ${tab.name}`, tab.rows.map((r) => r.join(",")).join("\r\n")].join("\r\n"))
      .join("\r\n\r\n")}`;
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="silverleaf-dashboard-${stamp}.csv"`,
      },
    });
  }

  // Default: real multi-sheet .xlsx
  const buffer = toXlsxBuffer(tabs);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="silverleaf-dashboard-${stamp}.xlsx"`,
    },
  });
}
