import { requireLoginPage } from "@/lib/require-module-page";
import { nairobiDateString, latestThursday, weekdayForDate } from "@/lib/nairobi";
import { loadBoard } from "@/lib/one-to-fives";
import { OneToFivesBoard } from "@/components/one-to-fives/one-to-fives-board";
import { PulseForm } from "@/components/one-to-fives/pulse-form";
import { CalendarSettings } from "@/components/one-to-fives/calendar-settings";

export default async function OneToFivesPage() {
  const { session, canManage } = await requireLoginPage("one_to_fives");
  const workDate = nairobiDateString();
  const board = await loadBoard(workDate);
  const weekThursday = latestThursday(workDate);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-medium text-navy">Everyone’s 1–5s</h1>
        <p className="mt-1 text-sm text-black/50">
          File yours on Today. This page is the academy board for the day.
        </p>
      </div>

      <OneToFivesBoard
        workDate={board.workDate}
        workDay={board.workDay}
        people={board.people}
        entries={board.entries}
        departments={board.departments}
      />

      <PulseForm
        weekThursday={weekThursday}
        isThursday={weekdayForDate(workDate) === 4}
        departments={board.departments}
        pulses={board.pulses}
        defaultDepartmentId={session.user.departmentId}
        canManage={canManage}
      />

      {canManage && (
        <details>
          <summary className="cursor-pointer text-sm text-black/50">Holidays and extra work days</summary>
          <div className="mt-4">
            <CalendarSettings holidays={board.holidays} extraDays={board.extraDays} />
          </div>
        </details>
      )}
    </div>
  );
}
