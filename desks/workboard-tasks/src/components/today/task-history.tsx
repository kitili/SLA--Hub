"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { phaseStyle } from "@/lib/board/columns";
import { dailyLineLabel } from "@/lib/daily-lines";
import { Pager } from "@/components/pager";

const HISTORY_PAGE_SIZE = 7;

type Entry = {
  id: string;
  date: string;
  slot: number;
  title: string;
  priority: string | null;
  status: string;
  completedAt: string | null;
};

type Week = {
  weekStart: string;
  created: number;
  done: number;
  percent: number;
};

export function TaskHistory({ entries, diligence }: { entries: Entry[]; diligence: Week[] }) {
  const [from, setFrom] = useState("2026-09-01");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const visible = useMemo(() => {
    const start = new Date(from || "2026-09-01");
    const end = to ? new Date(`${to}T23:59:59`) : null;
    return entries.filter((entry) => {
      const day = new Date(entry.date);
      if (day < start) return false;
      if (end && day > end) return false;
      if (status === "done" && entry.status !== "COMPLETED") return false;
      if (status === "open" && entry.status === "COMPLETED") return false;
      return true;
    });
  }, [entries, from, to, status]);

  const days = useMemo(() => {
    const groups = new Map<string, Entry[]>();
    for (const entry of visible) {
      const key = format(new Date(entry.date), "yyyy-MM-dd");
      const list = groups.get(key) ?? [];
      list.push(entry);
      groups.set(key, list);
    }
    return [...groups.entries()].map(([key, items]) => ({
      key,
      items: [...items].sort((a, b) => a.slot - b.slot),
    }));
  }, [visible]);

  const pages = Math.max(1, Math.ceil(days.length / HISTORY_PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const pageDays = days.slice((safePage - 1) * HISTORY_PAGE_SIZE, safePage * HISTORY_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [from, to, status]);

  const visibleWeeks = diligence.filter((item) => new Date(item.weekStart) >= new Date(from || "2026-09-01"));
  const exportHref = `/api/me/export?status=${status}&from=${from || "2026-09-01"}&to=${to}`;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">History</h3>
          <p className="text-sm text-[#4f555f]">The lists you wrote, numbered the way you first entered them.</p>
        </div>
        <a
          href={exportHref}
          className="rounded-xl border border-[#002368] px-4 py-2 text-sm font-medium text-[#002368]"
        >
          Export
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visibleWeeks.slice(0, 4).map((item) => (
          <article key={item.weekStart} className="rounded-2xl border border-[#002368]/10 bg-white p-4 shadow-sm">
            <p className="text-xs text-[#818283]">Week of {format(new Date(item.weekStart), "d MMM")}</p>
            <p className="mt-2 text-3xl font-semibold text-[#002368]">{item.percent}%</p>
            <p className="mt-1 text-xs text-[#4f555f]">
              {item.done} of {item.created} finished
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#d9ecf9]">
              <div className="h-full rounded-full bg-[#ffc952]" style={{ width: `${item.percent}%` }} />
            </div>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="text-sm text-[#4f555f]">
          From
          <input
            type="date"
            min="2026-09-01"
            value={from}
            onChange={(e) => setFrom(e.target.value < "2026-09-01" ? "2026-09-01" : e.target.value)}
            className="ml-2 rounded-xl border border-zinc-200 bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm text-[#4f555f]">
          To
          <input
            type="date"
            min="2026-09-01"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="ml-2 rounded-xl border border-zinc-200 bg-white px-3 py-2"
          />
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="done">Done</option>
          <option value="open">Not done</option>
        </select>
      </div>

      {days.length === 0 ? (
        <p className="rounded-2xl border border-[#002368]/10 bg-white px-5 py-8 text-sm text-[#4f555f]">
          Nothing in this filter yet. Lists you add on 1-5&apos;s show up here.
        </p>
      ) : (
        <div className="space-y-4">
          {pageDays.map((day) => (
            <article key={day.key} className="overflow-hidden rounded-2xl border border-[#002368]/10 bg-white shadow-sm">
              <header className="border-b border-[#002368]/10 bg-[#f4f7fb] px-5 py-3">
                <h4 className="text-sm font-semibold text-[#002368]">
                  {format(new Date(day.items[0].date), "EEEE, d MMM yyyy")}
                </h4>
              </header>
              <ol className="divide-y divide-zinc-100">
                {day.items.map((entry) => {
                  const phase = phaseStyle(entry.status);
                  return (
                    <li key={entry.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="on-navy flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                        {entry.slot}
                      </span>
                      <p className="min-w-0 flex-1 text-sm text-[#14233B]">
                        <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-[#818283]">
                          {dailyLineLabel(entry.slot)}
                        </span>
                        {entry.title}
                      </p>
                      {entry.priority ? (
                        <span className="hidden text-xs capitalize text-[#818283] sm:inline">{entry.priority.toLowerCase()}</span>
                      ) : null}
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          entry.slot === 4
                            ? "bg-[#FFC952] text-[#14233B]"
                            : entry.slot === 5
                              ? "bg-[#80BFEC] text-[#002368]"
                              : phase.pill
                        }`}
                      >
                        {entry.slot === 4 ? "Challenge" : entry.slot === 5 ? "Update" : phase.title}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </article>
          ))}
          <Pager page={safePage} pages={pages} onPage={setPage} />
        </div>
      )}
    </section>
  );
}
