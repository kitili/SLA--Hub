import { LabelHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-navy/55", className)}
      {...props}
    />
  );
}
