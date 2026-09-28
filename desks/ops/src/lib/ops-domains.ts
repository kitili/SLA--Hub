export type OpsDomainId =
  | "transport"
  | "ticketing"
  | "farm"
  | "kitchen"
  | "facilities";

export type OpsDomainStatus = "live" | "skeleton";

export type OpsDomain = {
  id: OpsDomainId;
  name: string;
  href: string;
  blurb: string;
  status: OpsDomainStatus;
};

/** Hub cards — skeletons are ready for teams to build into. */
export const OPS_DOMAINS: OpsDomain[] = [
  {
    id: "ticketing",
    name: "Ticketing",
    href: "/ops/ticketing",
    blurb:
      "One desk for everyone — open a ticket here and choose Transport, Facilities, Kitchen, Security, or Farms on the form.",
    status: "live",
  },
  {
    id: "transport",
    name: "Transport",
    href: "/transport",
    blurb: "Fleet, boarding, routes, and finance.",
    status: "live",
  },
  {
    id: "farm",
    name: "Farm",
    href: "/farm",
    blurb: "Usa River plots, schedule, expenses, harvests, and walkthroughs.",
    status: "live",
  },
  {
    id: "facilities",
    name: "Facilities",
    href: "/ops/facilities",
    blurb: "R&M, checklist, generator, housing, power, CCTV, and SOPs — Usa River sheet live.",
    status: "live",
  },
  {
    id: "kitchen",
    name: "Kitchen",
    href: "/ops/kitchen/dashboard",
    blurb: "Leadership KPIs, compliance, surveys, and procurement vs budget.",
    status: "live",
  },
];

export function getOpsDomain(id: OpsDomainId): OpsDomain | undefined {
  return OPS_DOMAINS.find((d) => d.id === id);
}
