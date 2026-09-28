import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { DeskWorkItem } from "@/lib/desks";

const COLUMNS = [
  { key: "in_progress", label: "In progress" },
  { key: "review", label: "Review" },
  { key: "todo", label: "To do" },
] as const;

export function WorkBoard({
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
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-navy">{title}</h2>
        {href && (
          <Link href={href} className="text-xs text-navy underline">
            Open board
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-black/45">{empty}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLUMNS.map((column) => {
            const columnItems = items.filter((item) => item.status === column.key);
            return (
              <div key={column.key} className="min-w-0">
                <div className="mb-2 flex items-center justify-between text-xs text-black/50">
                  <span>{column.label}</span>
                  <span>{columnItems.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {columnItems.map((item) => (
                    <Link
                      key={item.id}
                      href={`/dashboard/systems/${item.systemId}`}
                      className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm hover:border-navy/30"
                    >
                      <span className="block truncate text-navy">
                        #{item.taskNumber} {item.title}
                      </span>
                      <span className="block truncate text-xs text-black/45">
                        {item.systemName}
                        {item.phaseName ? ` · ${item.phaseName}` : ""}
                      </span>
                    </Link>
                  ))}
                  {columnItems.length === 0 && <p className="text-xs text-black/35">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
