type Campus = {
  name: string;
  students: number;
  capacity: number;
  dbStudents: number;
  dbBuses: number;
};

type Props = {
  campuses: Campus[];
};

export function CampusOccupancyChart({ campuses }: Props) {
  const maxStudents = Math.max(...campuses.map((c) => c.students), 1);

  return (
    <div className="ui-panel h-full p-5">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-ink">Campus occupancy</h3>
          <p className="mt-0.5 text-xs text-ink-faint">
            Sheet riders vs seats · pages-style rank
          </p>
        </div>
      </div>

      <ul className="mt-5 space-y-4">
        {campuses.map((c) => {
          const pct =
            c.capacity > 0
              ? Math.round((c.students / c.capacity) * 1000) / 10
              : 0;
          const barPct = Math.round((c.students / maxStudents) * 100);
          const over = pct > 100;
          const color = over
            ? "var(--danger)"
            : pct > 85
              ? "var(--gold)"
              : "var(--electric-blue)";

          return (
            <li key={c.name}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{c.name}</p>
                <p className="text-xs tabular-nums text-ink-muted">
                  <span className="font-bold text-ink">
                    {c.students.toLocaleString()}
                  </span>
                  <span className="text-ink-faint">
                    {" "}
                    / {c.capacity.toLocaleString()}
                  </span>
                  <span
                    className={`ml-2 font-bold ${
                      over ? "text-danger" : "text-electric-blue"
                    }`}
                  >
                    {pct}%
                  </span>
                </p>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(0,35,104,0.06)]">
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{
                    width: `${Math.max(barPct, c.students > 0 ? 4 : 0)}%`,
                    background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 65%, white))`,
                  }}
                />
              </div>
              <p className="mt-1 text-[10px] text-ink-faint">
                DB {c.dbStudents} students · {c.dbBuses} buses
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
