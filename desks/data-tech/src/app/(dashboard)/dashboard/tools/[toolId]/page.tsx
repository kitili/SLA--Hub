import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tools } from "@/db/schema";
import { requireModulePage } from "@/lib/require-module-page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToolDetailActions } from "@/components/tools/tool-detail-actions";
import { DeleteToolButton } from "@/components/tools/delete-tool-button";
import { DeviceIcon } from "@/components/tools/device-icon";
import { ToolReminderDates } from "@/components/tools/tool-reminder-dates";
import { ReportToolIssueButton } from "@/components/tools/report-tool-issue-button";
import { TOOL_STATUS_TONE } from "@/lib/tool-status";
import { SAFE_USER_COLUMNS } from "@/lib/safe-columns";
import { computeBookValue } from "@/lib/tool-depreciation";

const PHASE_TONE = { unassigned: "warning", in_progress: "info", complete: "success" } as const;

export default async function ToolDetailPage({ params }: { params: Promise<{ toolId: string }> }) {
  const { toolId } = await params;
  const { canManage } = await requireModulePage("tech_tools", "view");

  const tool = await db.query.tools.findFirst({
    where: eq(tools.id, toolId),
    with: {
      category: true,
      location: true,
      conditions: {
        with: { recordedByUser: { columns: SAFE_USER_COLUMNS } },
        orderBy: (t, { desc }) => desc(t.recordedAt),
      },
      allocations: {
        with: {
          allocatedToUser: { columns: SAFE_USER_COLUMNS },
          allocatedToDepartment: true,
          allocatedToLocation: true,
        },
        orderBy: (t, { desc }) => desc(t.allocatedAt),
      },
      reminderDates: { orderBy: (t, { asc }) => asc(t.date) },
      relatedTickets: { orderBy: (t, { desc }) => desc(t.createdAt) },
    },
  });

  if (!tool) notFound();

  const activeAllocation = tool.allocations.find((a) => !a.returnedAt);
  const bookValue = computeBookValue(tool.purchasePrice, tool.purchaseDate, tool.category.usefulLifeYears);
  const toolLabel = `${tool.assetTag} — ${tool.name}`;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <DeviceIcon icon={tool.category.icon} className="h-6 w-6 shrink-0 text-navy" />
          <h1 className="text-xl font-medium text-navy">{tool.assetTag}</h1>
          <Badge tone={TOOL_STATUS_TONE[tool.status]}>{tool.status.replace("_", " ")}</Badge>
          <Link href={`/dashboard/tools/${tool.id}/label`}>
            <Button variant="ghost">Print QR label</Button>
          </Link>
          <ReportToolIssueButton toolId={tool.id} toolLabel={toolLabel} />
          {canManage && (
            <DeleteToolButton
              toolId={tool.id}
              label={`${tool.assetTag} — ${tool.name}`}
              redirectTo="/dashboard/tools"
            />
          )}
        </div>

        <Card>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-black/50">Name</dt>
              <dd>{tool.name}</dd>
            </div>
            <div>
              <dt className="text-black/50">Category</dt>
              <dd>{tool.category.name}</dd>
            </div>
            <div>
              <dt className="text-black/50">Brand / Model</dt>
              <dd>{[tool.brand, tool.model].filter(Boolean).join(" ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-black/50">Location</dt>
              <dd>{tool.location?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-black/50">Serial number</dt>
              <dd>{tool.serialNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-black/50">Current condition</dt>
              <dd className="capitalize">{tool.currentCondition}</dd>
            </div>
            <div>
              <dt className="text-black/50">Purchase date</dt>
              <dd>{tool.purchaseDate ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-black/50">Purchase price</dt>
              <dd>{tool.purchasePrice != null ? tool.purchasePrice.toLocaleString() : "—"}</dd>
            </div>
            <div>
              <dt className="text-black/50">Est. book value</dt>
              <dd>{bookValue != null ? bookValue.toLocaleString() : "—"}</dd>
            </div>
            <div>
              <dt className="text-black/50">Allocated to</dt>
              <dd>
                {activeAllocation
                  ? (activeAllocation.allocatedToPersonName ??
                    activeAllocation.allocatedToUser?.name ??
                    activeAllocation.allocatedToDepartment?.name ??
                    activeAllocation.allocatedToLocation?.name ??
                    "—")
                  : "Unallocated"}
              </dd>
            </div>
            {activeAllocation?.expectedReturnAt && (
              <div>
                <dt className="text-black/50">Expected return</dt>
                <dd>{activeAllocation.expectedReturnAt.toLocaleDateString()}</dd>
              </div>
            )}
          </dl>
          {tool.specifications && (
            <div className="mt-3 border-t border-black/10 pt-3 text-sm">
              <dt className="mb-1 text-black/50">Specifications</dt>
              <dd className="whitespace-pre-wrap">{tool.specifications}</dd>
            </div>
          )}
          {tool.notes && (
            <div className="mt-3 border-t border-black/10 pt-3 text-sm">
              <dt className="mb-1 text-black/50">Notes</dt>
              <dd className="whitespace-pre-wrap">{tool.notes}</dd>
            </div>
          )}
        </Card>

        <Card className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-black/60">Condition history</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {tool.conditions.map((c) => (
              <li key={c.id} className="flex items-center justify-between border-b border-black/5 pb-2 last:border-0">
                <span className="capitalize">{c.condition}</span>
                <span className="text-black/50">
                  {c.recordedByUser?.name ?? "—"} · {c.recordedAt.toLocaleDateString()}
                </span>
              </li>
            ))}
            {tool.conditions.length === 0 && <li className="text-black/50">No history yet.</li>}
          </ul>
        </Card>

        <Card className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-black/60">Allocation history</h2>
            <Link href="/dashboard/tools/history" className="text-xs text-navy underline">
              View full transaction history
            </Link>
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {tool.allocations.map((a) => (
              <li key={a.id} className="flex items-center justify-between border-b border-black/5 pb-2 last:border-0">
                <span>{a.allocatedToPersonName ?? a.allocatedToUser?.name ?? a.allocatedToDepartment?.name ?? a.allocatedToLocation?.name ?? "—"}</span>
                <span className="text-black/50">
                  {a.allocatedAt.toLocaleDateString()} {a.returnedAt ? `→ ${a.returnedAt.toLocaleDateString()}` : "(active)"}
                </span>
              </li>
            ))}
            {tool.allocations.length === 0 && <li className="text-black/50">No allocations yet.</li>}
          </ul>
        </Card>

        <Card className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-black/60">Reminder dates</h2>
          <ToolReminderDates toolId={tool.id} reminders={tool.reminderDates} canManage={canManage} />
        </Card>

        <Card className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-black/60">Related tickets</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {tool.relatedTickets.map((t) => (
              <li key={t.id} className="flex items-center justify-between border-b border-black/5 pb-2 last:border-0">
                <Link href={`/dashboard/tickets/${t.id}`} className="font-medium text-navy hover:underline">
                  {t.ticketNumber}
                </Link>
                <span className="max-w-xs truncate text-black/70">{t.issue}</span>
                <Badge tone={PHASE_TONE[t.phase]}>{t.phase.replace("_", " ")}</Badge>
              </li>
            ))}
            {tool.relatedTickets.length === 0 && <li className="text-black/50">No tickets reported for this device.</li>}
          </ul>
        </Card>
      </div>

      <div>
        <ToolDetailActions toolId={tool.id} activeAllocation={activeAllocation ?? null} canManage={canManage} />
      </div>
    </div>
  );
}
