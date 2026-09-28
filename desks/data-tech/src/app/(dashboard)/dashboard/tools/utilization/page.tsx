import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tools } from "@/db/schema";
import { requireModulePage } from "@/lib/require-module-page";
import { Card } from "@/components/ui/card";
import { DeviceIcon } from "@/components/tools/device-icon";

function daysSince(dateStr: Date) {
  return Math.floor((Date.now() - dateStr.getTime()) / 86_400_000);
}

export default async function ToolUtilizationPage() {
  await requireModulePage("tech_tools", "view");

  const rows = await db.query.tools.findMany({
    where: eq(tools.status, "available"),
    with: {
      category: true,
      location: true,
      allocations: {
        orderBy: (t, { desc }) => desc(t.allocatedAt),
        limit: 1,
      },
    },
  });

  const idle = rows
    .map((tool) => {
      const lastReturn = tool.allocations[0]?.returnedAt ?? null;
      const availableSince = lastReturn ?? tool.createdAt;
      return { tool, days: daysSince(availableSince), availableSince };
    })
    .sort((a, b) => b.days - a.days);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium text-navy">Utilization</h1>
        <p className="mt-1 text-sm text-black/60">Available devices, longest-idle first — candidates to redistribute or retire.</p>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-black/10 text-left text-black/60">
            <tr>
              <th className="px-4 py-3 font-medium">Device</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Available since</th>
              <th className="px-4 py-3 font-medium">Idle for</th>
            </tr>
          </thead>
          <tbody>
            {idle.map(({ tool, days, availableSince }) => (
              <tr key={tool.id} className="border-b border-black/5 last:border-0 hover:bg-gray-light/60">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/tools/${tool.id}`} className="flex items-center gap-2 font-medium text-navy hover:underline">
                    <DeviceIcon icon={tool.category.icon} className="h-4 w-4 shrink-0" />
                    {tool.assetTag} <span className="font-normal text-black/70">{tool.name}</span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-black/70">{tool.category.name}</td>
                <td className="px-4 py-3 text-black/70">{tool.location?.name ?? "—"}</td>
                <td className="px-4 py-3 text-black/70">{availableSince.toLocaleDateString()}</td>
                <td className="px-4 py-3 text-black/70">{days} day{days === 1 ? "" : "s"}</td>
              </tr>
            ))}
            {idle.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-black/50">
                  No available devices right now.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
