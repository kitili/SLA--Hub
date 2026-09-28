import { getTodaySheet } from "@/lib/services/daily-sheet";
import { DailySheet } from "@/components/daily/daily-sheet";

export const dynamic = "force-dynamic";

export default async function DailyPage() {
  const sheet = await getTodaySheet();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">Daily sheet</p>
        <h2 className="mt-1 text-2xl font-semibold">What are your 1 to 5?</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600">
          Everyone sends five tasks. They land on the board under Tasks, assigned to that person,
          with a priority. Drag a card to In progress, Backlog, or Done.
        </p>
      </div>
      <DailySheet people={sheet.people} />
    </div>
  );
}
