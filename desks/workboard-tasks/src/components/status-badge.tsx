import { phaseStyle } from "@/lib/board/columns";

export function StatusBadge({ status }: { status: string }) {
  const phase = phaseStyle(status);
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${phase.pill}`}>
      {phase.title}
    </span>
  );
}
