import Link from "next/link";
import { requireLoginPage } from "@/lib/require-module-page";
import { nairobiDateString } from "@/lib/nairobi";
import { loadAcademySnapshot } from "@/lib/desks";
import { WeeklySnapshotStrip } from "@/components/desk/weekly-snapshot-strip";
import { STATUS_LABELS } from "@/lib/one-to-fives-constants";

export default async function WeeklySnapshotPage() {
  await requireLoginPage("one_to_fives");
  const snapshot = await loadAcademySnapshot(nairobiDateString());
  const liveDesks = snapshot.desks.filter((desk) => desk.staffCount > 0 || desk.projects.length > 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-medium text-navy">This week</h1>
        <p className="mt-1 text-sm text-black/55">
          One academy picture: who filed 1–5s, how boards moved, and Thursday pulse notes.{" "}
          <Link href="/dashboard/one-to-fives" className="text-navy underline">
            Everyone’s 1–5s
          </Link>
        </p>
      </div>

      <WeeklySnapshotStrip weekStart={snapshot.weekStart} workDate={snapshot.workDate} totals={snapshot.totals} />

      <div className="overflow-x-auto rounded-lg border border-black/10 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-black/10 text-xs text-black/50">
            <tr>
              <th className="px-4 py-3 font-medium">Desk</th>
              <th className="px-4 py-3 font-medium">1–5s</th>
              <th className="px-4 py-3 font-medium">Boards</th>
              <th className="px-4 py-3 font-medium">Pulse</th>
            </tr>
          </thead>
          <tbody>
            {liveDesks.map((desk) => (
              <tr key={desk.id} className="border-b border-black/5 align-top last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/desks/${desk.id}`} className="font-medium text-navy hover:underline">
                    {desk.name}
                  </Link>
                  <div className="mt-1 flex flex-col gap-0.5 text-xs text-black/50">
                    {desk.projects.map((project) => (
                      <Link key={project.id} href={`/dashboard/systems/${project.id}`} className="hover:underline">
                        {project.name} · {project.pct}%
                      </Link>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-black/70">
                  {desk.filed}/{desk.expected || 0}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-black/70">{desk.projectPct}%</td>
                <td className="px-4 py-3 text-black/70">
                  {desk.pulse ? (
                    <div>
                      <div>{STATUS_LABELS[desk.pulse.status]}</div>
                      {desk.pulse.wins && <p className="mt-1 text-xs text-black/55">Wins: {desk.pulse.wins}</p>}
                      {desk.pulse.risks && <p className="text-xs text-black/55">Risks: {desk.pulse.risks}</p>}
                      {desk.pulse.helpNeeded && <p className="text-xs text-black/55">Help: {desk.pulse.helpNeeded}</p>}
                    </div>
                  ) : (
                    <span className="text-black/40">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
