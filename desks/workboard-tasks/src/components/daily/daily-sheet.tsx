"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Slot = {
  slot: number;
  title: string;
  status: string;
  priority: string | null;
  taskId: string | null;
};

type Person = {
  id: string;
  name: string;
  phone: string;
  submitted: boolean;
  slots: Slot[];
};

const EMPTY = () =>
  [1, 2, 3, 4, 5].map(() => ({ title: "", priority: "MEDIUM" }));

export function DailySheet({ people }: { people: Person[] }) {
  const router = useRouter();
  const [userId, setUserId] = useState(people[0]?.id ?? "");
  const selected = people.find((person) => person.id === userId);
  const [rows, setRows] = useState(() => {
    const first = people[0];
    if (first?.submitted && first.slots.length === 5) {
      return first.slots.map((slot) => ({ title: slot.title, priority: slot.priority }));
    }
    return EMPTY();
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const missing = useMemo(() => people.filter((person) => !person.submitted), [people]);
  const doneCount = people.length - missing.length;

  function pickPerson(id: string) {
    setUserId(id);
    setError("");
    const person = people.find((item) => item.id === id);
    if (person?.submitted && person.slots.length === 5) {
      setRows(
        person.slots.map((slot) => ({
          title: slot.title,
          priority: slot.priority,
        })),
      );
    } else {
      setRows(EMPTY());
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, slots: rows }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-2xl border border-zinc-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">Mandatory</p>
        <h2 className="mt-1 text-lg font-semibold">Today’s 1–5</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {doneCount}/{people.length} people have sent theirs.
        </p>
        <ul className="mt-4 space-y-2">
          {people.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => pickPerson(person.id)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                  person.id === userId ? "bg-sky-50 text-sky-900" : "hover:bg-zinc-50"
                }`}
              >
                <span className="font-medium">{person.name}</span>
                <span className={person.submitted ? "text-emerald-600" : "text-rose-500"}>
                  {person.submitted ? "In" : "Missing"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <form onSubmit={save} className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500">Sheet for</p>
            <h3 className="text-2xl font-semibold">{selected?.name ?? "Choose someone"}</h3>
          </div>
          <p className="max-w-sm text-right text-sm text-zinc-500">
            These five become task cards on the board. You can hand any card to someone else later.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="grid grid-cols-[40px_1fr_140px] items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
                {index + 1}
              </span>
              <input
                required
                value={row.title}
                onChange={(e) =>
                  setRows((current) =>
                    current.map((item, i) => (i === index ? { ...item, title: e.target.value } : item)),
                  )
                }
                placeholder={`Task ${index + 1}`}
                className="rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
              />
              <select
                value={row.priority ?? ""}
                onChange={(e) =>
                  setRows((current) =>
                    current.map((item, i) => (i === index ? { ...item, priority: e.target.value } : item)),
                  )
                }
                className="rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="HIGHEST">Highest</option>
              </select>
            </div>
          ))}
        </div>

        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-zinc-400">Asked automatically at 9:30. Checked again at 5:30.</p>
          <button
            type="submit"
            disabled={saving || !userId}
            className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : selected?.submitted ? "Update 1–5" : "Submit 1–5"}
          </button>
        </div>
      </form>
    </div>
  );
}
