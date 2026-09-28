"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { sortByAlpha } from "@/lib/sort/alphabetical";
import type { HireOut, HirePurpose, HireStatus } from "@/lib/db/finance";
import { useConfirm } from "@/components/admin/ConfirmDialog";

type BusOption = {
  id: string;
  label: string;
  plate_number: string;
  school_id: string;
};

type SchoolOption = { id: string; name: string };

const PURPOSES: HirePurpose[] = sortByAlpha(
  ["wedding", "burial", "event", "other"] as HirePurpose[],
  (p) => p,
);
const STATUSES: HireStatus[] = sortByAlpha(
  [
    "inquiry",
    "booked",
    "in_progress",
    "completed",
    "cancelled",
  ] as HireStatus[],
  (s) => s.replace("_", " "),
);

type Props = {
  buses: BusOption[];
  schools: SchoolOption[];
  initialHireOuts: HireOut[];
};

function money(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString()}`;
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultStart() {
  const d = new Date();
  d.setHours(d.getHours() + 2, 0, 0, 0);
  return toLocalInput(d.toISOString());
}

function defaultEnd() {
  const d = new Date();
  d.setHours(d.getHours() + 8, 0, 0, 0);
  return toLocalInput(d.toISOString());
}

export function HireOutsClient({
  buses,
  schools,
  initialHireOuts,
}: Props) {
  const router = useRouter();
  const [hireOuts, setHireOuts] = useState(initialHireOuts);
  const [busId, setBusId] = useState(buses[0]?.id ?? "");
  const [schoolId, setSchoolId] = useState(() => {
    const bus = buses[0];
    return bus?.school_id ?? schools[0]?.id ?? "";
  });
  const [clientName, setClientName] = useState("");
  const [purpose, setPurpose] = useState<HirePurpose>("event");
  const [status, setStatus] = useState<HireStatus>("booked");
  const [startAt, setStartAt] = useState(defaultStart);
  const [endAt, setEndAt] = useState(defaultEnd);
  const [quotedAmount, setQuotedAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [createRevenue, setCreateRevenue] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const busesAz = useMemo(
    () => sortByAlpha(buses, (b) => b.label),
    [buses],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);

    if (!busId || !clientName.trim() || !startAt || !endAt) {
      setError("Bus, client name, start, and end are required");
      return;
    }
    const amount =
      quotedAmount.trim() === "" ? undefined : Number(quotedAmount);
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
      setError("Quoted amount must be a non-negative number");
      return;
    }

    const bus = buses.find((b) => b.id === busId);
    const amountText =
      amount !== undefined ? ` at ${money("TZS", amount)}` : "";
    const ok = await confirm({
      title: "Book this hire-out?",
      message: `Book ${bus?.label ?? "this bus"} for ${clientName.trim()}${amountText}?`,
      confirmLabel: "Book",
    });
    if (!ok) return;

    setSaving(true);
    try {
      const res = await fetch("/api/hire-outs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          busId,
          schoolId: schoolId || undefined,
          clientName: clientName.trim(),
          purpose,
          status,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          quotedAmount: amount,
          notes: notes.trim() || undefined,
          createRevenue,
        }),
      });
      const data = (await res.json()) as {
        hire_out?: HireOut;
        revenue?: { id: string } | null;
        error?: string;
      };
      if (!res.ok || !data.hire_out) {
        setError(data.error ?? `Booking failed (${res.status})`);
        return;
      }
      setHireOuts((prev) => [data.hire_out!, ...prev]);
      const revNote = data.revenue?.id
        ? ` · revenue ${data.revenue.id.slice(0, 8)}…`
        : "";
      setOkMsg(`Hire-out booked${revNote}`);
      setClientName("");
      setQuotedAmount("");
      setNotes("");
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, next: HireStatus) {
    const row = hireOuts.find((h) => h.id === id);
    const amountLabel = row ? money(row.currency, row.quoted_amount) : "amount unknown";
    const ok = await confirm({
      title: "Update hire-out status?",
      message: `Change ${row?.client_name ?? "this hire-out"}'s status (${amountLabel}) to "${next.replaceAll("_", " ")}"?`,
      confirmLabel: "Update",
      tone: next === "cancelled" ? "danger" : "default",
    });
    if (!ok) return;

    setPatchingId(id);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(`/api/hire-outs?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = (await res.json()) as {
        hire_out?: HireOut;
        error?: string;
      };
      if (!res.ok || !data.hire_out) {
        setError(data.error ?? `Update failed (${res.status})`);
        return;
      }
      setHireOuts((prev) =>
        prev.map((h) => (h.id === id ? data.hire_out! : h)),
      );
      setOkMsg(`Status → ${next.replaceAll("_", " ")}`);
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setPatchingId(null);
    }
  }

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,24rem)_1fr]">
      <form
        onSubmit={submit}
        className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Book hire-out
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          Wedding / burial / event bookings via{" "}
          <code>POST /api/hire-outs</code>. Optionally creates linked revenue.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Bus</span>
            <select
              value={busId}
              onChange={(e) => {
                const next = e.target.value;
                setBusId(next);
                const bus = buses.find((b) => b.id === next);
                if (bus) setSchoolId(bus.school_id);
              }}
              required
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              {busesAz.length === 0 ? (
                <option value="">No buses</option>
              ) : (
                busesAz.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label} · {b.plate_number}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Client name</span>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
              placeholder="e.g. Mwangi wedding party"
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Purpose</span>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as HirePurpose)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              >
                {PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as HireStatus)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Start</span>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              required
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">End</span>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              required
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Quoted amount (TZS)</span>
            <input
              type="number"
              min={0}
              step={1000}
              value={quotedAmount}
              onChange={(e) => setQuotedAmount(e.target.value)}
              placeholder="0"
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={createRevenue}
              onChange={(e) => setCreateRevenue(e.target.checked)}
              className="mt-0.5 rounded border-card-border"
            />
            <span>Create linked hire-out revenue when amount &gt; 0</span>
          </label>
          <button
            type="submit"
            disabled={saving || !busId}
            className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
          >
            {saving ? "Booking…" : "Book hire-out"}
          </button>
          {error ? (
            <p className="text-sm font-semibold text-danger">{error}</p>
          ) : null}
          {okMsg ? (
            <p className="text-sm font-semibold text-success">{okMsg}</p>
          ) : null}
        </div>
      </form>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Hire-out bookings
        </h2>
        {hireOuts.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No hire-outs yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
            {hireOuts.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-ink">{row.client_name}</p>
                  <p className="text-xs text-ink-muted">
                    {row.purpose} · {row.bus_label ?? row.bus_id.slice(0, 8)} ·{" "}
                    {new Date(row.start_at).toLocaleString()} →{" "}
                    {new Date(row.end_at).toLocaleString()}
                  </p>
                  {row.notes ? (
                    <p className="mt-1 text-xs text-ink-faint">{row.notes}</p>
                  ) : null}
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <p className="font-semibold text-electric-blue">
                    {money(row.currency, row.quoted_amount)}
                  </p>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-semibold uppercase tracking-wide text-ink-muted">
                      Status
                    </span>
                    <select
                      value={row.status}
                      disabled={patchingId === row.id}
                      onChange={(e) =>
                        updateStatus(row.id, e.target.value as HireStatus)
                      }
                      className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1.5 text-sm text-ink"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {dialog}
    </div>
  );
}
