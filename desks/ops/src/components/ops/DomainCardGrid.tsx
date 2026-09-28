import Link from "next/link";
import { OPS_DOMAINS, type OpsDomainId } from "@/lib/ops-domains";
import type { Role } from "@/lib/roles";

type Props = {
  className?: string;
  /** When set, hide domains this role should not open from the hub. */
  role?: Role | null;
};

function domainsForRole(role?: Role | null): OpsDomainId[] | null {
  if (!role || role === "admin" || role === "finance") return null;
  if (role === "ops_manager") {
    return ["kitchen", "facilities", "farm"];
  }
  if (role === "finance_manager" || role === "cfo") {
    return ["kitchen", "facilities"];
  }
  return null;
}

export function DomainCardGrid({ className = "", role = null }: Props) {
  const allowed = domainsForRole(role);
  const domains = allowed
    ? OPS_DOMAINS.filter((d) => allowed.includes(d.id))
    : OPS_DOMAINS;

  return (
    <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className}`.trim()}>
      {domains.map((domain) => (
        <article
          key={domain.id}
          className="rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)]"
        >
          <Link href={domain.href} className="group block no-underline">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-xl font-bold text-ink group-hover:text-electric-blue">
                {domain.name}
              </h2>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  domain.status === "live"
                    ? "bg-success-15 text-success"
                    : "bg-gold-15 text-ink-muted"
                }`}
              >
                {domain.status === "live" ? "Live" : "Skeleton"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{domain.blurb}</p>
          </Link>
          <div className="mt-4">
            <Link
              href={domain.href}
              className="text-sm font-semibold text-electric-blue no-underline hover:underline"
            >
              Open
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
