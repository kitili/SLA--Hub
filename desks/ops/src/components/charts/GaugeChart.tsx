type Gauge = {
  label: string;
  value: number;
  color?: string;
  detail?: string;
};

type Props = {
  gauges: Gauge[];
  emptyLabel?: string;
  unit?: string;
};

function ringPath(cx: number, cy: number, r: number, pct: number) {
  const clamped = Math.max(0, Math.min(100, pct));
  const start = -120;
  const sweep = (clamped / 100) * 240;
  const end = start + sweep;
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(start));
  const y1 = cy + r * Math.sin(toRad(start));
  const x2 = cx + r * Math.cos(toRad(end));
  const y2 = cy + r * Math.sin(toRad(end));
  const large = sweep > 180 ? 1 : 0;
  if (clamped <= 0) return "";
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

function trackPath(cx: number, cy: number, r: number) {
  const start = -120;
  const end = 120;
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(start));
  const y1 = cy + r * Math.sin(toRad(start));
  const x2 = cx + r * Math.cos(toRad(end));
  const y2 = cy + r * Math.sin(toRad(end));
  return `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`;
}

export function GaugeChart({
  gauges,
  emptyLabel = "No budgets overlap this period",
  unit = "%",
}: Props) {
  if (gauges.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-muted">{emptyLabel}</p>
    );
  }

  return (
    <div
      className={`grid gap-4 ${
        gauges.length === 1
          ? "grid-cols-1"
          : gauges.length === 2
            ? "grid-cols-2"
            : "grid-cols-2 sm:grid-cols-3"
      }`}
    >
      {gauges.map((g) => {
        const color =
          g.color ??
          (g.value > 90
            ? "var(--danger)"
            : g.value > 70
              ? "var(--gold)"
              : "var(--light-blue)");
        const size = 112;
        const cx = size / 2;
        const cy = size / 2 + 6;
        const r = 38;
        const fill = ringPath(cx, cy, r, g.value);

        return (
          <div key={g.label} className="flex flex-col items-center text-center">
            <svg width={size} height={size - 8} viewBox={`0 0 ${size} ${size}`} aria-hidden>
              <path
                d={trackPath(cx, cy, r)}
                fill="none"
                stroke="var(--light-blue-30)"
                strokeWidth="10"
                strokeLinecap="round"
              />
              {fill ? (
                <path
                  d={fill}
                  fill="none"
                  stroke={color}
                  strokeWidth="10"
                  strokeLinecap="round"
                />
              ) : null}
              <text
                x={cx}
                y={cy + 4}
                textAnchor="middle"
                fontSize="18"
                fontWeight="800"
                fill="var(--electric-blue)"
              >
                {Math.round(g.value)}
                {unit}
              </text>
            </svg>
            <p className="mt-1 max-w-[8rem] truncate text-xs font-bold text-ink">
              {g.label}
            </p>
            {g.detail ? (
              <p className="mt-0.5 max-w-[9rem] text-[10px] text-ink-faint">
                {g.detail}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
