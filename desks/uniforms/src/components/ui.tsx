import { Children, type ReactNode } from "react";
import Link from "next/link";
import { tzs } from "@/lib/money";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-light-blue">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-electric-blue">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[14px] border border-card-border bg-white p-5 shadow-[var(--shadow)] ${className}`}
    >
      {children}
    </section>
  );
}

export function Badge({ children, tone = "leaf" }: { children: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    leaf: "bg-success-15 text-success",
    gold: "bg-gold-15 text-[#8a6d00]",
    blue: "bg-light-blue-30 text-electric-blue",
    pink: "bg-[#fff0f6] text-[#a61e4d]",
    grey: "bg-gray text-ink-muted",
    red: "bg-danger-15 text-danger",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone] ?? tones.leaf}`}>
      {children}
    </span>
  );
}

export function statusTone(status: string) {
  if (["PAID", "CLOSED", "DONE", "FULFILLED"].includes(status)) return "leaf";
  if (["PARTIAL", "SENT", "IN_PROGRESS", "OPEN"].includes(status)) return "gold";
  if (["ORDERED", "DRAFT", "QUEUED"].includes(status)) return "blue";
  if (["CANCELLED"].includes(status)) return "pink";
  return "grey";
}

export function Money({ amount }: { amount: number }) {
  return <span className="tabular-nums">{tzs(amount)}</span>;
}

export function Table({
  headers,
  children,
  emptyLabel = "No records yet.",
}: {
  headers: string[];
  children: ReactNode;
  emptyLabel?: string;
}) {
  const isEmpty = Children.count(children) === 0;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-card-border text-xs uppercase tracking-wide text-ink-muted">
            {headers.map((h) => (
              <th key={h} className="px-2 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-card-border">
          {isEmpty ? (
            <tr>
              <td colSpan={headers.length}>
                <Empty>{emptyLabel}</Empty>
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export { Btn, Field, ghostClass, inputClass } from "./forms";
export { Flash } from "./flash";
export { LinesEditor, SkuSizeFields, StudentLookup } from "./lines-editor";

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-ink-muted">{children}</p>;
}

export function Pager({
  page,
  totalPages,
  params = {},
}: {
  page: number;
  totalPages: number;
  params?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const link = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v);
    }
    sp.set("page", String(p));
    return `?${sp.toString()}`;
  };

  const btn = (enabled: boolean) =>
    enabled
      ? "rounded-[10px] border border-card-border bg-white px-3 py-1.5 text-sm font-semibold text-electric-blue no-underline hover:bg-light-blue-30"
      : "pointer-events-none rounded-[10px] border border-card-border bg-white px-3 py-1.5 text-sm font-semibold text-ink-muted opacity-50";

  return (
    <div className="mt-3 flex items-center justify-between gap-3 text-sm">
      <Link href={link(Math.max(1, page - 1))} aria-disabled={page <= 1} className={btn(page > 1)}>
        Prev
      </Link>
      <span className="text-ink-muted">
        Page {page} of {totalPages}
      </span>
      <Link
        href={link(Math.min(totalPages, page + 1))}
        aria-disabled={page >= totalPages}
        className={btn(page < totalPages)}
      >
        Next
      </Link>
    </div>
  );
}
