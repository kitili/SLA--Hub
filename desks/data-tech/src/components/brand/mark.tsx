import { cn } from "@/lib/cn";

export function Mark({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <span
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[11px] font-semibold tracking-[0.08em]",
        tone === "light" ? "bg-navy text-gold-accent shadow-[0_8px_24px_-12px_rgba(0,35,104,0.8)]" : "bg-gold-accent text-navy",
        className,
      )}
    >
      DT
    </span>
  );
}
