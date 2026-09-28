import type { TripWithBus } from "@/types/database";

export type OccupancyRow = {
  tripId: string;
  busLabel: string;
  direction: string;
  aboard: number;
  capacity: number;
  pct: number;
  overCapacity: boolean;
};

export function buildOccupancyRows(
  trips: TripWithBus[],
  capacityByBusId: Map<string, number>,
): OccupancyRow[] {
  return trips
    .filter((t) => t.status === "active" || t.status === "scheduled")
    .map((trip) => {
      const capacity = capacityByBusId.get(trip.bus_id) ?? 0;
      const pct =
        capacity > 0 ? Math.round((trip.aboard_count / capacity) * 100) : 0;
      return {
        tripId: trip.id,
        busLabel: trip.bus_label,
        direction: trip.direction,
        aboard: trip.aboard_count,
        capacity,
        pct,
        overCapacity: capacity > 0 && trip.aboard_count > capacity,
      };
    });
}

/** Banner listing trips over capacity (Day 11 occupancy alarms). */
export function OccupancyAlarmBanner({ rows }: { rows: OccupancyRow[] }) {
  const alarms = rows.filter((r) => r.overCapacity);
  if (alarms.length === 0) return null;

  return (
    <div
      role="alert"
      className="rounded-[var(--radius)] border border-danger/40 bg-danger-15 px-4 py-3"
    >
      <p className="text-sm font-bold text-danger">Occupancy alarm</p>
      <ul className="mt-2 flex flex-col gap-1 text-sm text-danger">
        {alarms.map((row) => (
          <li key={row.tripId}>
            <span className="font-semibold">{row.busLabel}</span>{" "}
            ({row.direction.toUpperCase()}) is over capacity — {row.aboard}/
            {row.capacity} ({row.pct}%)
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OccupancyMeter({
  aboard,
  capacity,
  compact = false,
}: {
  aboard: number;
  capacity: number;
  compact?: boolean;
}) {
  const pct = capacity > 0 ? Math.round((aboard / capacity) * 100) : 0;
  const over = capacity > 0 && aboard > capacity;
  const near = !over && pct >= 90;

  return (
    <div className={compact ? "inline-flex flex-col gap-0.5" : "flex flex-col gap-1"}>
      <p
        className={`font-semibold ${
          over ? "text-danger" : near ? "text-[#9a6700]" : "text-electric-blue"
        } ${compact ? "text-sm" : "text-lg"}`}
      >
        {aboard}/{capacity || "—"} · {capacity ? `${pct}%` : "n/a"}
        {over ? " · OVER CAPACITY" : near ? " · Near full" : ""}
      </p>
      {capacity > 0 ? (
        <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-gray">
          <div
            className={`h-full rounded-full transition-all ${
              over ? "bg-danger" : near ? "bg-gold" : "bg-electric-blue"
            }`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
