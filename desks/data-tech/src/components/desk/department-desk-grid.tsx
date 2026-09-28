import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { countPhrase } from "@/lib/desks";
import { STATUS_LABELS, type OneToFiveStatus } from "@/lib/one-to-fives-constants";

const STATUS_TONE: Record<OneToFiveStatus, "success" | "warning" | "danger" | "neutral"> = {
  on_time: "success",
  late: "warning",
  missed: "danger",
  skipped: "neutral",
};

export type DeskSummary = {
  id: string;
  name: string;
  staffCount: number;
  filed: number;
  expected: number;
  slotsDone: number;
  slots: number;
  projectPct: number;
  projects: { id: string; name: string; sprintName: string | null; pct: number }[];
  pulse: { status: OneToFiveStatus; wins: string | null; risks: string | null; helpNeeded: string | null } | null;
};

export function DepartmentDeskGrid({ desks, hrefBase = "/dashboard/desks" }: { desks: DeskSummary[]; hrefBase?: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {desks.map((desk) => {
        const filedPct = desk.expected ? Math.round((desk.filed / desk.expected) * 100) : 0;
        return (
          <Link key={desk.id} href={`${hrefBase}/${desk.id}`}>
            <Card className="h-full transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-24px_rgba(0,35,104,0.55)]">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-navy">{desk.name}</h3>
                  <p className="text-xs text-black/50">
                    {countPhrase(desk.staffCount, "person", "people")} · {countPhrase(desk.projects.length, "project")}
                  </p>
                </div>
                {desk.pulse ? (
                  <Badge tone={STATUS_TONE[desk.pulse.status]}>Pulse {STATUS_LABELS[desk.pulse.status]}</Badge>
                ) : null}
              </div>
              <div className="mb-3">
                <div className="mb-1 flex justify-between text-xs text-black/50">
                  <span>Sprint progress</span>
                  <span>{desk.projectPct}%</span>
                </div>
                <ProgressBar value={desk.projectPct} />
              </div>
              <div className="mb-3">
                <div className="mb-1 flex justify-between text-xs text-black/50">
                  <span>1–5s this week</span>
                  <span>
                    {desk.filed}/{desk.expected || 0} · {filedPct}%
                  </span>
                </div>
                <ProgressBar value={filedPct} />
              </div>
              {desk.projects[0]?.sprintName && (
                <p className="text-xs text-black/55">{desk.projects[0].sprintName}</p>
              )}
            </Card>
          </Link>
        );
      })}
      {desks.length === 0 && <p className="col-span-full text-sm text-black/50">Add departments to open desks.</p>}
    </div>
  );
}
