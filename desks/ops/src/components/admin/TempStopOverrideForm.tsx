"use client";

import { useMemo, useState } from "react";

type AssignmentOption = {
  studentId: string;
  studentLabel: string;
  routeId: string;
  routeName: string;
  stopId: string;
  stopName: string;
  lat: number | null;
  lng: number | null;
};

export function TempStopOverrideForm({
  options,
}: {
  options: AssignmentOption[];
}) {
  const [studentKey, setStudentKey] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const selected = useMemo(
    () => options.find((o) => `${o.studentId}|${o.stopId}` === studentKey) ?? null,
    [options, studentKey],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/stop-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selected.studentId,
          routeId: selected.routeId,
          originalStopId: selected.stopId,
          lat: Number(lat),
          lng: Number(lng),
          name: name.trim() || undefined,
          startsOn,
          endsOn,
          reason: reason.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string; hint?: string };
      if (!res.ok) {
        setErr([data.error, data.hint].filter(Boolean).join(" "));
        return;
      }
      setMsg(
        `Temporary location saved for ${selected.studentLabel} (${startsOn} → ${endsOn}). Drivers will see it on Navigate.`,
      );
      setLat("");
      setLng("");
      setName("");
      setReason("");
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="mt-6 rounded-[var(--radius)] border border-gold/40 bg-gradient-to-br from-gold/10 to-white p-4 shadow-[var(--shadow)]"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-electric-blue">
        Temporary pickup change
      </p>
      <h2 className="mt-1 font-display text-lg font-bold text-electric-blue">
        Parent asks for a different location (date range)
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Overrides the student’s pin on the driver Navigate map for the dates
        you set. Permanent assignments stay unchanged.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-semibold text-ink">Student / stop</span>
          <select
            required
            value={studentKey}
            onChange={(e) => {
              setStudentKey(e.target.value);
              const opt = options.find(
                (o) => `${o.studentId}|${o.stopId}` === e.target.value,
              );
              if (opt?.lat != null && opt.lng != null) {
                setLat(String(opt.lat));
                setLng(String(opt.lng));
              }
            }}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
          >
            <option value="">Select…</option>
            {options.map((o) => (
              <option
                key={`${o.studentId}|${o.stopId}`}
                value={`${o.studentId}|${o.stopId}`}
              >
                {o.studentLabel} · {o.routeName} · {o.stopName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Lat</span>
          <input
            required
            type="number"
            step="any"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Lng</span>
          <input
            required
            type="number"
            step="any"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Label (optional)</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Auntie’s house"
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Reason</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Parent request — one week"
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Starts</span>
          <input
            required
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Ends</span>
          <input
            required
            type="date"
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
          />
        </label>
      </div>

      {err ? (
        <p className="mt-3 text-sm text-danger">{err}</p>
      ) : null}
      {msg ? (
        <p className="mt-3 text-sm text-success">{msg}</p>
      ) : null}

      <button
        type="submit"
        disabled={busy || options.length === 0}
        className="mt-4 rounded-xl bg-electric-blue px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save temporary location"}
      </button>
    </form>
  );
}
