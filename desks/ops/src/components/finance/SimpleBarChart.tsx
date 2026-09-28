type Bar = {
  label: string;
  value: number;
  color?: string;
};

type Props = {
  bars: Bar[];
  formatValue?: (n: number) => string;
  height?: number;
  emptyLabel?: string;
};

export function SimpleBarChart({
  bars,
  formatValue = (n) => n.toLocaleString(),
  height = 160,
  emptyLabel = "No data for this period",
}: Props) {
  const max = Math.max(...bars.map((b) => b.value), 0);
  if (bars.length === 0 || max <= 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-muted">{emptyLabel}</p>
    );
  }

  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {bars.map((bar) => {
        const pct = Math.max(4, Math.round((bar.value / max) * 100));
        return (
          <div
            key={bar.label}
            className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
            style={{ height: "100%" }}
            title={`${bar.label}: ${formatValue(bar.value)}`}
          >
            <span className="truncate text-[10px] font-semibold text-ink-muted">
              {formatValue(bar.value)}
            </span>
            <div
              className="w-full max-w-[3rem] rounded-t-[6px] transition-[height]"
              style={{
                height: `${pct}%`,
                backgroundColor: bar.color ?? "var(--electric-blue)",
              }}
            />
            <span className="w-full truncate text-center text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              {bar.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
