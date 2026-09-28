import { format, startOfDay } from "date-fns";
import { redirect } from "next/navigation";
import { Pager } from "@/components/pager";
import { UpdatesFilter } from "@/components/updates-filter";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { listUpdates } from "@/lib/services/updates";

export const dynamic = "force-dynamic";

function pageNumber(value: string | undefined) {
  const requested = Number(value ?? "1");
  return Number.isFinite(requested) ? requested : 1;
}

function parseDay(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "2026-09-01") return undefined;
  const day = startOfDay(new Date(`${value}T00:00:00`));
  return Number.isNaN(day.getTime()) ? undefined : day;
}

export default async function UpdatesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    challenges?: string;
    who?: string;
    q?: string;
    hpage?: string;
    from?: string;
    to?: string;
    hk?: string;
  }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const fromValue = params.from && params.from >= "2026-09-01" ? params.from : "2026-09-01";
  const toValue = params.to && params.to >= "2026-09-01" ? params.to : "";
  const historyKind = params.hk === "PROGRESS" || params.hk === "CHALLENGE" ? params.hk : "all";
  const people = await db.user.findMany({
    where: { organizationId: user.organizationId, isActive: true },
    select: { id: true, name: true, username: true },
    orderBy: { name: "asc" },
  });
  const selected = people.some((person) => person.id === params.who) ? params.who! : "all";
  const peopleFilter = {
    ...(selected === "all" ? {} : { authorId: selected }),
    ...(query ? { query } : {}),
  };
  const [progress, challenges, history] = await Promise.all([
    listUpdates(user.organizationId, user.id, pageNumber(params.page), "PROGRESS", { ...peopleFilter, day: "today" }),
    listUpdates(user.organizationId, user.id, pageNumber(params.challenges), "CHALLENGE", { ...peopleFilter, day: "today" }),
    listUpdates(user.organizationId, user.id, pageNumber(params.hpage), historyKind === "all" ? null : historyKind, {
      ...peopleFilter,
      day: "past",
      from: parseDay(fromValue),
      to: parseDay(toValue),
    }),
  ]);
  const exportQuery = new URLSearchParams();
  if (selected !== "all") exportQuery.set("who", selected);
  if (query) exportQuery.set("q", query);
  if (fromValue) exportQuery.set("from", fromValue);
  if (toValue) exportQuery.set("to", toValue);
  if (historyKind !== "all") exportQuery.set("hk", historyKind);
  const historyDays = groupByDay(history.updates);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#002368]">Team</p>
          <h2 className="mt-1 text-2xl font-semibold">Updates</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Today’s progress and challenges. Earlier days stay in History, where you can export them.
          </p>
        </div>
        <UpdatesFilter
          who={selected}
          query={query}
          from={fromValue === "2026-09-01" ? undefined : fromValue}
          to={toValue || undefined}
          kind={historyKind}
          people={people.map((person) => ({
            id: person.id,
            label: person.name ?? person.username ?? "Someone",
          }))}
        />
      </div>

      <NoteSection
        title="Progress"
        empty="No progress yet today. When someone fills Progress recap on 1-5's, it shows up here."
        notes={progress.updates}
        page={progress.page}
        pages={progress.pages}
        param="page"
        keep={{
          challenges: challenges.page > 1 ? challenges.page : undefined,
          who: selected === "all" ? undefined : selected,
          q: query || undefined,
          hpage: history.page > 1 ? history.page : undefined,
          from: fromValue === "2026-09-01" ? undefined : fromValue,
          to: toValue || undefined,
          hk: historyKind === "all" ? undefined : historyKind,
        }}
      />

      <NoteSection
        title="Challenges"
        empty="No challenges yet today. When someone writes a challenge on 1-5's, it shows up here."
        notes={challenges.updates}
        page={challenges.page}
        pages={challenges.pages}
        param="challenges"
        keep={{
          page: progress.page > 1 ? progress.page : undefined,
          who: selected === "all" ? undefined : selected,
          q: query || undefined,
          hpage: history.page > 1 ? history.page : undefined,
          from: fromValue === "2026-09-01" ? undefined : fromValue,
          to: toValue || undefined,
          hk: historyKind === "all" ? undefined : historyKind,
        }}
        tone="challenge"
      />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[#002368]">History</h3>
            <p className="text-sm text-[#4f555f]">Progress and challenges from earlier days. Today stays in the lists above.</p>
          </div>
          <a
            href={`/api/updates/export?${exportQuery.toString()}`}
            className="rounded-xl border border-[#002368] px-4 py-2 text-sm font-medium text-[#002368]"
          >
            Export
          </a>
        </div>

        <form method="get" action="/updates" className="flex flex-wrap items-end gap-2">
          {selected !== "all" ? <input type="hidden" name="who" value={selected} /> : null}
          {query ? <input type="hidden" name="q" value={query} /> : null}
          <label className="text-sm text-[#4f555f]">
            From
            <input
              type="date"
              name="from"
              min="2026-09-01"
              defaultValue={fromValue}
              className="ml-2 rounded-xl border border-zinc-200 bg-white px-3 py-2"
              style={{ color: "#14233B" }}
            />
          </label>
          <label className="text-sm text-[#4f555f]">
            To
            <input
              type="date"
              name="to"
              min="2026-09-01"
              defaultValue={toValue}
              className="ml-2 rounded-xl border border-zinc-200 bg-white px-3 py-2"
              style={{ color: "#14233B" }}
            />
          </label>
          <select
            name="hk"
            defaultValue={historyKind}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
            style={{ color: "#14233B" }}
          >
            <option value="all">Progress and challenges</option>
            <option value="PROGRESS">Progress</option>
            <option value="CHALLENGE">Challenges</option>
          </select>
          <button type="submit" className="on-navy rounded-xl px-4 py-2 text-sm font-semibold">
            Filter
          </button>
        </form>

        {historyDays.length === 0 ? (
          <p className="rounded-2xl border border-[#002368]/10 bg-white px-5 py-8 text-sm text-[#4f555f]">
            Nothing in this range yet. Notes from before today show up here.
          </p>
        ) : (
          <div className="space-y-4">
            {historyDays.map((day) => (
              <article key={day.key} className="overflow-hidden rounded-2xl border border-[#002368]/10 bg-white shadow-sm">
                <header className="border-b border-[#002368]/10 bg-[#f4f7fb] px-5 py-3">
                  <h4 className="text-sm font-semibold text-[#002368]">{format(new Date(day.key), "EEEE, d MMM yyyy")}</h4>
                </header>
                <ol className="divide-y divide-zinc-100">
                  {day.notes.map((item) => (
                    <li key={item.id} className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[#002368]">{item.authorName}</p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            item.kind === "CHALLENGE" ? "bg-[#FFC952] text-[#14233B]" : "bg-[#80BFEC] text-[#002368]"
                          }`}
                        >
                          {item.kind === "CHALLENGE" ? "Challenge" : "Progress"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[#14233B]">{item.body}</p>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
            <Pager
              page={history.page}
              pages={history.pages}
              basePath="/updates"
              param="hpage"
              keep={{
                page: progress.page > 1 ? progress.page : undefined,
                challenges: challenges.page > 1 ? challenges.page : undefined,
                who: selected === "all" ? undefined : selected,
                q: query || undefined,
                from: fromValue === "2026-09-01" ? undefined : fromValue,
                to: toValue || undefined,
                hk: historyKind === "all" ? undefined : historyKind,
              }}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function groupByDay(
  notes: Array<{
    id: string;
    body: string;
    kind: string;
    planDate: string;
    authorName: string;
  }>,
) {
  const groups = new Map<string, typeof notes>();
  for (const note of notes) {
    const key = format(new Date(note.planDate), "yyyy-MM-dd");
    const list = groups.get(key) ?? [];
    list.push(note);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([key, dayNotes]) => ({ key, notes: dayNotes }));
}

function NoteSection({
  title,
  empty,
  notes,
  page,
  pages,
  param,
  keep,
  tone = "progress",
}: {
  title: string;
  empty: string;
  notes: Array<{
    id: string;
    body: string;
    planDate: string;
    createdAt: string;
    authorName: string;
    unread: boolean;
  }>;
  page: number;
  pages: number;
  param: string;
  keep: Record<string, string | number | undefined>;
  tone?: "progress" | "challenge";
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold text-[#002368]">{title}</h3>
      {notes.length === 0 ? (
        <p className="rounded-2xl border border-[#002368]/10 bg-white px-5 py-8 text-sm text-[#4f555f]">{empty}</p>
      ) : (
        <ol className="space-y-3">
          {notes.map((item) => (
            <li
              key={item.id}
              className={`rounded-2xl border bg-white px-5 py-4 shadow-sm ${
                item.unread
                  ? tone === "challenge"
                    ? "border-[#FFC952]"
                    : "border-[#80BFEC]"
                  : "border-[#002368]/10"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[#002368]">{item.authorName}</p>
                {item.unread ? (
                  <span className="rounded-full bg-[#FFC952] px-2 py-0.5 text-[10px] font-semibold text-[#14233B]">
                    New
                  </span>
                ) : null}
                <p className="text-xs text-[#818283]">
                  {format(new Date(item.planDate), "EEE d MMM")} · {format(new Date(item.createdAt), "HH:mm")}
                </p>
              </div>
              <p className="mt-2 text-sm text-[#14233B]">{item.body}</p>
            </li>
          ))}
        </ol>
      )}
      <Pager page={page} pages={pages} basePath="/updates" param={param} keep={keep} />
    </section>
  );
}
