import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getMyHistory, getTodaySheet } from "@/lib/services/daily-sheet";
import { TodayForm } from "@/components/today/today-form";
import { TaskHistory } from "@/components/today/task-history";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [sheet, history] = await Promise.all([
    getTodaySheet(user.organizationId),
    getMyHistory(user.id),
  ]);
  const me = sheet.people.find((person) => person.id === user.id);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-[#002368]/10 bg-white px-6 py-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#002368]">
            {user.name ?? user.username}
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl text-[#002368]">My tasks</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4f555f]">
            Three priorities, one challenge, and a progress recap of yesterday. Once you add them, this page clears for tomorrow.
          </p>
        </div>
        <Link href="/board?mine=1" className="on-navy rounded-xl px-4 py-2.5 text-sm font-semibold">
          Open my board
        </Link>
      </div>
      <TodayForm filed={(me?.slots.length ?? 0) > 0} saved={me?.slots ?? []} />
      <TaskHistory entries={history.entries} diligence={history.diligence} />
    </div>
  );
}
