import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DeskWorkItem } from "@/lib/desks";

const STATUS_TONE: Record<string, "success" | "warning" | "info" | "neutral"> = {
  in_progress: "info",
  review: "warning",
  todo: "neutral",
  backlog: "neutral",
};

export function WorkList({
  title,
  href,
  items,
  empty,
}: {
  title: string;
  href?: string;
  items: DeskWorkItem[];
  empty: string;
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-navy">{title}</h2>
        {href && (
          <Link href={href} className="text-xs text-navy underline">
            Open
          </Link>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <Link key={item.id} href={`/dashboard/systems/${item.systemId}`} className="flex items-start justify-between gap-2 text-sm">
            <span className="min-w-0">
              <span className="block truncate text-navy">
                #{item.taskNumber} {item.title}
              </span>
              <span className="block truncate text-xs text-black/45">
                {item.systemName}
                {item.phaseName ? ` · ${item.phaseName}` : ""}
              </span>
            </span>
            <Badge tone={STATUS_TONE[item.status] ?? "neutral"} className="shrink-0">
              {item.status.replace("_", " ")}
            </Badge>
          </Link>
        ))}
        {items.length === 0 && <p className="text-sm text-black/45">{empty}</p>}
      </div>
    </Card>
  );
}
