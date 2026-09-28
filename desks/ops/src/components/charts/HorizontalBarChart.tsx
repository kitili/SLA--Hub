type Bar = {
  label: string;
  value: number;
  color?: string;
  meta?: string;
};

type Props = {
  bars: Bar[];
  formatValue?: (n: number) => string;
  maxValue?: number;
  emptyLabel?: string;
  showTrackMax?: boolean;
};

export function HorizontalBarChart({
  bars,
  formatValue = (n) => n.toLocaleString(),
  maxValue,
  emptyLabel = "No data for this period",
  showTrackMax = false,
}: Props) {
  const max = maxValue ?? Math.max(...bars.map((b) => b.value), 0);
  if (bars.length === 0 || max <= 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-muted">{emptyLabel}</p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {bars.map((bar, i) => {
        const pct = Math.min(100, Math.round((bar.value / max) * 1000) / 10);
        const fill = bar.color ?? "var(--electric-blue)";
        return (
          <li key={`${bar.label}-${i}`} className="min-w-0">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-bold text-ink">
                {bar.label}
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-muted">
                {formatValue(bar.value)}
                {bar.meta ? (
                  <span className="text-ink-faint"> · {bar.meta}</span>
                ) : null}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-light-blue-30/80">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${Math.max(pct, bar.value > 0 ? 2 : 0)}%`,
                  background: `linear-gradient(90deg, ${fill}, color-mix(in srgb, ${fill} 65%, white))`,
                }}
                title={`${bar.label}: ${formatValue(bar.value)}`}
              />
            </div>
            {showTrackMax ? (
              <p className="mt-0.5 text-[10px] text-ink-faint">
                of {formatValue(max)}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
