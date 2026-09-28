"use client";

import { useState } from "react";

export function ExportCsvButton({
  entity,
  label = "Export CSV",
}: {
  entity: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/export/${entity}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(cd);
      const filename = match?.[1] ?? `${entity}.csv`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void download()}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-(--radius-sm) border border-card-border bg-card px-3 py-2 text-sm font-semibold text-electric-blue hover:border-light-blue disabled:opacity-60"
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0"
          aria-hidden
        >
          <path d="M10 3v10m0 0-3.5-3.5M10 13l3.5-3.5" />
          <path d="M4 15.5v.5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-.5" />
        </svg>
        {loading ? "Exporting…" : label}
      </button>
      {error ? <p className="text-xs font-semibold text-danger">{error}</p> : null}
    </div>
  );
}
