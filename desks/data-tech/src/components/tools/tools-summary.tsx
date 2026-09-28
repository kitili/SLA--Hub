import Link from "next/link";
import { desc, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { tools, toolAllocations } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { SAFE_USER_COLUMNS } from "@/lib/safe-columns";
import { computeBookValue } from "@/lib/tool-depreciation";

export async function ToolsSummary({ linkToTools = false }: { linkToTools?: boolean }) {
  const [statusCounts, recentActivity, valuedTools] = await Promise.all([
    db
      .select({ status: tools.status, count: sql<number>`count(*)::int` })
      .from(tools)
      .groupBy(tools.status),
    db.query.toolAllocations.findMany({
      orderBy: desc(toolAllocations.allocatedAt),
      limit: 5,
      with: {
        tool: true,
        allocatedToUser: { columns: SAFE_USER_COLUMNS },
        allocatedToDepartment: true,
        allocatedToLocation: true,
      },
    }),
    db.query.tools.findMany({
      where: ne(tools.status, "retired"),
      columns: { purchasePrice: true, purchaseDate: true },
      with: { category: { columns: { usefulLifeYears: true } } },
    }),
  ]);

  const countFor = (status: string) => statusCounts.find((s) => s.status === status)?.count ?? 0;
  const total = statusCounts.reduce((sum, s) => sum + s.count, 0);
  const totalAssetValue = valuedTools.reduce((sum, t) => {
    const value = computeBookValue(t.purchasePrice, t.purchaseDate, t.category.usefulLifeYears);
    return value != null ? sum + value : sum;
  }, 0);

  const stats = [
    { label: "Total devices", value: total },
    { label: "Available", value: countFor("available") },
    { label: "Taken", value: countFor("allocated") },
    { label: "Maintenance", value: countFor("in_repair") },
    { label: "Est. asset value", value: totalAssetValue.toLocaleString() },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-black/60">Tech tools</h2>
        {linkToTools && (
          <Link href="/dashboard/tools" className="text-xs text-navy underline">
            View all
          </Link>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className="text-center">
            <div className="text-2xl font-medium text-navy">{s.value}</div>
            <div className="mt-1 text-xs text-black/60">{s.label}</div>
          </Card>
        ))}
      </div>

      <Card>
        <h3 className="mb-3 text-sm font-medium text-black/60">Recent activity</h3>
        <ul className="flex flex-col gap-2 text-sm">
          {recentActivity.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 pb-2 last:border-0"
            >
              <span>
                <Link href={`/dashboard/tools/${a.tool.id}`} className="font-medium text-navy hover:underline">
                  {a.tool.assetTag}
                </Link>{" "}
                <span className="text-black/70">
                  {a.returnedAt ? "returned by" : "taken by"}{" "}
                  {a.allocatedToPersonName ?? a.allocatedToUser?.name ?? a.allocatedToDepartment?.name ?? a.allocatedToLocation?.name ?? "—"}
                </span>
              </span>
              <span className="text-black/50">{(a.returnedAt ?? a.allocatedAt).toLocaleString()}</span>
            </li>
          ))}
          {recentActivity.length === 0 && <li className="text-black/50">No activity yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
