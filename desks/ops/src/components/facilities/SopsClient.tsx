"use client";

import { useMemo, useState } from "react";
import type { Sop } from "@/lib/db/facilities";

type SchoolOption = { id: string; name: string; slug: string };

type Props = {
  schools: SchoolOption[];
  initialSops: Sop[];
};

export function SopsClient({ schools, initialSops }: Props) {
  const [sops, setSops] = useState(initialSops);
  const [campusFilter, setCampusFilter] = useState<string>("all");
  const schoolName = (id: string | null) =>
    id ? schools.find((s) => s.id === id)?.name ?? "—" : "All campuses";
  const filtered = useMemo(
    () =>
      campusFilter === "all"
        ? sops
        : sops.filter((s) => s.school_id === campusFilter),
    [sops, campusFilter],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [schoolId, setSchoolId] = useState("");

  function clearFlash() {
    setError(null);
    setOkMsg(null);
  }

  function startEdit(sop: Sop) {
    setShowForm(true);
    setEditingId(sop.id);
    setTitle(sop.title);
    setCategory(sop.category ?? "");
    setContent(sop.content);
    setSchoolId(sop.school_id ?? "");
    clearFlash();
  }

  function cancelEdit() {
    setShowForm(false);
    setEditingId(null);
    setTitle("");
    setCategory("");
    setContent("");
    setSchoolId("");
  }

  async function submitSop(e: React.FormEvent) {
    e.preventDefault();
    clearFlash();
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required");
      return;
    }
    setSaving(true);
    try {
      const isEdit = Boolean(editingId);
      const res = await fetch(
        isEdit ? `/api/facilities/sops/${editingId}` : "/api/facilities/sops",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            category: category.trim() || undefined,
            content: content.trim(),
            schoolId: schoolId || undefined,
          }),
        },
      );
      const data = (await res.json()) as { sop?: Sop; error?: string };
      if (!res.ok || !data.sop) {
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setSops((prev) =>
        isEdit
          ? prev.map((s) => (s.id === data.sop!.id ? data.sop! : s))
          : [...prev, data.sop!],
      );
      setOkMsg(isEdit ? "SOP updated" : "SOP added");
      cancelEdit();
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSopRow(id: string) {
    if (!confirm("Delete this SOP?")) return;
    const res = await fetch(`/api/facilities/sops/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSops((prev) => prev.filter((s) => s.id !== id));
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
            onSubmit={submitSop}
            className="rounded-(--radius) border border-card-border bg-card p-4 shadow-brand"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {editingId ? "Edit SOP" : "Add SOP"}
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g. Generator daily checks"
                  className="rounded-(--radius-sm) border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Category</span>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Head of Facilities · Daily"
                  className="rounded-(--radius-sm) border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Content</span>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  rows={6}
                  className="rounded-(--radius-sm) border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Campus</span>
                <select
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                  className="rounded-(--radius-sm) border border-card-border px-3 py-2 text-ink"
                >
                  <option value="">All campuses</option>
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
                  className="rounded-(--radius-sm) bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
                >
                  {saving ? "Saving…" : editingId ? "Update SOP" : "Save SOP"}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-(--radius-sm) border border-card-border px-4 py-2 text-sm font-semibold text-ink-muted hover:bg-light-blue-30"
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
              SOPs
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
                {showForm ? "Close" : "+ Add SOP"}
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
              {sops.length === 0 ? "No SOPs yet." : "No SOPs for this campus."}
            </p>
          ) : (
            <ul className="mt-3 grid gap-4 lg:grid-cols-2">
              {filtered.map((sop) => {
                const isOpen = expandedId === sop.id;
                return (
                  <li
                    key={sop.id}
                    className="rounded-(--radius) border border-card-border bg-card p-5 shadow-brand"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-ink">{sop.title}</p>
                          {sop.category ? (
                            <span className="rounded-full bg-light-blue-30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-electric-blue">
                              {sop.category}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-ink-muted">{schoolName(sop.school_id)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setExpandedId(isOpen ? null : sop.id)}
                          className="text-xs font-semibold text-electric-blue hover:underline"
                        >
                          {isOpen ? "Collapse" : "Expand"}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(sop)}
                          className="text-xs font-semibold text-electric-blue hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSopRow(sop.id)}
                          className="text-xs font-semibold text-danger hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="mt-4 line-clamp-4 whitespace-pre-wrap text-sm text-ink-muted">
                      {sop.content}
                    </p>
                    {isOpen ? (
                      <p className="mt-4 whitespace-pre-wrap border-t border-card-border pt-4 text-sm text-ink-muted">
                        {sop.content}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
