import type { ReactNode } from "react";

export function inputClass() {
  return "w-full rounded-[10px] border border-[#d8dee8] bg-[#f7f9fc] px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-light-blue focus:bg-white focus:ring-[3px] focus:ring-[rgba(255,201,82,0.35)]";
}

export function ghostClass() {
  return "inline-flex items-center rounded-[10px] border border-card-border bg-white px-3.5 py-2 text-sm font-semibold text-electric-blue no-underline hover:bg-light-blue-30";
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-semibold text-electric-blue">{label}</span>
      {children}
    </label>
  );
}

export { Btn } from "./btn";
