type Point = {
  label: string;
  value: number;
  secondary?: number;
};

type Props = {
  points: Point[];
  formatValue?: (n: number) => string;
  height?: number;
  primaryLabel?: string;
  secondaryLabel?: string;
  emptyLabel?: string;
};

export function AreaTrendChart({
  points,
  formatValue = (n) => String(n),
  height = 180,
  primaryLabel = "Total",
  secondaryLabel,
  emptyLabel = "No data for this period",
}: Props) {
  const width = 420;
  const padX = 12;
  const padTop = 18;
  const padBottom = 28;
  const chartH = height - padTop - padBottom;
  const chartW = width - padX * 2;

  const max = Math.max(
    ...points.flatMap((p) => [p.value, p.secondary ?? 0]),
    0,
  );

  if (points.length === 0 || max <= 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-muted">{emptyLabel}</p>
    );
  }

  const n = points.length;
  const xAt = (i: number) =>
    padX + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW);
  const yAt = (v: number) => padTop + chartH - (v / max) * chartH;

  function linePath(values: number[]) {
    return values
      .map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`)
      .join(" ");
  }

  function areaPath(values: number[]) {
    const line = linePath(values);
    const lastX = xAt(n - 1);
    const firstX = xAt(0);
    const base = padTop + chartH;
    return `${line} L ${lastX.toFixed(1)} ${base} L ${firstX.toFixed(1)} ${base} Z`;
  }

  const primary = points.map((p) => p.value);
  const secondary = points.map((p) => p.secondary ?? 0);
  const hasSecondary = points.some((p) => (p.secondary ?? 0) > 0);

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Trend chart"
      >
        <defs>
          <linearGradient id="areaPrimary" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--light-blue)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--light-blue)" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="areaSecondary" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={padX}
            x2={width - padX}
            y1={yAt(max * t)}
            y2={yAt(max * t)}
            stroke="var(--card-border)"
            strokeDasharray="3 4"
          />
        ))}

        <path d={areaPath(primary)} fill="url(#areaPrimary)" />
        {hasSecondary ? (
          <path d={areaPath(secondary)} fill="url(#areaSecondary)" />
        ) : null}

        <path
          d={linePath(primary)}
          fill="none"
          stroke="var(--electric-blue)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {hasSecondary ? (
          <path
            d={linePath(secondary)}
            fill="none"
            stroke="var(--gold)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="5 4"
          />
        ) : null}

        {points.map((p, i) => (
          <g key={p.label}>
            <circle
              cx={xAt(i)}
              cy={yAt(p.value)}
              r="4"
              fill="var(--gold)"
              stroke="var(--electric-blue)"
              strokeWidth="1.5"
            >
              <title>{`${p.label}: ${formatValue(p.value)}`}</title>
            </circle>
            <text
              x={xAt(i)}
              y={height - 8}
              textAnchor="middle"
              className="fill-[var(--ink-faint)]"
              fontSize="10"
              fontWeight="600"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-1 flex flex-wrap gap-3 text-[11px] font-semibold text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-electric-blue" aria-hidden />
          {primaryLabel}
        </span>
        {hasSecondary && secondaryLabel ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-0.5 w-4 rounded bg-gold"
              style={{ borderTop: "1px dashed transparent" }}
              aria-hidden
            />
            {secondaryLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
