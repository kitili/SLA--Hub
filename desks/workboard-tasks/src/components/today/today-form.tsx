"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DAILY_LINES } from "@/lib/daily-lines";

type Row = { slot: number; title: string };

const blankRows = (): Row[] => DAILY_LINES.map((line) => ({ slot: line.slot, title: "" }));

export function TodayForm({
  filed,
  saved = [],
}: {
  filed: boolean;
  saved?: Array<{ slot: number; title: string }>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(blankRows);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(filed);

  async function saveList(e: React.FormEvent) {
    e.preventDefault();
    const slots = rows.filter((row) => row.title.trim());
    if (slots.length === 0) {
      setError("Fill in at least one open line.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/today", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slots: slots.map((row) => ({
          slot: row.slot,
          title: row.title,
          priority: null,
        })),
      }),
    });
    const data = (await res.json()) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not add those tasks");
      return;
    }
    setRows(blankRows());
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <section className="overflow-hidden rounded-2xl border border-[#002368]/10 bg-white shadow-sm">
        <div className="h-1.5 bg-[#FFC952]" />
        <div className="space-y-4 px-6 py-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#002368]">Filed</p>
            <h3 className="mt-2 font-[family-name:var(--font-display)] text-2xl text-[#002368]">Today is done</h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#4f555f]">
              These are the words you wrote. The list stays here until tomorrow.
            </p>
          </div>
          <ol className="space-y-3">
            {DAILY_LINES.map((line) => {
              const title = saved.find((item) => item.slot === line.slot)?.title?.trim();
              if (!title) return null;
              const panel =
                line.slot === 5 ? "bg-[#D9ECF9]" : line.slot === 4 ? "bg-[#FFF7E5]" : "bg-[#f4f7fb]";
              return (
                <li key={line.slot} className={`flex items-start gap-3 rounded-xl p-4 ${panel}`}>
                  <span className="on-navy flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                    {line.slot}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#002368]">{line.label}</p>
                    <p className="mt-1 text-sm leading-6 text-[#14233B]">{title}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    );
  }

  const priorities = DAILY_LINES.filter((line) => line.slot <= 3);

  return (
    <form onSubmit={saveList} className="overflow-hidden rounded-2xl border border-[#002368]/10 bg-white shadow-sm">
      <div className="h-1.5 bg-[#002368]" />
      <div className="space-y-6 p-6">
        <section className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#002368]">01 — 03</p>
            <h3 className="mt-1 font-[family-name:var(--font-display)] text-xl text-[#002368]">Today’s priorities</h3>
            <p className="mt-1 text-sm text-[#4f555f]">Three things that matter today. Blank lines stay empty.</p>
          </div>
          {priorities.map((line) => (
            <LineField
              key={line.slot}
              line={line}
              value={rows[line.slot - 1]?.title ?? ""}
              onChange={(title) =>
                setRows((current) => current.map((item) => (item.slot === line.slot ? { ...item, title } : item)))
              }
            />
          ))}
        </section>

        <section className="space-y-3 rounded-xl bg-[#FFF7E5] p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#14233B]">04</p>
            <h3 className="mt-1 font-[family-name:var(--font-display)] text-xl text-[#002368]">Challenge</h3>
            <p className="mt-1 text-sm text-[#4f555f]">
              A challenge that may get in the way of the goals or tasks you set.
            </p>
          </div>
          <LineField
            line={DAILY_LINES[3]}
            value={rows[3]?.title ?? ""}
            onChange={(title) => setRows((current) => current.map((item) => (item.slot === 4 ? { ...item, title } : item)))}
          />
        </section>

        <section className="space-y-3 rounded-xl bg-[#D9ECF9] p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#002368]">05</p>
            <h3 className="mt-1 font-[family-name:var(--font-display)] text-xl text-[#002368]">Progress recap</h3>
            <p className="mt-1 text-sm text-[#4f555f]">A recap of the previous day’s progress.</p>
          </div>
          <LineField
            line={DAILY_LINES[4]}
            value={rows[4]?.title ?? ""}
            onChange={(title) => setRows((current) => current.map((item) => (item.slot === 5 ? { ...item, title } : item)))}
          />
        </section>

        <button
          type="submit"
          disabled={saving}
          className="on-navy rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add to my tasks"}
        </button>
        {error ? <p className="text-sm text-[#002368]">{error}</p> : null}
      </div>
    </form>
  );
}

function LineField({
  line,
  value,
  onChange,
}: {
  line: (typeof DAILY_LINES)[number];
  value: string;
  onChange: (title: string) => void;
}) {
  const challenge = line.slot === 4;

  return (
    <label className="grid grid-cols-[40px_1fr] items-center gap-3">
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
          challenge ? "bg-[#FFC952]" : "on-navy"
        }`}
        style={challenge ? { color: "#14233B", WebkitTextFillColor: "#14233B" } : undefined}
      >
        {line.slot}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={line.hint}
        className="rounded-xl border border-[#002368]/15 px-3 py-2.5 text-sm"
        style={{ color: "#14233B", backgroundColor: "#ffffff" }}
      />
    </label>
  );
}
