import { getBuses, getSchools, listBoardingEventsForReport } from "@/lib/db/queries";
import type { BoardingReportRow } from "@/lib/db/queries";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import {
  buildTripRunLog,
  formatScanClock,
} from "@/lib/transport/trip-run";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1]![0] : "";
  return `${a}${b}`.toUpperCase();
}

function groupScans(history: BoardingReportRow[]) {
  const groups = new Map<string, BoardingReportRow[]>();
  for (const entry of history) {
    // Keyed by day too (not just bus + direction) -- a date range can span
    // more than one day, and each day's own trip is its own group.
    const key = `${entry.trip_date} · ${entry.bus_label || "Unassigned bus"} · ${entry.direction.toUpperCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  return [...groups.entries()]
    .map(([label, entries]) => ({
      label,
      // Chronological within the bus so the day reads top → bottom
      entries: [...entries].sort(
        (a, b) => new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime(),
      ),
    }))
    .sort((a, b) => b.label.localeCompare(a.label));
}

export default async function BoardingHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; schoolId?: string; busId?: string }>;
}) {
  const { from, to, schoolId, busId } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const selectedFrom = from || today;
  const selectedTo = to || today;

  const [schools, buses, history] = await Promise.all([
    getSchools(),
    getBuses(),
    listBoardingEventsForReport({
      from: selectedFrom,
      to: selectedTo,
      schoolId: schoolId || undefined,
      busId: busId || undefined,
    }),
  ]);

  const groups = groupScans(history);
  const uniqueStudents = new Set(history.map((e) => e.student_id)).size;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="ui-rise flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
            Admin · Boarding
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-electric-blue">
            Scans
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Same run as the Excel scan log: first student → last student →
            school gate. Afternoon is the morning path reversed.
          </p>
        </div>
        <ExportCsvButton entity="boarding-events" />
      </div>

      <div className="ui-rise ui-rise-delay-1 mt-6 grid gap-3 sm:grid-cols-2">
        <div className="ui-panel px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Total scans
          </p>
          <p className="mt-1 text-2xl font-extrabold text-electric-blue">{history.length}</p>
        </div>
        <div className="ui-panel px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Students
          </p>
          <p className="mt-1 text-2xl font-extrabold text-electric-blue">{uniqueStudents}</p>
        </div>
      </div>

      <form
        className="ui-rise ui-rise-delay-2 ui-panel mt-6 flex flex-wrap items-end gap-3 p-4"
        method="get"
      >
        <label className="flex min-w-[10rem] flex-col gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            From
          </span>
          <input
            type="date"
            name="from"
            defaultValue={selectedFrom}
            className="rounded-[var(--radius-sm)] border border-card-border bg-white/90 px-3 py-2.5 text-ink outline-none transition focus:border-electric-blue focus:ring-2 focus:ring-gold/40"
          />
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">To</span>
          <input
            type="date"
            name="to"
            defaultValue={selectedTo}
            className="rounded-[var(--radius-sm)] border border-card-border bg-white/90 px-3 py-2.5 text-ink outline-none transition focus:border-electric-blue focus:ring-2 focus:ring-gold/40"
          />
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Campus
          </span>
          <select
            name="schoolId"
            defaultValue={schoolId ?? ""}
            className="rounded-[var(--radius-sm)] border border-card-border bg-white/90 px-3 py-2.5 text-ink outline-none transition focus:border-electric-blue focus:ring-2 focus:ring-gold/40"
          >
            <option value="">All campuses</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Bus</span>
          <select
            name="busId"
            defaultValue={busId ?? ""}
            className="rounded-[var(--radius-sm)] border border-card-border bg-white/90 px-3 py-2.5 text-ink outline-none transition focus:border-electric-blue focus:ring-2 focus:ring-gold/40"
          >
            <option value="">All buses</option>
            {buses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label} ({b.plate_number})
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-[var(--radius-sm)] bg-gradient-to-br from-navy-light to-electric-blue px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(0,35,104,0.2)] transition hover:brightness-105"
        >
          Show
        </button>
      </form>

      {history.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius)] border border-dashed border-card-border bg-light-blue-30/80 p-10 text-center text-sm text-ink-muted">
          No boarding scans in this range.
        </div>
      ) : (
        groups.map((group, groupIdx) => (
          <section
            key={group.label}
            className={`mt-10 ${groupIdx === 0 ? "ui-rise ui-rise-delay-3" : ""}`}
          >
            {(() => {
              const run = buildTripRunLog({
                direction: group.entries[0]?.direction ?? "am",
                schoolGateAt: group.entries[0]?.school_gate_at ?? null,
                scans: group.entries.map((e) => ({
                  id: e.id,
                  studentName: e.student_name,
                  scannedAt: e.scanned_at,
                  eventType: e.event_type,
                })),
              });
              return (
                <>
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
                    <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-electric-blue">
                      {group.label}
                    </h2>
                    <span className="rounded-full bg-light-blue-30 px-2.5 py-0.5 text-xs font-bold text-electric-blue">
                      {group.entries.length} scans
                    </span>
                  </div>
                  {run.first ? (
                    <p className="mb-3 text-xs text-ink-muted">
                      {run.first.label}:{" "}
                      <strong className="text-ink">{run.first.studentName}</strong>
                      {run.last && run.last.id !== run.first.id ? (
                        <>
                          {" "}
                          → {run.last.label}:{" "}
                          <strong className="text-ink">{run.last.studentName}</strong>
                        </>
                      ) : null}
                      {run.schoolGateAt ? (
                        <>
                          {" "}
                          → {run.schoolGateLabel}{" "}
                          <strong className="font-mono text-ink">
                            {formatScanClock(run.schoolGateAt)}
                          </strong>
                        </>
                      ) : (
                        <>
                          {" "}
                          → {run.schoolGateLabel}{" "}
                          <span className="text-ink-faint">not logged</span>
                        </>
                      )}
                    </p>
                  ) : null}

            <ol className="relative space-y-0 border-l-2 border-electric-blue/15 pl-0">
              {run.legs.map((leg) => {
                const entry = group.entries.find((e) => e.id === leg.id);
                return (
                  <li
                    key={leg.id}
                    className="relative flex gap-3 py-2.5 pl-5 first:pt-0 last:pb-0"
                  >
                    <span
                      className="absolute -left-[5px] top-[1.35rem] h-2.5 w-2.5 rounded-full bg-electric-blue ring-2 ring-white"
                      aria-hidden
                    />
                    <div className="ui-panel flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 transition hover:shadow-[var(--shadow-lg)]">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-light-blue/40 to-electric-blue/15 text-xs font-extrabold tracking-wide text-electric-blue ring-1 ring-electric-blue/10"
                        aria-hidden
                      >
                        {initialsFromName(leg.studentName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">
                          {leg.studentName}
                          {entry?.class_name ? (
                            <span className="ml-1.5 font-normal text-ink-muted">
                              · {entry.class_name}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {leg.label} · {leg.eventType === "in" ? "Boarded" : "Alighted"}
                        </p>
                      </div>
                      <time
                        dateTime={leg.scannedAt}
                        className="shrink-0 font-mono text-sm font-semibold tabular-nums text-ink"
                      >
                        {formatScanClock(leg.scannedAt)}
                      </time>
                    </div>
                  </li>
                );
              })}
              {run.schoolGateAt ? (
                <li className="relative flex gap-3 py-2.5 pl-5">
                  <span
                    className="absolute -left-[5px] top-[1.35rem] h-2.5 w-2.5 rounded-full bg-gold ring-2 ring-white"
                    aria-hidden
                  />
                  <div className="ui-panel flex min-w-0 flex-1 items-center justify-between gap-3 px-3.5 py-3">
                    <p className="text-sm font-bold text-electric-blue">
                      {run.schoolGateLabel}
                    </p>
                    <time
                      dateTime={run.schoolGateAt}
                      className="font-mono text-sm font-semibold tabular-nums text-ink"
                    >
                      {formatScanClock(run.schoolGateAt)}
                    </time>
                  </div>
                </li>
              ) : null}
            </ol>
                </>
              );
            })()}
          </section>
        ))
      )}
    </main>
  );
}
