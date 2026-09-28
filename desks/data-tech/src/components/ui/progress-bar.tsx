import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function ProgressBar({
  value,
  className,
}: {
  value: number;
} & Pick<HTMLAttributes<HTMLDivElement>, "className">) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-navy/10", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-blue-accent to-gold-accent"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
