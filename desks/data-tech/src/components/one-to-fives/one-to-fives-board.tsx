import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FeedbackThread, type FeedbackItem } from "@/components/one-to-fives/feedback-thread";
import { PROGRESS_LABELS, STATUS_LABELS, type OneToFiveProgress, type OneToFiveStatus } from "@/lib/one-to-fives-constants";

type Person = {
  id: string;
  name: string;
  email: string;
  departmentId: string | null;
  departmentName?: string | null;
};

type Entry = {
  id: string;
  userId: string;
  workDate: string;
  status: OneToFiveStatus;
  submittedAt: Date | string | null;
  skipReason: string | null;
  slot1: string | null;
  slot2: string | null;
  slot3: string | null;
  blockers: string | null;
  slot1Progress: OneToFiveProgress | null;
  slot2Progress: OneToFiveProgress | null;
  slot3Progress: OneToFiveProgress | null;
  closedAt: Date | string | null;
  feedback?: FeedbackItem[];
};

const STATUS_TONE: Record<OneToFiveStatus, "success" | "warning" | "danger" | "neutral"> = {
  on_time: "success",
  late: "warning",
  missed: "danger",
  skipped: "neutral",
};

function progressTone(value: OneToFiveProgress | null): "success" | "warning" | "danger" | "neutral" | "info" {
  if (value === "completed") return "success";
  if (value === "in_progress") return "info";
  if (value === "abandoned") return "danger";
  return "neutral";
}

export function OneToFivesBoard({
  workDate,
  workDay,
  people,
  entries,
  departments,
  showFeedback = true,
  embedded = false,
}: {
  workDate: string;
  workDay: boolean;
  people: Person[];
  entries: Entry[];
  departments: { id: string; name: string }[];
  showFeedback?: boolean;
  embedded?: boolean;
}) {
  const todayByUser = new Map(entries.filter((e) => e.workDate === workDate).map((e) => [e.userId, e]));
  const filed = people.filter((person) => {
    const status = todayByUser.get(person.id)?.status;
    return status === "on_time" || status === "late" || status === "skipped";
  });
  const waiting = people.filter((person) => !filed.some((p) => p.id === person.id));
  const closedCount = filed.filter((person) => todayByUser.get(person.id)?.closedAt).length;
  const deptName = (id: string | null) => departments.find((d) => d.id === id)?.name ?? "Other";

  const body = (
    <>
      {!embedded && (
        <div className="mb-4">
          <h2 className="text-lg font-medium text-navy">Team 1–5s</h2>
          <p className="text-sm text-black/50">
            {filed.length} of {people.length} in
            {closedCount ? ` · ${closedCount} closed` : ""}
            {workDay ? "" : " · off today"}
          </p>
        </div>
      )}
      {waiting.length > 0 && workDay && (
        <p className="mb-4 text-sm text-black/50">
          Waiting on {waiting.map((person) => person.name).join(", ")}.
        </p>
      )}
      <div className={`grid grid-cols-1 gap-3 ${embedded ? "" : "xl:grid-cols-2"}`}>
        {filed.map((person) => {
          const row = todayByUser.get(person.id);
          const status = (row?.status ?? "missed") as OneToFiveStatus;
          return (
            <div key={person.id} className="rounded-md border border-black/10 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-medium text-navy">{person.name}</span>
                <div className="flex gap-1">
                  <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>
                  {row?.closedAt && <Badge tone="success">Closed</Badge>}
                </div>
              </div>
              {departments.length > 1 && (
                <p className="mb-2 text-xs text-black/40">{person.departmentName ?? deptName(person.departmentId)}</p>
              )}
              {row?.skipReason ? (
                <p className="text-sm text-black/60">{row.skipReason}</p>
              ) : (
                <ol className="flex flex-col gap-2 text-sm">
                  <SlotLine n={1} text={row?.slot1 ?? null} progress={row?.slot1Progress ?? null} />
                  <SlotLine n={2} text={row?.slot2 ?? null} progress={row?.slot2Progress ?? null} />
                  <SlotLine n={3} text={row?.slot3 ?? null} progress={row?.slot3Progress ?? null} />
                </ol>
              )}
              {row?.blockers && <p className="mt-2 text-xs text-red-700">Blocker: {row.blockers}</p>}
              {showFeedback && row?.id && <FeedbackThread oneToFiveId={row.id} items={row.feedback ?? []} compact />}
            </div>
          );
        })}
      </div>
      {people.length === 0 && <p className="text-sm text-black/50">No one is on this desk yet.</p>}
    </>
  );

  if (embedded) return body;
  return <Card>{body}</Card>;
}

function SlotLine({ n, text, progress }: { n: number; text: string | null; progress: OneToFiveProgress | null }) {
  if (!text) return null;
  return (
    <li className="flex items-start justify-between gap-2">
      <span className="text-black/80">
        {n}. {text}
      </span>
      {progress && (
        <Badge tone={progressTone(progress)} className="shrink-0">
          {PROGRESS_LABELS[progress]}
        </Badge>
      )}
    </li>
  );
}
