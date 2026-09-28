type Pillar = {
  label: string;
  value: number;
  color: string;
};

type Props = {
  pillars: Pillar[];
  formatValue?: (n: number) => string;
  height?: number;
  emptyLabel?: string;
};

export function ComparePillars({
  pillars,
  formatValue = (n) => n.toLocaleString(),
  height = 170,
  emptyLabel = "No data for this period",
}: Props) {
  const max = Math.max(...pillars.map((p) => Math.abs(p.value)), 0);
  if (pillars.length === 0 || max <= 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-muted">{emptyLabel}</p>
    );
  }

  return (
    <div className="flex items-end justify-around gap-4 px-2" style={{ height }}>
      {pillars.map((p) => {
        const pct = Math.max(8, Math.round((Math.abs(p.value) / max) * 100));
        return (
          <div
            key={p.label}
            className="flex w-full max-w-[5.5rem] flex-col items-center justify-end gap-2"
            style={{ height: "100%" }}
          >
            <span className="text-center text-[11px] font-bold tabular-nums text-ink">
              {formatValue(p.value)}
            </span>
            <div
              className="relative w-full overflow-hidden rounded-t-2xl rounded-b-md shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
              style={{
                height: `${pct}%`,
                background: `linear-gradient(180deg, color-mix(in srgb, ${p.color} 75%, white) 0%, ${p.color} 100%)`,
              }}
              title={`${p.label}: ${formatValue(p.value)}`}
            >
              <span
                className="absolute inset-x-0 top-0 h-1/3 opacity-40"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.55), transparent)",
                }}
                aria-hidden
              />
            </div>
            <span className="text-center text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">
              {p.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
