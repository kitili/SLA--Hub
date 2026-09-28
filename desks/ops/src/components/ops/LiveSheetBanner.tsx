type Props = {
  domain: "Farm" | "Kitchen" | "Facilities" | "Ticketing";
  detail?: string;
};

/** Marks the Ops surface as the system-of-record live sheet for a domain. */
export function LiveSheetBanner({ domain, detail }: Props) {
  return (
    <div className="mb-4 rounded-[var(--radius-sm)] border border-success/30 bg-success-15 px-3 py-2 text-sm text-ink">
      <span className="font-bold text-success">Live sheet · {domain}</span>
      <span className="text-ink-muted">
        {" "}
        — {detail ?? "Ops is the source of truth. Excel/Google masters are for one-time import only."}
      </span>
    </div>
  );
}
