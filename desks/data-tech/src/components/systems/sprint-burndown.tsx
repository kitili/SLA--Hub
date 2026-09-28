import type { BurndownPoint } from "@/lib/task-types";

export function SprintBurndown({ points }: { points: BurndownPoint[] }) {
  if (points.length < 2) {
    return <p className="text-sm text-black/45">Set sprint start and end dates to see a burndown.</p>;
  }

  const width = 420;
  const height = 160;
  const pad = { l: 28, r: 8, t: 10, b: 22 };
  const max = Math.max(1, ...points.map((p) => Math.max(p.ideal, p.remaining)));
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;

  function x(i: number) {
    return pad.l + (i / (points.length - 1)) * innerW;
  }
  function y(value: number) {
    return pad.t + (1 - value / max) * innerH;
  }
  function line(key: "ideal" | "remaining") {
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(" ");
  }

  const last = points[points.length - 1]!;
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-md text-black">
        <path d={line("ideal")} fill="none" stroke="#94a3b8" strokeDasharray="4 3" strokeWidth="1.5" />
        <path d={line("remaining")} fill="none" stroke="#7B68EE" strokeWidth="2" />
        <text x={pad.l} y={12} className="fill-black/40" fontSize="10">
          {max}
        </text>
        <text x={pad.l} y={height - 6} className="fill-black/40" fontSize="10">
          {points[0]!.date.slice(5)}
        </text>
        <text x={width - 70} y={height - 6} className="fill-black/40" fontSize="10">
          {last.date.slice(5)}
        </text>
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-black/50">
        <span>Ideal (grey)</span>
        <span>Remaining (purple) · {last.remaining} left</span>
      </div>
    </div>
  );
}
