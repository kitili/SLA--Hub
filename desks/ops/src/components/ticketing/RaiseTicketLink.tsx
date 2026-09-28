import Link from "next/link";
import {
  ticketingHref,
  type OpsTicketDomainId,
  type TicketingDeepLink,
} from "@/lib/ops-departments";

type Props = {
  domain: OpsTicketDomainId;
  label?: string;
  className?: string;
} & Omit<TicketingDeepLink, "domain" | "department" | "viaOps">;

export function RaiseTicketLink({
  domain,
  label = "Raise ticket",
  className,
  action = "new",
  ...draft
}: Props) {
  const href = ticketingHref({ domain, action, viaOps: true, ...draft });
  return (
    <Link
      href={href}
      className={
        className ??
        "rounded-[var(--radius-sm)] border border-electric-blue bg-electric-blue px-3 py-1.5 text-sm font-semibold text-white no-underline shadow-[var(--shadow)] hover:opacity-95"
      }
    >
      {label}
    </Link>
  );
}
