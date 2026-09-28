"use client";

import {
  formatLastEdited,
  type AuditFields,
} from "@/lib/audit/attribution";

type Props = {
  row: AuditFields;
  labels?: Map<string, string> | Record<string, string> | null;
  className?: string;
};

/** Compact "Last edited by X · when" line for lists and detail panels. */
export function LastEditedBy({ row, labels, className }: Props) {
  const text = formatLastEdited(row, labels);
  if (!text) return null;
  return (
    <p className={className ?? "mt-0.5 text-[11px] text-ink-faint"}>{text}</p>
  );
}
