"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TripActions } from "@/components/trips/TripActions";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import type { Bus, TripWithBus } from "@/types/database";

type SchoolOption = { id: string; name: string; slug: string };
type DriverOption = { id: string; name: string };
type RouteOption = { id: string; name: string; direction: string; school_id: string };

type Props = {
  bus: Bus;
  schools: SchoolOption[];
  drivers: DriverOption[];
  routes: RouteOption[];
  routeLabel: string;
  trips: TripWithBus[];
};

export function BusRowActions({ bus, schools, drivers, routes, routeLabel, trips }: Props) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = useState(false);
  const [schoolId, setSchoolId] = useState(bus.school_id);
  const [label, setLabel] = useState(bus.label);
  const [plate, setPlate] = useState(bus.plate_number);
  const [capacity, setCapacity] = useState(String(bus.capacity));
  const [registeredCapacity, setRegisteredCapacity] = useState(
    bus.registered_capacity != null ? String(bus.registered_capacity) : "",
  );
  const [driverId, setDriverId] = useState(bus.driver_id ?? "");
  const [attendant, setAttendant] = useState(bus.attendant_name ?? "");
  const [owner, setOwner] = useState(bus.owner_name ?? "");
  const [insuranceExpiry, setInsuranceExpiry] = useState(bus.insurance_expiry ?? "");
  const [routeId, setRouteId] = useState(bus.route_id ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const routesForCampus = routes.filter((r) => r.school_id === schoolId);

  function startEdit() {
    setSchoolId(bus.school_id);
    setLabel(bus.label);
    setPlate(bus.plate_number);
    setCapacity(String(bus.capacity));
    setRegisteredCapacity(bus.registered_capacity != null ? String(bus.registered_capacity) : "");
    setDriverId(bus.driver_id ?? "");
    setAttendant(bus.attendant_name ?? "");
    setOwner(bus.owner_name ?? "");
    setInsuranceExpiry(bus.insurance_expiry ?? "");
    setRouteId(bus.route_id ?? "");
    setError(null);
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!label.trim() || !plate.trim()) {
      setError("Label and plate number are required");
      return;
    }
    let parsedCapacity: number | undefined;
    if (capacity.trim()) {
      const parsed = Number(capacity);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        setError("Capacity must be a whole number greater than 0");
        return;
      }
      parsedCapacity = parsed;
    }
    let parsedRegisteredCapacity: number | null = null;
    if (registeredCapacity.trim()) {
      const parsed = Number(registeredCapacity);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        setError("Registered capacity must be a whole number greater than 0");
        return;
      }
      parsedRegisteredCapacity = parsed;
    }

    const ok = await confirm({
      title: "Save bus changes?",
      message: `Save changes to bus "${bus.label}" (${plate.trim()})?`,
      confirmLabel: "Save",
    });
    if (!ok) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/buses/${bus.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          label: label.trim(),
          plateNumber: plate.trim(),
          capacity: parsedCapacity,
          registeredCapacity: parsedRegisteredCapacity,
          driverId: driverId || null,
          attendantName: attendant.trim() || null,
          ownerName: owner.trim() || null,
          insuranceExpiry: insuranceExpiry || null,
          routeId: routeId || null,
        }),
      });
      const data = (await res.json()) as { bus?: Bus; error?: string };
      if (!res.ok || !data.bus) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "Delete this bus?",
      message: `Delete bus "${bus.label}" (${bus.plate_number})? This removes its trips, boarding, and maintenance history.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/buses/${bus.id}`, { method: "DELETE" });
      const data = (await res.json()) as { ok?: true; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <>
        <form
          onSubmit={save}
          className="rounded-[var(--radius-sm)] border border-card-border bg-light-blue-30/40 p-4"
        >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Campus</span>
            <select
              value={schoolId}
              onChange={(e) => {
                setSchoolId(e.target.value);
                // A route belongs to one campus -- clear the pick if it no
                // longer matches, same as budgets/revenue targets do.
                if (!routes.some((r) => r.id === routeId && r.school_id === e.target.value)) {
                  setRouteId("");
                }
              }}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Route</span>
            <select
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              <option value="">No route assigned</option>
              {routesForCampus.map((route) => (
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
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                required
              />
            </label>
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Plate number</span>
              <input
                type="text"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
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
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Registered capacity</span>
              <input
                type="text"
                inputMode="numeric"
                value={registeredCapacity}
                onChange={(e) => setRegisteredCapacity(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Driver</span>
              <select
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
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
                value={attendant}
                onChange={(e) => setAttendant(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Owner</span>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Insurance expiry</span>
            <input
              type="date"
              value={insuranceExpiry}
              onChange={(e) => setInsuranceExpiry(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-sm font-semibold text-ink-muted hover:underline"
          >
            Cancel
          </button>
        </div>
        {error ? (
          <p className="mt-3 text-sm font-semibold text-danger">{error}</p>
        ) : null}
        </form>
        {dialog}
      </>
    );
  }

  return (
    <>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <Link
          href={`/admin/buses/${bus.id}`}
          className="font-semibold text-ink hover:text-electric-blue hover:underline"
        >
          {bus.label}
        </Link>
        <p className="mt-1 text-sm text-ink-muted">{bus.plate_number}</p>
        <p className="mt-1 text-xs text-ink-faint">
          Driver: {bus.driver_name ?? "Not assigned"}
        </p>
        <span className="mt-2 inline-block rounded-[var(--radius-sm)] bg-light-blue-30 px-2 py-1 text-xs font-semibold text-electric-blue">
          Capacity {bus.capacity}
          {bus.registered_capacity != null ? ` (reg. ${bus.registered_capacity})` : ""}
        </span>{" "}
        <span className="mt-2 inline-block rounded-[var(--radius-sm)] px-2 py-1 text-xs font-semibold text-ink-muted">
          {routeLabel}
        </span>
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={startEdit}
            className="text-xs font-semibold text-electric-blue hover:underline"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={deleting}
            className="text-xs font-semibold text-danger hover:underline disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
        {error ? (
          <p className="mt-2 text-xs font-semibold text-danger">{error}</p>
        ) : null}
      </div>
      <TripActions
        busId={bus.id}
        busLabel={bus.label}
        busCapacity={bus.capacity}
        trips={trips}
      />
    </div>
    {dialog}
    </>
  );
}
