import Link from "next/link";
import { getOpsDomain, type OpsDomainId } from "@/lib/ops-domains";

export function DomainSkeleton({
  domainId,
  children,
}: {
  domainId: OpsDomainId;
  children?: React.ReactNode;
}) {
  const domain = getOpsDomain(domainId);
  if (!domain) return null;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">{domain.name}</h1>
          <p className="mt-2 max-w-xl text-ink-muted">{domain.blurb}</p>
        </div>
        <Link
          href="/"
          className="text-sm font-semibold text-electric-blue no-underline hover:underline"
        >
          ← Dashboards
        </Link>
      </div>

      {children}

      {domain.status === "skeleton" ? (
        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          {["Overview", "Work queue", "Reports"].map((label) => (
            <div
              key={label}
              className="rounded-[var(--radius-sm)] border border-dashed border-electric-blue/25 bg-white/70 px-4 py-10 text-center text-sm font-semibold text-ink-faint"
            >
              {label}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
