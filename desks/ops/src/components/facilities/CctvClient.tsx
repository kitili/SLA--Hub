"use client";

import { useMemo, useState } from "react";
import type { Cctv } from "@/lib/db/facilities";

type SchoolOption = { id: string; name: string; slug: string };

type Props = {
  schools: SchoolOption[];
  initialCameras: Cctv[];
};

export function CctvClient({ schools, initialCameras }: Props) {
  const [cameras, setCameras] = useState(initialCameras);
  const [campusFilter, setCampusFilter] = useState<string>("all");
  const schoolName = (id: string | null) =>
    schools.find((s) => s.id === id)?.name ?? "—";
  const filtered = useMemo(
    () =>
      campusFilter === "all"
        ? cameras
        : cameras.filter((c) => c.school_id === campusFilter),
    [cameras, campusFilter],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [cameraType, setCameraType] = useState("");
  const [location, setLocation] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [description, setDescription] = useState("");
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");

  function clearFlash() {
    setError(null);
    setOkMsg(null);
  }

  function startEdit(c: Cctv) {
    setShowForm(true);
    setEditingId(c.id);
    setCameraType(c.camera_type ?? "");
    setLocation(c.location);
    setQuantity(String(c.quantity));
    setDescription(c.description ?? "");
    setSchoolId(c.school_id ?? "");
    clearFlash();
  }

  function cancelEdit() {
    setShowForm(false);
    setEditingId(null);
    setCameraType("");
    setLocation("");
    setQuantity("1");
    setDescription("");
  }

  async function submitCamera(e: React.FormEvent) {
    e.preventDefault();
    clearFlash();
    if (!location.trim()) {
      setError("Location is required");
      return;
    }
    setSaving(true);
    try {
      const isEdit = Boolean(editingId);
      const res = await fetch(
        isEdit ? `/api/facilities/cctv/${editingId}` : "/api/facilities/cctv",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cameraType: cameraType.trim() || undefined,
            location: location.trim(),
            quantity: Number(quantity) || 1,
            description: description.trim() || undefined,
            schoolId: schoolId || undefined,
          }),
        },
      );
      const data = (await res.json()) as { camera?: Cctv; error?: string };
      if (!res.ok || !data.camera) {
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setCameras((prev) =>
        isEdit
          ? prev.map((c) => (c.id === data.camera!.id ? data.camera! : c))
          : [...prev, data.camera!],
      );
      setOkMsg(isEdit ? "Camera updated" : "Camera added");
      cancelEdit();
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCameraRow(id: string) {
    if (!confirm("Delete this camera entry?")) return;
    const res = await fetch(`/api/facilities/cctv/${id}`, { method: "DELETE" });
    if (res.ok) {
      setCameras((prev) => prev.filter((c) => c.id !== id));
      if (editingId === id) cancelEdit();
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
          onSubmit={submitCamera}
          className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            {editingId ? "Edit camera" : "Add camera"}
          </h2>
          <div className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Location</span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                placeholder="e.g. Library"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Type</span>
              <input
                value={cameraType}
                onChange={(e) => setCameraType(e.target.value)}
                placeholder="e.g. TAPO, ZOSI"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Quantity</span>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Description</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Wireless"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
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
                {saving ? "Saving…" : editingId ? "Update camera" : "Save camera"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={cancelEdit}
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
              Cameras
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (showForm) cancelEdit();
                  else setShowForm(true);
                }}
                className="rounded-[var(--radius-sm)] bg-electric-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-light"
              >
                {showForm ? "Close" : "+ Add camera"}
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
          {filtered.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">
              {cameras.length === 0 ? "No cameras yet." : "No cameras for this campus."}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
              {filtered.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-ink">{c.location}</p>
                    <p className="text-xs text-ink-muted">
                      {schoolName(c.school_id)} · {c.camera_type ?? "—"} · Qty {c.quantity}
                      {c.description ? ` · ${c.description}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="text-xs font-semibold text-electric-blue hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCameraRow(c.id)}
                      className="text-xs font-semibold text-danger hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
