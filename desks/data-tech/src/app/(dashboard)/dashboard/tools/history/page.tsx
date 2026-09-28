import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { toolAllocations } from "@/db/schema";
import { requireModulePage } from "@/lib/require-module-page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SAFE_USER_COLUMNS } from "@/lib/safe-columns";

export default async function ToolHistoryPage() {
  await requireModulePage("tech_tools", "view");
  const rows = await db.query.toolAllocations.findMany({
    orderBy: desc(toolAllocations.allocatedAt),
    limit: 300,
    with: {
      tool: { with: { category: true } },
      allocatedToUser: { columns: SAFE_USER_COLUMNS },
      allocatedToDepartment: true,
      allocatedToLocation: true,
    },
  });

  return (
    <div>
      <h1 className="mb-6 text-xl font-medium text-navy">Transaction history</h1>

      {/* Desktop: table */}
      <Card className="hidden overflow-x-auto p-0 md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-black/10 text-left text-black/60">
            <tr>
              <th className="px-4 py-3 font-medium">Device</th>
              <th className="px-4 py-3 font-medium">Borrower</th>
              <th className="px-4 py-3 font-medium">Purpose</th>
              <th className="px-4 py-3 font-medium">Taken</th>
              <th className="px-4 py-3 font-medium">Expected return</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-black/5 last:border-0 hover:bg-gray-light/60">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/tools/${a.tool.id}`} className="font-medium text-navy hover:underline">
                    {a.tool.assetTag}
                  </Link>{" "}
                  <span className="text-black/60">{a.tool.name}</span>
                </td>
                <td className="px-4 py-3 text-black/70">
                  {a.allocatedToPersonName ?? a.allocatedToUser?.name ?? a.allocatedToDepartment?.name ?? a.allocatedToLocation?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-black/70">{a.purpose ?? "—"}</td>
                <td className="px-4 py-3 text-black/70">{a.allocatedAt.toLocaleDateString()}</td>
                <td className="px-4 py-3 text-black/70">
                  {a.expectedReturnAt ? a.expectedReturnAt.toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3">
                  {a.returnedAt ? (
                    <Badge tone="success">returned {a.returnedAt.toLocaleDateString()}</Badge>
                  ) : (
                    <Badge tone="danger">taken</Badge>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-black/50">
                  No transactions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((a) => (
          <Card key={a.id}>
            <div className="flex items-start justify-between gap-3">
              <Link href={`/dashboard/tools/${a.tool.id}`} className="font-medium text-navy hover:underline">
                {a.tool.assetTag}
              </Link>
              {a.returnedAt ? <Badge tone="success">returned</Badge> : <Badge tone="danger">taken</Badge>}
            </div>
            <div className="mt-1 text-sm text-black/70">{a.tool.name}</div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-black/60">
              <div>{a.allocatedToPersonName ?? a.allocatedToUser?.name ?? a.allocatedToDepartment?.name ?? a.allocatedToLocation?.name ?? "—"}</div>
              <div>{a.purpose ?? "—"}</div>
              <div>Taken {a.allocatedAt.toLocaleDateString()}</div>
              <div>{a.expectedReturnAt ? `Due ${a.expectedReturnAt.toLocaleDateString()}` : "No due date"}</div>
            </div>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-center text-sm text-black/50">No transactions yet.</p>}
      </div>
    </div>
  );
}
