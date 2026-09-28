"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QrDisplay } from "@/components/students/QrDisplay";
import { useConfirm } from "@/components/admin/ConfirmDialog";

type SchoolOption = { id: string; name: string };
type RouteOption = { id: string; name: string; direction: string; school_id: string };

type CreatedStudent = {
  id: string;
  first_name: string;
  last_name: string;
  class_name: string | null;
  qr_code: string | null;
  fee_balance: number;
  fee_currency: string;
  parent_name: string | null;
  parent_phone: string | null;
  school_name: string | null;
};

function formatFee(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString()}`;
}

export function AddStudentForm({
  schools,
  routes,
}: {
  schools: SchoolOption[];
  routes: RouteOption[];
}) {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [className, setClassName] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [feeBalance, setFeeBalance] = useState("");
  const [routeId, setRouteId] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [pickupName, setPickupName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedStudent | null>(null);
  const [pickupSaved, setPickupSaved] = useState(false);
  const { confirm, dialog } = useConfirm();

  const routesForCampus = useMemo(
    () => routes.filter((r) => r.school_id === schoolId),
    [routes, schoolId],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (
      !schoolId ||
      !firstName.trim() ||
      !lastName.trim() ||
      !parentName.trim() ||
      !parentPhone.trim() ||
      !feeBalance.trim() ||
      !routeId ||
      !lat.trim() ||
      !lng.trim() ||
      !Number.isFinite(latNum) ||
      !Number.isFinite(lngNum)
    ) {
      setError(
        "Campus, name, parent name/phone, transport fee, and pickup point (route + coordinates) are all required.",
      );
      return;
    }

    const school = schools.find((s) => s.id === schoolId);
    const route = routesForCampus.find((r) => r.id === routeId);
    const ok = await confirm({
      title: "Add this student?",
      message: `This creates ${firstName.trim()} ${lastName.trim()} (${
        school?.name ?? "selected campus"
      }) together with a QR code, parent record for ${parentName.trim()}, a starting transport fee of ${formatFee(
        Number(feeBalance),
        "TZS",
      )}, and a pickup point on ${route?.name ?? "the selected route"}${
        route ? ` (${route.direction.toUpperCase()})` : ""
      }.`,
      confirmLabel: "Add student",
    });
    if (!ok) return;

    setSaving(true);
    setError(null);
    setCreated(null);
    setPickupSaved(false);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          firstName,
          lastName,
          className: className || undefined,
          parentName,
          parentPhone,
          feeBalance: Number(feeBalance),
        }),
      });
      const data = (await res.json()) as {
        student?: CreatedStudent;
        error?: string;
      };
      if (!res.ok || !data.student) {
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setCreated(data.student);

      // Wire the new student to the same pickup-point mechanism Day 7 built.
      const stopRes = await fetch("/api/student-stops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: data.student.id,
          routeId,
          schoolId,
          lat: latNum,
          lng: lngNum,
          stopName: pickupName.trim() || undefined,
        }),
      });
      if (stopRes.ok) {
        setPickupSaved(true);
      } else {
        const stopData = (await stopRes.json()) as { error?: string };
        setError(
          `Student saved, but pickup point failed: ${stopData.error ?? "unknown error"}. Assign it manually on the Assignments page.`,
        );
      }

      setFirstName("");
      setLastName("");
      setClassName("");
      setParentName("");
      setParentPhone("");
      setFeeBalance("");
      setRouteId("");
      setLat("");
      setLng("");
      setPickupName("");
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <div className="mt-8 flex flex-col gap-6">
      {created ? (
        <div className="rounded-[var(--radius)] border border-success/30 bg-light-blue-30 p-6 shadow-[var(--shadow)]">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-success">
            Added
          </h2>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-lg font-bold text-ink">
                {created.first_name} {created.last_name}
              </p>
              <p className="text-sm text-ink-muted">
                {created.class_name ?? "—"} · {created.school_name ?? "—"}
              </p>
              <p className="mt-1 text-xs text-ink-faint">
                Parent phone: {created.parent_phone ?? "—"}
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">
                Transport fee:{" "}
                {formatFee(created.fee_balance, created.fee_currency)}
              </p>
              <p className="mt-1 text-xs text-ink-faint">
                Pickup point:{" "}
                {pickupSaved ? "saved" : "not saved — see error below"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-semibold uppercase text-ink-muted">
                  QR
                </p>
                <p className="font-mono text-sm text-electric-blue">
                  {created.qr_code ?? "—"}
                </p>
              </div>
              {created.qr_code ? <QrDisplay value={created.qr_code} /> : null}
            </div>
          </div>
        </div>
      ) : null}

      <form
        onSubmit={submit}
        className="flex flex-col gap-8 rounded-[var(--radius)] border border-card-border bg-card p-6 shadow-[var(--shadow)]"
      >
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Student
          </h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Campus</span>
              <select
                value={schoolId}
                onChange={(e) => {
                  setSchoolId(e.target.value);
                  setRouteId("");
                }}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                required
              >
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">First name</span>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                required
              />
            </label>
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Last name</span>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                required
              />
            </label>
            <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Class</span>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g. G3"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Parent
          </h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Parent name</span>
              <input
                type="text"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                required
              />
            </label>
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Parent phone</span>
              <input
                type="text"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="0755123456"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                required
              />
            </label>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Transport fee
          </h2>
          <p className="mt-1 text-xs text-ink-faint">
            This is the transport fee only — not school tuition.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">
                Starting transport fee balance (TZS)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={feeBalance}
                onChange={(e) => setFeeBalance(e.target.value)}
                placeholder="550000"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                required
              />
            </label>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Pickup point
          </h2>
          <p className="mt-1 text-xs text-ink-faint">
            Same mechanism as the Assignments page — creates this
            student&apos;s own stop at the exact coordinate, no matching to
            a nearby stop.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Route</span>
              <select
                value={routeId}
                onChange={(e) => setRouteId(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                required
              >
                <option value="">
                  {routesForCampus.length === 0
                    ? "No routes on this campus"
                    : "Select route"}
                </option>
                {routesForCampus.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.direction.toUpperCase()})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Latitude</span>
              <input
                type="text"
                inputMode="decimal"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="-3.376694"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                required
              />
            </label>
            <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Longitude</span>
              <input
                type="text"
                inputMode="decimal"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="36.901947"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                required
              />
            </label>
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Pickup landmark (optional)</span>
              <input
                type="text"
                value={pickupName}
                onChange={(e) => setPickupName(e.target.value)}
                placeholder="e.g. Maji ya Chai (Dampo)"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
          </div>
        </div>

        <p className="text-xs text-ink-faint">A QR code is generated automatically.</p>

        <button
          type="submit"
          disabled={saving}
          className="w-fit rounded-[var(--radius-sm)] bg-electric-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
        >
          {saving ? "Saving…" : "Add student"}
        </button>
        {error ? (
          <p className="text-sm font-semibold text-danger">{error}</p>
        ) : null}
      </form>
    </div>
    {dialog}
    </>
  );
}
