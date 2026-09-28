"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/admin/ConfirmDialog";

type SchoolOption = { id: string; name: string; slug: string };
type DriverOption = { id: string; name: string };
type RouteOption = { id: string; name: string; direction: string; school_id: string };

type Props = {
  schools: SchoolOption[];
  drivers: DriverOption[];
  routes: RouteOption[];
};

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function FleetAdminForms({ schools, drivers, routes }: Props) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();

  // --- Add campus ---
  const [campusName, setCampusName] = useState("");
  const [campusSlug, setCampusSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [campusSaving, setCampusSaving] = useState(false);
  const [campusError, setCampusError] = useState<string | null>(null);
  const [campusOk, setCampusOk] = useState<string | null>(null);

  function onCampusNameChange(value: string) {
    setCampusName(value);
    if (!slugTouched) setCampusSlug(slugify(value));
  }

  async function submitCampus(e: React.FormEvent) {
    e.preventDefault();
    setCampusError(null);
    setCampusOk(null);
    if (!campusName.trim()) {
      setCampusError("Campus name is required");
      return;
    }

    const ok = await confirm({
      title: "Create campus?",
      message: `Create campus "${campusName.trim()}"${campusSlug.trim() ? ` (slug: ${campusSlug.trim()})` : ""}?`,
      confirmLabel: "Create",
    });
    if (!ok) return;

    setCampusSaving(true);
    try {
      const res = await fetch("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campusName.trim(),
          slug: campusSlug.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        school?: { name: string };
        error?: string;
      };
      if (!res.ok || !data.school) {
        setCampusError(data.error ?? `Failed (${res.status})`);
        return;
      }
      setCampusOk(`Campus "${data.school.name}" created`);
      setCampusName("");
      setCampusSlug("");
      setSlugTouched(false);
      router.refresh();
    } catch {
      setCampusError("Network error — try again");
    } finally {
      setCampusSaving(false);
    }
  }

  // --- Add bus ---
  const [busSchoolId, setBusSchoolId] = useState(schools[0]?.id ?? "");
  const [busLabel, setBusLabel] = useState("");
  const [busPlate, setBusPlate] = useState("");
  const [busCapacity, setBusCapacity] = useState("");
  const [busRegisteredCapacity, setBusRegisteredCapacity] = useState("");
  const [busDriverId, setBusDriverId] = useState("");
  const [busAttendant, setBusAttendant] = useState("");
  const [busOwner, setBusOwner] = useState("");
  const [busInsuranceExpiry, setBusInsuranceExpiry] = useState("");
  const [busRouteId, setBusRouteId] = useState("");
  const [busSaving, setBusSaving] = useState(false);
  const [busError, setBusError] = useState<string | null>(null);
  const [busOk, setBusOk] = useState<string | null>(null);

  const routesForBusCampus = routes.filter((r) => r.school_id === busSchoolId);

  async function submitBus(e: React.FormEvent) {
    e.preventDefault();
    setBusError(null);
    setBusOk(null);

    if (!busSchoolId || !busLabel.trim() || !busPlate.trim()) {
      setBusError("Pick a campus, and enter a label and plate number");
      return;
    }

    let capacity: number | undefined;
    if (busCapacity.trim()) {
      const parsed = Number(busCapacity);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        setBusError("Capacity must be a whole number greater than 0");
        return;
      }
      capacity = parsed;
    }
    let registeredCapacity: number | undefined;
    if (busRegisteredCapacity.trim()) {
      const parsed = Number(busRegisteredCapacity);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        setBusError("Registered capacity must be a whole number greater than 0");
        return;
      }
      registeredCapacity = parsed;
    }

    const busSchoolName = schools.find((s) => s.id === busSchoolId)?.name ?? "the selected campus";
    const ok = await confirm({
      title: "Add bus?",
      message: `Add bus "${busLabel.trim()}" (plate ${busPlate.trim()}) to ${busSchoolName}?`,
      confirmLabel: "Add bus",
    });
    if (!ok) return;

    setBusSaving(true);
    try {
      const res = await fetch("/api/buses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: busSchoolId,
          label: busLabel.trim(),
          plateNumber: busPlate.trim(),
          capacity,
          registeredCapacity,
          driverId: busDriverId || undefined,
          attendantName: busAttendant.trim() || undefined,
          ownerName: busOwner.trim() || undefined,
          insuranceExpiry: busInsuranceExpiry || undefined,
          routeId: busRouteId || undefined,
        }),
      });
      const data = (await res.json()) as {
        bus?: { label: string };
        error?: string;
      };
      if (!res.ok || !data.bus) {
        setBusError(data.error ?? `Failed (${res.status})`);
        return;
      }
      setBusOk(`Bus "${data.bus.label}" created`);
      setBusLabel("");
      setBusPlate("");
      setBusCapacity("");
      setBusRegisteredCapacity("");
      setBusDriverId("");
      setBusAttendant("");
      setBusOwner("");
      setBusInsuranceExpiry("");
      setBusRouteId("");
      router.refresh();
    } catch {
      setBusError("Network error — try again");
    } finally {
      setBusSaving(false);
    }
  }

  return (
    <>
    <div className="mt-6 grid gap-6 sm:grid-cols-2">
      <form
        onSubmit={submitCampus}
        className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Add campus
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Name</span>
            <input
              type="text"
              value={campusName}
              onChange={(e) => onCampusNameChange(e.target.value)}
              placeholder="e.g. Njiro Campus"
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Slug</span>
            <input
              type="text"
              value={campusSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setCampusSlug(e.target.value);
              }}
              placeholder="auto-generated from name"
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={campusSaving}
          className="mt-4 rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
        >
          {campusSaving ? "Saving…" : "Add campus"}
        </button>
        {campusError ? (
          <p className="mt-3 text-sm font-semibold text-danger">{campusError}</p>
        ) : null}
        {campusOk ? (
          <p className="mt-3 text-sm font-semibold text-success">{campusOk}</p>
        ) : null}
      </form>

      <form
        onSubmit={submitBus}
        className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Add bus
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Campus</span>
            <select
              value={busSchoolId}
              onChange={(e) => {
                setBusSchoolId(e.target.value);
                if (!routes.some((r) => r.id === busRouteId && r.school_id === e.target.value)) {
                  setBusRouteId("");
                }
              }}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              required
            >
              {schools.length === 0 ? (
                <option value="">No campuses yet</option>
              ) : (
                schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Route</span>
            <select
              value={busRouteId}
              onChange={(e) => setBusRouteId(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              <option value="">No route assigned</option>
              {routesForBusCampus.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.name} ({route.direction.toUpperCase()})
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Label</span>
              <input
                type="text"
                value={busLabel}
                onChange={(e) => setBusLabel(e.target.value)}
                placeholder="e.g. Hiace XYZ"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                required
              />
            </label>
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Plate number</span>
              <input
                type="text"
                value={busPlate}
                onChange={(e) => setBusPlate(e.target.value)}
                placeholder="e.g. T 123 ABC (or TBA if not yet known)"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                required
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Capacity (max)</span>
              <input
                type="text"
                inputMode="numeric"
                value={busCapacity}
                onChange={(e) => setBusCapacity(e.target.value)}
                placeholder="defaults to 40"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Registered capacity</span>
              <input
                type="text"
                inputMode="numeric"
                value={busRegisteredCapacity}
                onChange={(e) => setBusRegisteredCapacity(e.target.value)}
                placeholder="optional"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Driver</span>
              <select
                value={busDriverId}
                onChange={(e) => setBusDriverId(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              >
                <option value="">Not assigned</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Attendant</span>
              <input
                type="text"
                value={busAttendant}
                onChange={(e) => setBusAttendant(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Owner</span>
              <input
                type="text"
                value={busOwner}
                onChange={(e) => setBusOwner(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Insurance expiry</span>
            <input
              type="date"
              value={busInsuranceExpiry}
              onChange={(e) => setBusInsuranceExpiry(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={busSaving || schools.length === 0}
          className="mt-4 rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
        >
          {busSaving ? "Saving…" : "Add bus"}
        </button>
        {busError ? (
          <p className="mt-3 text-sm font-semibold text-danger">{busError}</p>
        ) : null}
        {busOk ? (
          <p className="mt-3 text-sm font-semibold text-success">{busOk}</p>
        ) : null}
      </form>
    </div>
    {dialog}
    </>
  );
}
