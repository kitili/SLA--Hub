import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium tracking-tight transition duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-navy text-white shadow-[0_10px_24px_-14px_rgba(0,35,104,0.9)] hover:bg-[#001a52]",
        variant === "secondary" && "bg-blue-accent/80 text-navy hover:bg-blue-accent",
        variant === "ghost" && "bg-white/70 text-navy ring-1 ring-navy/10 hover:bg-white",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        className,
      )}
      {...props}
    />
  );
}
