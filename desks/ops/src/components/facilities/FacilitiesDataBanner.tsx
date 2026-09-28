type Props = {
  error?: string | null;
  empty?: boolean;
  emptyHint?: string;
  rowCount?: number;
};

export function FacilitiesDataBanner({ error, empty, emptyHint, rowCount }: Props) {
  if (error) {
    return (
      <p className="mb-4 rounded-[var(--radius-sm)] border border-danger/40 bg-danger-15 px-4 py-3 text-sm text-ink">
        Facilities data could not be loaded: <span className="font-semibold">{error}</span>.
        If you are finance/ops (not admin), run{" "}
        <code className="text-xs">supabase/APPLY_FACILITIES_ACCESS.sql</code> in the Supabase
        SQL editor, then hard-refresh.
      </p>
    );
  }
  if (empty) {
    return (
      <p className="mb-4 rounded-[var(--radius-sm)] border border-gold/40 bg-gold-15 px-4 py-3 text-sm text-ink-muted">
        {emptyHint ?? "Nothing logged here yet."}
        {typeof rowCount === "number" ? ` (count=${rowCount})` : null}
      </p>
    );
  }
  return null;
}
