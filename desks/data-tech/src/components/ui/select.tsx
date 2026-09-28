import { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-xl border border-navy/10 bg-white px-3 py-2.5 text-sm text-black focus:border-navy focus:outline-none focus:ring-4 focus:ring-blue-accent/40",
        className,
      )}
      {...props}
    />
  );
}
