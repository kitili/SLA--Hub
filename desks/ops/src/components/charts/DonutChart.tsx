type Slice = {
  label: string;
  value: number;
  color: string;
};

type Props = {
  slices: Slice[];
  centerLabel?: string;
  centerValue?: string;
  formatValue?: (n: number) => string;
  size?: number;
  thickness?: number;
  emptyLabel?: string;
};

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number,
) {
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const o1 = polar(cx, cy, rOuter, startDeg);
  const o2 = polar(cx, cy, rOuter, endDeg);
  const i2 = polar(cx, cy, rInner, endDeg);
  const i1 = polar(cx, cy, rInner, startDeg);
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i2.x} ${i2.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${i1.x} ${i1.y}`,
    "Z",
  ].join(" ");
}

export function DonutChart({
  slices,
  centerLabel,
  centerValue,
  formatValue = (n) => n.toLocaleString(),
  size = 168,
  thickness = 14,
  emptyLabel = "No data for this period",
}: Props) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (slices.length === 0 || total <= 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-muted">{emptyLabel}</p>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.42;
  const rInner = rOuter - thickness;
  let cursor = 0;

  const arcs = slices
    .filter((s) => s.value > 0)
    .map((slice) => {
      const sweep = (slice.value / total) * 360;
      const start = cursor;
      const end = cursor + Math.max(sweep, 0.8);
      cursor += sweep;
      return { ...slice, start, end, sweep };
    });

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <circle
            cx={cx}
            cy={cy}
            r={(rOuter + rInner) / 2}
            fill="none"
            stroke="rgba(0,35,104,0.06)"
            strokeWidth={thickness}
          />
          {arcs.map((arc) =>
            arc.sweep >= 359.5 ? (
              <circle
                key={arc.label}
                cx={cx}
                cy={cy}
                r={(rOuter + rInner) / 2}
                fill="none"
                stroke={arc.color}
                strokeWidth={thickness}
                strokeLinecap="round"
              >
                <title>{`${arc.label}: ${formatValue(arc.value)}`}</title>
              </circle>
            ) : (
              <path
                key={arc.label}
                d={arcPath(
                  cx,
                  cy,
                  rOuter,
                  rInner,
                  arc.start,
                  Math.min(arc.end, arc.start + 359.99),
                )}
                fill={arc.color}
              >
                <title>{`${arc.label}: ${formatValue(arc.value)}`}</title>
              </path>
            ),
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {centerValue ? (
            <p className="font-display text-2xl font-extrabold tracking-tight text-ink">
              {centerValue}
            </p>
          ) : null}
          {centerLabel ? (
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              {centerLabel}
            </p>
          ) : null}
        </div>
      </div>

      <ul className="flex w-full flex-col gap-2.5 text-xs">
        {slices.map((slice) => {
          const pct = Math.round((slice.value / total) * 1000) / 10;
          return (
            <li
              key={slice.label}
              className="flex items-center justify-between gap-3 border-b border-card-border/60 pb-2 last:border-0 last:pb-0"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                  aria-hidden
                />
                <span className="truncate font-semibold text-ink">
                  {slice.label}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-ink-muted">
                <span className="font-bold text-ink">{formatValue(slice.value)}</span>
                <span className="ml-1.5 text-ink-faint">{pct}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
