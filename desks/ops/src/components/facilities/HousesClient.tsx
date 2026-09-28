"use client";

import { Fragment, useMemo, useState } from "react";
import type { House, HouseOccupancy, FurnitureStatus } from "@/lib/db/facilities";

type SchoolOption = { id: string; name: string; slug: string };

type Props = {
  schools: SchoolOption[];
  initialHouses: House[];
  initialOccupancy: HouseOccupancy[];
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function HousesClient({ schools, initialHouses, initialOccupancy }: Props) {
  const [houses, setHouses] = useState(initialHouses);
  const [occupancy, setOccupancy] = useState(initialOccupancy);
  const [campusFilter, setCampusFilter] = useState<string>("all");
  const schoolName = (id: string | null) =>
    schools.find((s) => s.id === id)?.name ?? "—";
  const filteredHouses = useMemo(
    () =>
      campusFilter === "all"
        ? houses
        : houses.filter((h) => h.school_id === campusFilter),
    [houses, campusFilter],
  );
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedHouseId, setExpandedHouseId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingHouseId, setEditingHouseId] = useState<string | null>(null);

  const [houseLetter, setHouseLetter] = useState("");
  const [houseName, setHouseName] = useState("");
  const [roomsDescription, setRoomsDescription] = useState("");
  const [furnitureStatus, setFurnitureStatus] = useState<FurnitureStatus>("unfurnished");
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");

  const [occupant, setOccupant] = useState("");
  const [periodStart, setPeriodStart] = useState(todayIso);
  const [periodEnd, setPeriodEnd] = useState(todayIso);
  const [occupancyNotes, setOccupancyNotes] = useState("");
  const [editingOccupancyId, setEditingOccupancyId] = useState<string | null>(null);

  function clearFlash() {
    setError(null);
    setOkMsg(null);
  }

  function startEditHouse(h: House) {
    setShowForm(true);
    setEditingHouseId(h.id);
    setHouseLetter(h.house_letter ?? "");
    setHouseName(h.house_name);
    setRoomsDescription(h.rooms_description ?? "");
    setFurnitureStatus(h.furniture_status ?? "unfurnished");
    setSchoolId(h.school_id ?? schools[0]?.id ?? "");
    clearFlash();
  }

  function cancelEditHouse() {
    setShowForm(false);
    setEditingHouseId(null);
    setHouseLetter("");
    setHouseName("");
    setRoomsDescription("");
  }

  function startEditOccupancy(o: HouseOccupancy) {
    setExpandedHouseId(o.house_id);
    setEditingOccupancyId(o.id);
    setOccupant(o.occupant);
    setPeriodStart(o.period_start);
    setPeriodEnd(o.period_end);
    setOccupancyNotes(o.notes ?? "");
    clearFlash();
  }

  function cancelOccupancyEdit() {
    setEditingOccupancyId(null);
    setOccupant("");
    setOccupancyNotes("");
  }

  async function submitHouse(e: React.FormEvent) {
    e.preventDefault();
    clearFlash();
    if (!houseName.trim()) {
      setError("House name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        editingHouseId ? `/api/facilities/houses/${editingHouseId}` : "/api/facilities/houses",
        {
          method: editingHouseId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            houseLetter: houseLetter.trim() || undefined,
            houseName: houseName.trim(),
            roomsDescription: roomsDescription.trim() || undefined,
            furnitureStatus,
            schoolId: schoolId || undefined,
          }),
        },
      );
      const data = (await res.json()) as { house?: House; error?: string };
      if (!res.ok || !data.house) {
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setHouses((prev) =>
        editingHouseId
          ? prev.map((h) => (h.id === data.house!.id ? data.house! : h))
          : [...prev, data.house!],
      );
      setOkMsg(editingHouseId ? "House updated" : "House added");
      setEditingHouseId(null);
      setHouseLetter("");
      setHouseName("");
      setRoomsDescription("");
      setShowForm(false);
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  async function deleteHouseRow(id: string) {
    if (!confirm("Delete this house? Its occupancy history will be deleted too.")) return;
    const res = await fetch(`/api/facilities/houses/${id}`, { method: "DELETE" });
    if (res.ok) {
      setHouses((prev) => prev.filter((h) => h.id !== id));
      setOccupancy((prev) => prev.filter((o) => o.house_id !== id));
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
    }
  }

  async function submitOccupancy(houseId: string, e: React.FormEvent) {
    e.preventDefault();
    clearFlash();
    if (!occupant.trim()) {
      setError("Occupant is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        editingOccupancyId
          ? `/api/facilities/house-occupancy/${editingOccupancyId}`
          : "/api/facilities/house-occupancy",
        {
          method: editingOccupancyId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            houseId,
            periodStart,
            periodEnd,
            occupant: occupant.trim(),
            notes: occupancyNotes.trim() || undefined,
          }),
        },
      );
      const data = (await res.json()) as { occupancy?: HouseOccupancy; error?: string };
      if (!res.ok || !data.occupancy) {
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setOccupancy((prev) =>
        editingOccupancyId
          ? prev.map((o) => (o.id === data.occupancy!.id ? data.occupancy! : o))
          : [data.occupancy!, ...prev],
      );
      setOkMsg(editingOccupancyId ? "Occupancy entry updated" : "Occupancy entry added");
      setEditingOccupancyId(null);
      setOccupant("");
      setOccupancyNotes("");
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  async function deleteOccupancyRow(id: string) {
    if (!confirm("Delete this occupancy entry?")) return;
    const res = await fetch(`/api/facilities/house-occupancy/${id}`, { method: "DELETE" });
    if (res.ok) {
      setOccupancy((prev) => prev.filter((o) => o.id !== id));
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
    }
  }

  return (
    <div className="mt-6">
      {error ? <p className="mb-4 text-sm font-semibold text-danger">{error}</p> : null}
      {okMsg ? <p className="mb-4 text-sm font-semibold text-success">{okMsg}</p> : null}

      <div className={showForm ? "grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start" : "grid gap-8"}>
        {showForm ? (
        <form
          onSubmit={submitHouse}
          className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            {editingHouseId ? "Edit house" : "Add house"}
          </h2>
          <div className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Letter</span>
              <input
                value={houseLetter}
                onChange={(e) => setHouseLetter(e.target.value)}
                placeholder="e.g. A"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Name</span>
              <input
                value={houseName}
                onChange={(e) => setHouseName(e.target.value)}
                required
                placeholder="e.g. Elephant"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Rooms</span>
              <input
                value={roomsDescription}
                onChange={(e) => setRoomsDescription(e.target.value)}
                placeholder="e.g. 2 rooms, kitchen, toilet, living room"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Furniture</span>
              <select
                value={furnitureStatus}
                onChange={(e) => setFurnitureStatus(e.target.value as FurnitureStatus)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              >
                <option value="furnished">Furnished</option>
                <option value="unfurnished">Unfurnished</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Campus</span>
              <select
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              >
                <option value="">All / none</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
              >
                {saving ? "Saving…" : editingHouseId ? "Save changes" : "Save house"}
              </button>
              {editingHouseId ? (
                <button
                  type="button"
                  onClick={cancelEditHouse}
                  className="rounded-[var(--radius-sm)] border border-card-border px-4 py-2 text-sm font-semibold text-ink-muted hover:bg-light-blue-30"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </form>
        ) : null}

        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Houses
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => (showForm ? cancelEditHouse() : setShowForm(true))}
                className="rounded-[var(--radius-sm)] bg-electric-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-light"
              >
                {showForm ? "Close" : "+ Add house"}
              </button>
              <select
                value={campusFilter}
                onChange={(e) => setCampusFilter(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-1.5 text-sm text-ink"
              >
                <option value="all">All campuses</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {filteredHouses.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">
              {houses.length === 0
                ? "No houses yet — add your first one below."
                : "No houses for this campus."}
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-light-blue-30 text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Campus</th>
                    <th className="px-3 py-2 font-semibold">Letter</th>
                    <th className="px-3 py-2 font-semibold">Name of the house</th>
                    <th className="px-3 py-2 font-semibold">Rooms</th>
                    <th className="px-3 py-2 font-semibold">Furniture</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Current occupant</th>
                    <th className="px-3 py-2 font-semibold"> </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHouses.map((h) => {
                    const isOpen = expandedHouseId === h.id;
                    const houseOccupancy = occupancy.filter((o) => o.house_id === h.id);
                    const today = todayIso();
                    const current =
                      houseOccupancy.find(
                        (o) => o.period_start <= today && today <= o.period_end,
                      ) ?? null;
                    const taken = Boolean(current);
                    return (
                      <Fragment key={h.id}>
                        <tr className="border-t border-card-border align-top">
                          <td className="px-3 py-2 text-ink-muted">
                            {schoolName(h.school_id)}
                          </td>
                          <td className="px-3 py-2 font-bold text-ink">
                            {h.house_letter ?? "—"}
                          </td>
                          <td className="px-3 py-2 font-semibold text-ink">{h.house_name}</td>
                          <td className="max-w-[14rem] px-3 py-2 text-ink-muted">
                            {h.rooms_description ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                h.furniture_status === "furnished"
                                  ? "bg-success-15 text-success"
                                  : "bg-gold-15 text-ink-muted"
                              }`}
                            >
                              {h.furniture_status === "furnished"
                                ? "Furnished"
                                : "Unfurnished"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                taken
                                  ? "bg-danger-15 text-danger"
                                  : "bg-success-15 text-success"
                              }`}
                            >
                              {taken ? "Taken" : "Available"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-ink-muted">
                            {current ? (
                              <>
                                <strong className="text-ink">{current.occupant}</strong>
                                <span className="block text-xs">
                                  {current.period_start} → {current.period_end}
                                </span>
                              </>
                            ) : houseOccupancy.length > 0 ? (
                              <span className="text-xs text-ink-faint">
                                Vacant — last: {houseOccupancy[0]!.occupant} (to{" "}
                                {houseOccupancy[0]!.period_end})
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedHouseId(isOpen ? null : h.id);
                                cancelOccupancyEdit();
                              }}
                              className="mr-2 text-xs font-semibold text-electric-blue hover:underline"
                            >
                              {isOpen ? "Hide" : "Occupancy"}
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditHouse(h)}
                              className="mr-2 text-xs font-semibold text-electric-blue hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteHouseRow(h.id)}
                              className="text-xs font-semibold text-danger hover:underline"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                        {isOpen ? (
                          <tr className="border-t border-card-border bg-light-blue-30/40">
                            <td colSpan={8} className="px-3 py-3">
                              <form
                                onSubmit={(e) => submitOccupancy(h.id, e)}
                                className="flex flex-wrap items-end gap-2"
                              >
                                <label className="flex flex-col gap-1 text-xs">
                                  <span className="font-semibold text-ink-muted">Occupant</span>
                                  <input
                                    value={occupant}
                                    onChange={(e) => setOccupant(e.target.value)}
                                    required
                                    className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1.5 text-sm text-ink"
                                  />
                                </label>
                                <label className="flex flex-col gap-1 text-xs">
                                  <span className="font-semibold text-ink-muted">From</span>
                                  <input
                                    type="date"
                                    value={periodStart}
                                    onChange={(e) => setPeriodStart(e.target.value)}
                                    className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1.5 text-sm text-ink"
                                  />
                                </label>
                                <label className="flex flex-col gap-1 text-xs">
                                  <span className="font-semibold text-ink-muted">To</span>
                                  <input
                                    type="date"
                                    value={periodEnd}
                                    onChange={(e) => setPeriodEnd(e.target.value)}
                                    className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1.5 text-sm text-ink"
                                  />
                                </label>
                                <label className="flex flex-col gap-1 text-xs">
                                  <span className="font-semibold text-ink-muted">Notes</span>
                                  <input
                                    value={occupancyNotes}
                                    onChange={(e) => setOccupancyNotes(e.target.value)}
                                    className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1.5 text-sm text-ink"
                                  />
                                </label>
                                <button
                                  type="submit"
                                  disabled={saving}
                                  className="rounded-[var(--radius-sm)] bg-electric-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-light disabled:opacity-60"
                                >
                                  {editingOccupancyId ? "Save" : "Add"}
                                </button>
                                {editingOccupancyId ? (
                                  <button
                                    type="button"
                                    onClick={cancelOccupancyEdit}
                                    className="rounded-[var(--radius-sm)] border border-card-border px-3 py-1.5 text-xs font-semibold text-ink-muted hover:bg-light-blue-30"
                                  >
                                    Cancel
                                  </button>
                                ) : null}
                              </form>
                              {houseOccupancy.length === 0 ? (
                                <p className="mt-3 text-xs text-ink-muted">
                                  No occupancy entries yet.
                                </p>
                              ) : (
                                <ul className="mt-3 flex flex-col gap-2">
                                  {houseOccupancy.map((o) => (
                                    <li
                                      key={o.id}
                                      className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-card px-3 py-2 text-xs"
                                    >
                                      <span>
                                        <strong>{o.occupant}</strong> · {o.period_start} →{" "}
                                        {o.period_end}
                                        {o.notes ? ` · ${o.notes}` : ""}
                                      </span>
                                      <span className="flex shrink-0 items-center gap-3">
                                        <button
                                          type="button"
                                          onClick={() => startEditOccupancy(o)}
                                          className="font-semibold text-electric-blue hover:underline"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => deleteOccupancyRow(o.id)}
                                          className="font-semibold text-danger hover:underline"
                                        >
                                          Delete
                                        </button>
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
