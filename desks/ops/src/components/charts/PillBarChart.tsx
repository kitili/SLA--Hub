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
  highlightIndex?: number;
};

export function PillBarChart({
  bars,
  formatValue = (n) => String(n),
  height = 180,
  emptyLabel = "No data for this period",
  highlightIndex,
}: Props) {
  const max = Math.max(...bars.map((b) => b.value), 0);
  if (bars.length === 0 || max <= 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-muted">{emptyLabel}</p>
    );
  }

  return (
    <div className="flex items-end gap-2.5 px-1" style={{ height }}>
      {bars.map((bar, i) => {
        const pct = Math.max(10, Math.round((bar.value / max) * 100));
        const active = highlightIndex === i;
        const fill = bar.color ?? "var(--electric-blue)";
        return (
          <div
            key={`${bar.label}-${i}`}
            className="group relative flex min-w-0 flex-1 flex-col items-center justify-end gap-2"
            style={{ height: "100%" }}
            title={`${bar.label}: ${formatValue(bar.value)}`}
          >
            <span
              className={`pointer-events-none absolute -top-1 translate-y-[-100%] rounded-lg px-2 py-1 text-[10px] font-bold text-white opacity-0 shadow-md transition group-hover:opacity-100 ${
                active ? "opacity-100" : ""
              }`}
              style={{ background: fill }}
            >
              {formatValue(bar.value)}
            </span>
            <div
              className="w-[55%] max-w-[2.25rem] rounded-full transition-[height,filter] duration-500"
              style={{
                height: `${pct}%`,
                background: `linear-gradient(180deg, color-mix(in srgb, ${fill} 55%, white) 0%, ${fill} 100%)`,
                filter: active ? "brightness(1.08)" : undefined,
                boxShadow: active
                  ? "0 8px 18px rgba(0, 35, 104, 0.22)"
                  : "0 4px 12px rgba(0, 35, 104, 0.1)",
              }}
            />
            <span className="w-full truncate text-center text-[10px] font-semibold text-ink-faint">
              {bar.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
