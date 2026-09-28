import Image from "next/image";
import { Card } from "@/components/ui/card";

export function OneToFivesDiagram() {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/10 px-6 py-4">
        <div>
          <h2 className="text-lg font-medium text-navy">Silverleaf Desk — system map</h2>
          <p className="text-sm text-black/50">
            Improved Excalidraw from the original 1–5s whiteboard, plus department desks, projects, and the weekly
            snapshot. Green is in the app, amber is partial, red is still missing.
          </p>
        </div>
        <a
          href="/silverleaf-desk.excalidraw"
          download
          className="text-sm text-navy underline"
        >
          Download Excalidraw
        </a>
      </div>
      <div className="bg-white px-2 py-4 sm:px-6">
        <Image
          src="/silverleaf-desk-diagram.png"
          alt="Silverleaf Desk system map: staff in every department file a personal 1-5 after email login, the 9:30 a.m. Nairobi cron marks late and missed rows, Thursday pulses close on the same deadline, and projects with phases and sprints roll up into a weekly academy snapshot. Amber and red boxes mark gaps from the original whiteboard."
          width={1760}
          height={1180}
          className="h-auto w-full rounded-md border border-black/10"
        />
      </div>
      <div className="grid gap-3 border-t border-black/10 bg-gray-light/40 px-6 py-4 text-sm md:grid-cols-3">
        <div>
          <p className="font-medium text-navy">In the app</p>
          <p className="text-black/60">
            Email login, personal 1–5s, skip with a reason, holidays, extra days, 9:30 auto-close, Thursday pulse,
            department desks, projects / phases / sprints, weekly snapshot, feedback.
          </p>
        </div>
        <div>
          <p className="font-medium text-navy">Partial</p>
          <p className="text-black/60">
            Admin can see today&apos;s board but not trends or charts. Users are added one by one, not by Excel. Deadline
            is fixed at 9:30. End-of-day close is tick-done, not the full four progress phases.
          </p>
        </div>
        <div>
          <p className="font-medium text-navy">Not yet</p>
          <p className="text-black/60">
            Accomplishment graphs, monthly 1–5 summary, 1–5 activity log, batch user import, admin-managed progress
            phases, and a date picker for filing another day.
          </p>
        </div>
      </div>
    </Card>
  );
}
