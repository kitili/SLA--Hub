import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-navy/10 bg-white/90 p-6 shadow-[0_16px_40px_-28px_rgba(0,35,104,0.55)] backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}
