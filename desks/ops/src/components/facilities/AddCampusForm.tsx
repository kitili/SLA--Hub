"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function AddCampusForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Campus name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() || undefined }),
      });
      const data = (await res.json()) as { school?: { name: string }; error?: string };
      if (!res.ok || !data.school) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      setName("");
      setSlug("");
      setSlugTouched(false);
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-(--radius-sm) border border-card-border bg-card px-3 py-2 text-sm font-semibold text-electric-blue hover:border-light-blue"
      >
        + Add campus
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-2 rounded-(--radius-sm) border border-card-border bg-card p-3 shadow-brand"
    >
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-semibold text-ink-muted">Campus name</span>
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          required
          autoFocus
          placeholder="e.g. Moshi"
          className="rounded-(--radius-sm) border border-card-border px-2 py-1.5 text-sm text-ink"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-semibold text-ink-muted">Slug</span>
        <input
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          placeholder="auto"
          className="rounded-(--radius-sm) border border-card-border px-2 py-1.5 text-sm text-ink"
        />
      </label>
      <button
        type="submit"
        disabled={saving}
        className="rounded-(--radius-sm) bg-electric-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
      >
        {saving ? "Saving…" : "Create"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-(--radius-sm) border border-card-border px-3 py-1.5 text-sm font-semibold text-ink-muted hover:bg-light-blue-30"
      >
        Cancel
      </button>
      {error ? <p className="w-full text-xs font-semibold text-danger">{error}</p> : null}
    </form>
  );
}
