export function WeeklySnapshotStrip({
  weekStart,
  workDate,
  totals,
}: {
  weekStart: string;
  workDate: string;
  totals: { filed: number; expected: number; slotsDone: number; slots: number; projects: number; projectPct: number };
}) {
  const filedPct = totals.expected ? Math.round((totals.filed / totals.expected) * 100) : 0;
  const donePct = totals.slots ? Math.round((totals.slotsDone / totals.slots) * 100) : 0;
  return (
    <div className="rounded-lg bg-navy p-6 text-white shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/60">Weekly snapshot</p>
          <h2 className="text-lg font-medium">Silverleaf academy progress</h2>
          <p className="text-sm text-white/70">
            {weekStart} → {workDate}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SnapshotStat label="1–5s filed" value={`${totals.filed}/${totals.expected || 0}`} pct={filedPct} />
        <SnapshotStat label="1–5s closed this week" value={`${totals.slotsDone}/${totals.slots || 0}`} pct={donePct} />
        <SnapshotStat label="Project boards" value={`${totals.projectPct}%`} pct={totals.projectPct} hint={`${totals.projects} live projects`} />
      </div>
    </div>
  );
}

function SnapshotStat({ label, value, pct, hint }: { label: string; value: string; pct: number; hint?: string }) {
  return (
    <div>
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-1 text-2xl font-medium">{value}</div>
      {hint && <div className="text-xs text-white/50">{hint}</div>}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-gold-accent" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}
