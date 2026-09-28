import { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const fieldStyles =
  "w-full rounded-xl border border-navy/10 bg-white px-3 py-2.5 text-sm text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] placeholder:text-black/35 focus:border-navy focus:outline-none focus:ring-4 focus:ring-blue-accent/40";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldStyles, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldStyles, className)} {...props} />;
}
