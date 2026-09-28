import { smoothPath } from "@/components/charts/path";

type Point = {
  label: string;
  primary: number;
  secondary?: number;
};

type Props = {
  points: Point[];
  primaryLabel?: string;
  secondaryLabel?: string;
  formatValue?: (n: number) => string;
  height?: number;
  emptyLabel?: string;
};

export function SmoothAreaChart({
  points,
  primaryLabel = "Series A",
  secondaryLabel = "Series B",
  formatValue = (n) => String(n),
  height = 220,
  emptyLabel = "No data for this period",
}: Props) {
  const width = 560;
  const padX = 8;
  const padTop = 16;
  const padBottom = 28;
  const chartH = height - padTop - padBottom;
  const chartW = width - padX * 2;

  const max = Math.max(
    ...points.flatMap((p) => [p.primary, p.secondary ?? 0]),
    0,
  );

  if (points.length === 0 || max <= 0) {
    return (
      <p className="py-10 text-center text-sm text-ink-muted">{emptyLabel}</p>
    );
  }

  const n = points.length;
  const xAt = (i: number) =>
    padX + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW);
  const yAt = (v: number) => padTop + chartH - (v / max) * chartH;

  const primaryPts = points.map((p, i) => ({ x: xAt(i), y: yAt(p.primary) }));
  const secondaryPts = points.map((p, i) => ({
    x: xAt(i),
    y: yAt(p.secondary ?? 0),
  }));
  const hasSecondary = points.some((p) => (p.secondary ?? 0) > 0);

  const primaryLine = smoothPath(primaryPts);
  const secondaryLine = smoothPath(secondaryPts);
  const base = padTop + chartH;
  const primaryArea = `${primaryLine} L ${primaryPts[n - 1]!.x} ${base} L ${primaryPts[0]!.x} ${base} Z`;
  const secondaryArea = `${secondaryLine} L ${secondaryPts[n - 1]!.x} ${base} L ${secondaryPts[0]!.x} ${base} Z`;

  const peakIdx = points.reduce(
    (best, p, i) => (p.primary > points[best]!.primary ? i : best),
    0,
  );

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Traffic area chart"
      >
        <defs>
          <linearGradient id="smoothPrimary" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#80bfec" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#80bfec" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="smoothSecondary" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffc952" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ffc952" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={padX}
            x2={width - padX}
            y1={yAt(max * t)}
            y2={yAt(max * t)}
            stroke="rgba(0,35,104,0.07)"
            strokeDasharray="4 6"
          />
        ))}

        <path d={primaryArea} fill="url(#smoothPrimary)" />
        {hasSecondary ? (
          <path d={secondaryArea} fill="url(#smoothSecondary)" />
        ) : null}

        <path
          d={primaryLine}
          fill="none"
          stroke="#002368"
          strokeWidth="2.75"
          strokeLinecap="round"
        />
        {hasSecondary ? (
          <path
            d={secondaryLine}
            fill="none"
            stroke="#e0a830"
            strokeWidth="2.25"
            strokeLinecap="round"
          />
        ) : null}

        {/* Peak callout like the reference tooltip */}
        <g>
          <circle
            cx={xAt(peakIdx)}
            cy={yAt(points[peakIdx]!.primary)}
            r="5"
            fill="#ffc952"
            stroke="#002368"
            strokeWidth="2"
          />
          <rect
            x={Math.min(Math.max(xAt(peakIdx) - 36, 4), width - 76)}
            y={yAt(points[peakIdx]!.primary) - 28}
            width="72"
            height="20"
            rx="10"
            fill="#002368"
          />
          <text
            x={Math.min(Math.max(xAt(peakIdx), 40), width - 40)}
            y={yAt(points[peakIdx]!.primary) - 14}
            textAnchor="middle"
            fill="white"
            fontSize="10"
            fontWeight="700"
          >
            {formatValue(points[peakIdx]!.primary)} · {points[peakIdx]!.label}
          </text>
        </g>

        {points.map((p, i) => (
          <text
            key={p.label}
            x={xAt(i)}
            y={height - 8}
            textAnchor="middle"
            fill="#646a74"
            fontSize="10"
            fontWeight="600"
          >
            {p.label}
          </text>
        ))}
      </svg>

      <div className="mt-1 flex flex-wrap gap-4 text-[11px] font-semibold text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-electric-blue" />
          {primaryLabel}
        </span>
        {hasSecondary ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-gold" />
            {secondaryLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
