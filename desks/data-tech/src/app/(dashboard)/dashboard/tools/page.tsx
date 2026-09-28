import Link from "next/link";
import { and, asc, desc, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { tools, subscriptions } from "@/db/schema";
import { requireModulePage } from "@/lib/require-module-page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeviceIcon } from "@/components/tools/device-icon";
import { DeleteToolButton } from "@/components/tools/delete-tool-button";
import { ToolsSummary } from "@/components/tools/tools-summary";
import { TOOL_STATUS_TONE } from "@/lib/tool-status";

function daysUntil(dateStr: string) {
  const target = new Date(`${dateStr}T00:00:00Z`);
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((target.getTime() - todayUtc) / 86_400_000);
}

export default async function ToolsListPage() {
  const { canManage } = await requireModulePage("tech_tools", "view");

  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);

  const [rows, upcomingRenewals] = await Promise.all([
    db.query.tools.findMany({
      orderBy: desc(tools.createdAt),
      with: { category: true, location: true },
      limit: 500,
    }),
    db.query.subscriptions.findMany({
      where: and(eq(subscriptions.isActive, true), lte(subscriptions.renewalDate, in7Days.toISOString().slice(0, 10))),
      orderBy: asc(subscriptions.renewalDate),
    }),
  ]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-medium text-navy">Tech tools</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/tools/history">
            <Button variant="ghost">History</Button>
          </Link>
          <Link href="/dashboard/tools/subscriptions">
            <Button variant="ghost">Subscriptions</Button>
          </Link>
          <Link href="/dashboard/tools/utilization">
            <Button variant="ghost">Utilization</Button>
          </Link>
          <Link href="/dashboard/tools/labels">
            <Button variant="ghost">Print labels</Button>
          </Link>
          {canManage && (
            <>
              <Link href="/dashboard/tools/import">
                <Button variant="ghost">Import</Button>
              </Link>
              <Link href="/dashboard/tools/allocate">
                <Button variant="secondary">Distribute</Button>
              </Link>
              <Link href="/dashboard/tools/new">
                <Button>Add new device</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="mb-6">
        <ToolsSummary />
      </div>

      {upcomingRenewals.length > 0 && (
        <Card className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-black/60">Subscriptions renewing soon</h2>
            <Link href="/dashboard/tools/subscriptions" className="text-xs text-navy underline">
              Manage subscriptions
            </Link>
          </div>
          <ul className="flex flex-col gap-1.5 text-sm">
            {upcomingRenewals.map((sub) => {
              const days = daysUntil(sub.renewalDate);
              return (
                <li key={sub.id} className="flex items-center justify-between gap-3">
                  <span className="text-black/80">{sub.name}</span>
                  <Badge tone={days <= 2 ? "danger" : "warning"}>
                    {days < 0 ? `Overdue ${Math.abs(days)}d` : days === 0 ? "Renews today" : `${days}d`}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Desktop: table */}
      <Card className="hidden overflow-x-auto p-0 md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-black/10 text-left text-black/60">
            <tr>
              <th className="px-4 py-3 font-medium">Device</th>
              <th className="px-4 py-3 font-medium">Brand / Model</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Condition</th>
              {canManage && <th className="px-4 py-3 font-medium">&nbsp;</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((tool) => (
              <tr key={tool.id} className="border-b border-black/5 last:border-0 hover:bg-gray-light/60">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/tools/${tool.id}`} className="flex items-center gap-2 font-medium text-navy hover:underline">
                    <DeviceIcon icon={tool.category.icon} className="h-4 w-4 shrink-0" />
                    <span>
                      {tool.assetTag} <span className="font-normal text-black/70">{tool.name}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-black/70">{[tool.brand, tool.model].filter(Boolean).join(" ") || "—"}</td>
                <td className="px-4 py-3 text-black/70">{tool.category.name}</td>
                <td className="px-4 py-3 text-black/70">{tool.location?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={TOOL_STATUS_TONE[tool.status]}>{tool.status.replace("_", " ")}</Badge>
                </td>
                <td className="px-4 py-3 capitalize text-black/70">{tool.currentCondition}</td>
                {canManage && (
                  <td className="px-4 py-3">
                    <DeleteToolButton toolId={tool.id} label={`${tool.assetTag} — ${tool.name}`} small />
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={canManage ? 7 : 6} className="px-4 py-8 text-center text-black/50">
                  No tools yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((tool) => (
          <Card key={tool.id}>
            <div className="flex items-start justify-between gap-3">
              <Link href={`/dashboard/tools/${tool.id}`} className="flex items-center gap-2 font-medium text-navy hover:underline">
                <DeviceIcon icon={tool.category.icon} className="h-5 w-5 shrink-0" />
                {tool.assetTag}
              </Link>
              <Badge tone={TOOL_STATUS_TONE[tool.status]}>{tool.status.replace("_", " ")}</Badge>
            </div>
            <div className="mt-1 text-sm text-black/70">{tool.name}</div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-black/60">
              <div>{tool.category.name}</div>
              <div>{tool.location?.name ?? "No location"}</div>
              <div>{[tool.brand, tool.model].filter(Boolean).join(" ") || "—"}</div>
              <div className="capitalize">{tool.currentCondition}</div>
            </div>
            {canManage && (
              <div className="mt-3">
                <DeleteToolButton toolId={tool.id} label={`${tool.assetTag} — ${tool.name}`} small />
              </div>
            )}
          </Card>
        ))}
        {rows.length === 0 && <p className="text-center text-sm text-black/50">No tools yet.</p>}
      </div>
    </div>
  );
}
