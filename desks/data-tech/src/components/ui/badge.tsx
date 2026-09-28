import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "info" | "warning" | "success" | "danger";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em]",
        tone === "neutral" && "bg-navy/5 text-navy/70",
        tone === "info" && "bg-blue-accent/40 text-navy",
        tone === "warning" && "bg-gold-accent/50 text-navy",
        tone === "success" && "bg-emerald-100 text-emerald-800",
        tone === "danger" && "bg-red-100 text-red-800",
        className,
      )}
      {...props}
    />
  );
}
