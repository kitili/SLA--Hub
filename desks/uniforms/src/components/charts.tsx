export type Slice = { label: string; value: number; color: string };

export const CHART = {
  navy: "#002368",
  navyLight: "#003a8c",
  blue: "#80bfec",
  gold: "#ffc952",
  green: "#167a37",
  red: "#b42318",
  silver: "#818283",
  pink: "#a61e4d",
  track: "#e8eef5",
};

function polar(cx: number, cy: number, r: number, angle: number) {
  const a = ((angle - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
}

function wedge(cx: number, cy: number, r: number, start: number, end: number) {
  if (end - start >= 359.99) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
  }
  const [x1, y1] = polar(cx, cy, r, start);
  const [x2, y2] = polar(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

function ring(cx: number, cy: number, outer: number, inner: number, start: number, end: number) {
  if (end - start >= 359.99) {
    return [
      `M ${cx} ${cy - outer} A ${outer} ${outer} 0 1 1 ${cx - 0.01} ${cy - outer}`,
      `M ${cx} ${cy - inner} A ${inner} ${inner} 0 1 0 ${cx - 0.01} ${cy - inner}`,
    ].join(" ");
  }
  const [x1, y1] = polar(cx, cy, outer, start);
  const [x2, y2] = polar(cx, cy, outer, end);
  const [x3, y3] = polar(cx, cy, inner, end);
  const [x4, y4] = polar(cx, cy, inner, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${outer} ${outer} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`;
}

function totalOf(slices: Slice[]) {
  return slices.reduce((s, x) => s + Math.max(0, x.value), 0);
}

export function Legend({
  slices,
  format = (n) => String(n),
}: {
  slices: Slice[];
  format?: (n: number) => string;
}) {
  const total = totalOf(slices);
  return (
    <ul className="grid gap-1.5 text-sm">
      {slices.map((slice) => (
        <li key={slice.label} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 min-w-0">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
            <span className="truncate text-ink-muted">{slice.label}</span>
          </span>
          <span className="tabular-nums font-semibold text-electric-blue">
            {format(slice.value)}
            {total ? <span className="ml-1 font-normal text-ink-muted">{Math.round((slice.value / total) * 100)}%</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PieChart({ slices, size = 168 }: { slices: Slice[]; size?: number }) {
  const total = totalOf(slices);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  let cursor = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {total === 0 ? (
        <circle cx={cx} cy={cy} r={r} fill={CHART.track} />
      ) : (
        slices.map((slice) => {
          const sweep = (Math.max(0, slice.value) / total) * 360;
          const start = cursor;
          cursor += sweep;
          return <path key={slice.label} d={wedge(cx, cy, r, start, start + sweep)} fill={slice.color} />;
        })
      )}
    </svg>
  );
}

export function DonutChart({
  slices,
  size = 168,
  label,
  sub,
}: {
  slices: Slice[];
  size?: number;
  label?: string;
  sub?: string;
}) {
  const total = totalOf(slices);
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 4;
  const inner = outer * 0.58;
  let cursor = 0;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="absolute inset-0">
        <circle cx={cx} cy={cy} r={(outer + inner) / 2} fill="none" stroke={CHART.track} strokeWidth={outer - inner} />
        {total > 0
          ? slices.map((slice) => {
              const sweep = (Math.max(0, slice.value) / total) * 360;
              const start = cursor;
              cursor += sweep;
              if (sweep <= 0) return null;
              return <path key={slice.label} d={ring(cx, cy, outer, inner, start, start + sweep)} fill={slice.color} />;
            })
          : null}
      </svg>
      {label ? (
        <div className="relative text-center px-3">
          <p className="font-display text-xl font-extrabold leading-none text-electric-blue">{label}</p>
          {sub ? <p className="mt-1 text-[11px] text-ink-muted">{sub}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function Gauge({
  value,
  label,
  size = 140,
}: {
  value: number;
  label: string;
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const start = -110;
  const span = 220;
  const end = start + (clamped / 100) * span;
  const cx = size / 2;
  const cy = size * 0.62;
  const r = size * 0.42;
  const color = clamped >= 70 ? CHART.green : clamped >= 40 ? CHART.gold : CHART.red;
  return (
    <div className="grid place-items-center">
      <svg width={size} height={size * 0.78} viewBox={`0 0 ${size} ${size * 0.78}`} aria-hidden="true">
        <path d={ring(cx, cy, r, r - 12, start, start + span)} fill={CHART.track} />
        {clamped > 0 ? <path d={ring(cx, cy, r, r - 12, start, end)} fill={color} /> : null}
      </svg>
      <p className="-mt-8 font-display text-2xl font-extrabold text-electric-blue">{clamped}%</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  );
}

export function VBars({
  rows,
  height = 180,
}: {
  rows: { label: string; value: number; color?: string }[];
  height?: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const gap = 8;
  const barW = 28;
  const width = Math.max(200, rows.length * (barW + gap) + 20);
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      {rows.map((row, i) => {
        const h = Math.round((row.value / max) * (height - 36));
        const x = 12 + i * (barW + gap);
        const y = height - 22 - h;
        return (
          <g key={row.label}>
            <rect x={x} y={y} width={barW} height={Math.max(h, 0)} rx={6} fill={row.color ?? CHART.navy} />
            <text x={x + barW / 2} y={height - 8} textAnchor="middle" fill="#4f555f" fontSize="9">
              {row.label.length > 8 ? `${row.label.slice(0, 7)}…` : row.label}
            </text>
            <text x={x + barW / 2} y={y - 4} textAnchor="middle" fill="#002368" fontSize="10" fontWeight="700">
              {row.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function HBars({
  rows,
  format = (n) => String(n),
}: {
  rows: { label: string; value: number; color?: string }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-2 text-sm">
          <span className="truncate text-ink-muted">{row.label}</span>
          <div className="h-3 overflow-hidden rounded-full bg-[#e8eef5]">
            <div
              className="h-3 rounded-full"
              style={{ width: `${Math.round((row.value / max) * 100)}%`, background: row.color ?? CHART.navy }}
            />
          </div>
          <span className="tabular-nums font-semibold text-electric-blue">{format(row.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function StackedHBars({
  rows,
  aLabel,
  bLabel,
  format = (n) => String(n),
}: {
  rows: { label: string; a: number; b: number }[];
  aLabel: string;
  bLabel: string;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.a + r.b));
  return (
    <div className="grid gap-3">
      {rows.map((row) => {
        const aPct = Math.round((row.a / max) * 100);
        const bPct = Math.round((row.b / max) * 100);
        return (
          <div key={row.label}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-semibold">{row.label}</span>
              <span className="text-ink-muted">
                {format(row.a)} / {format(row.b)}
              </span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-[#e8eef5]">
              <div className="h-3" style={{ width: `${aPct}%`, background: CHART.green }} />
              <div className="h-3" style={{ width: `${bPct}%`, background: CHART.gold }} />
            </div>
          </div>
        );
      })}
      <p className="text-xs text-ink-muted">
        <span className="mr-3 inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: CHART.green }} />{aLabel}</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: CHART.gold }} />{bLabel}</span>
      </p>
    </div>
  );
}
