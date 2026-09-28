import { smoothPath } from "@/components/charts/path";

type Props = {
  label: string;
  value: string;
  deltaPct?: number | null;
  deltaLabel?: string;
  series: number[];
  tone?: "blue" | "sky" | "gold" | "success" | "danger";
  hint?: string;
};

const TONES = {
  blue: {
    stroke: "#002368",
    fillFrom: "rgba(0, 35, 104, 0.28)",
    fillTo: "rgba(0, 35, 104, 0.02)",
    deltaUp: "text-electric-blue",
    deltaDown: "text-danger",
  },
  sky: {
    stroke: "#4aa3d9",
    fillFrom: "rgba(128, 191, 236, 0.45)",
    fillTo: "rgba(128, 191, 236, 0.02)",
    deltaUp: "text-electric-blue",
    deltaDown: "text-danger",
  },
  gold: {
    stroke: "#e0a830",
    fillFrom: "rgba(255, 201, 82, 0.5)",
    fillTo: "rgba(255, 201, 82, 0.02)",
    deltaUp: "text-electric-blue",
    deltaDown: "text-danger",
  },
  success: {
    stroke: "#167a37",
    fillFrom: "rgba(22, 122, 55, 0.35)",
    fillTo: "rgba(22, 122, 55, 0.02)",
    deltaUp: "text-success",
    deltaDown: "text-danger",
  },
  danger: {
    stroke: "#b42318",
    fillFrom: "rgba(180, 35, 24, 0.3)",
    fillTo: "rgba(180, 35, 24, 0.02)",
    deltaUp: "text-success",
    deltaDown: "text-danger",
  },
} as const;

export function SparklineMetricCard({
  label,
  value,
  deltaPct,
  deltaLabel = "vs prior",
  series,
  tone = "blue",
  hint,
}: Props) {
  const t = TONES[tone];
  const width = 160;
  const height = 52;
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const span = Math.max(max - min, 1);
  const pts = series.map((v, i) => ({
    x: series.length === 1 ? width / 2 : (i / (series.length - 1)) * width,
    y: height - ((v - min) / span) * (height - 6) - 3,
  }));
  const line = smoothPath(pts);
  const area =
    pts.length > 0
      ? `${line} L ${pts[pts.length - 1]!.x} ${height} L ${pts[0]!.x} ${height} Z`
      : "";
  const gid = `spark-${label.replace(/\W+/g, "-").toLowerCase()}-${tone}`;

  return (
    <article className="ui-panel flex flex-col justify-between overflow-hidden p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">
          {label}
        </p>
        {deltaPct != null ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
              deltaPct >= 0
                ? "bg-success-15 text-success"
                : "bg-danger-15 text-danger"
            }`}
          >
            {deltaPct >= 0 ? "+" : ""}
            {deltaPct}%
          </span>
        ) : null}
      </div>

      <p className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink">
        {value}
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-3 h-12 w-full"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.fillFrom} />
            <stop offset="100%" stopColor={t.fillTo} />
          </linearGradient>
        </defs>
        {area ? <path d={area} fill={`url(#${gid})`} /> : null}
        {line ? (
          <path
            d={line}
            fill="none"
            stroke={t.stroke}
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </svg>

      <p className="mt-1 text-[11px] text-ink-faint">
        {hint ?? (deltaPct != null ? deltaLabel : "Period to date")}
      </p>
    </article>
  );
}
