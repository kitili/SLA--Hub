"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DASHBOARD_SHEET_META,
  type DashboardSheetId,
} from "@/lib/export/dashboard-sheet-meta";

type Props = {
  from: string;
  to: string;
};

type Format = "xlsx" | "csvzip";

const DEFAULT_INCLUDED = DASHBOARD_SHEET_META.map((s) => s.id);

export function DashboardExportButton({ from, to }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>("xlsx");
  const [included, setIncluded] = useState<DashboardSheetId[]>([
    ...DEFAULT_INCLUDED,
  ]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selectedCount = included.length;
  const periodLabel = useMemo(() => `${from} → ${to}`, [from, to]);

  function toggle(id: DashboardSheetId) {
    setIncluded((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setDone(null);
  }

  async function download() {
    if (selectedCount === 0) {
      setError("Pick at least one sheet");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const qs = new URLSearchParams({
        from,
        to,
        format,
        include: included.join(","),
      });
      const res = await fetch(`/api/admin/dashboard-export?${qs.toString()}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(cd);
      const fallback =
        format === "csvzip"
          ? `silverleaf-dashboard-${from}_to_${to}-csvs.zip`
          : `silverleaf-dashboard-${from}_to_${to}.xlsx`;
      const filename = match?.[1] ?? fallback;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDone(
        format === "xlsx"
          ? "Excel workbook downloaded — open in Sheets or Excel"
          : "CSV pack downloaded — unzip and import each file",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        disabled={!from || !to}
        onClick={() => {
          setOpen((v) => !v);
          setDone(null);
          setError(null);
        }}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-navy-light to-electric-blue px-4 text-sm font-bold text-white shadow-[0_8px_18px_rgba(0,35,104,0.18)] transition hover:brightness-105 disabled:opacity-60"
      >
        Export sheets
        <span aria-hidden className="text-[10px] opacity-80">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open ? (
        <div className="ui-panel absolute right-0 z-30 mt-2 w-[min(100vw-2rem,22rem)] p-4 shadow-[var(--shadow-lg)]">
          <p className="text-sm font-bold text-ink">Export dashboard data</p>
          <p className="mt-1 text-xs text-ink-muted">
            Period <span className="font-semibold text-ink">{periodLabel}</span>
          </p>

          <fieldset className="mt-3">
            <legend className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">
              Format
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label
                className={`cursor-pointer rounded-[var(--radius-sm)] border px-3 py-2 text-xs font-semibold transition ${
                  format === "xlsx"
                    ? "border-electric-blue bg-light-blue-30 text-electric-blue"
                    : "border-card-border bg-white/80 text-ink-muted"
                }`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  checked={format === "xlsx"}
                  onChange={() => setFormat("xlsx")}
                />
                Excel (.xlsx)
                <span className="mt-0.5 block font-normal text-[10px] opacity-80">
                  Best for Sheets
                </span>
              </label>
              <label
                className={`cursor-pointer rounded-[var(--radius-sm)] border px-3 py-2 text-xs font-semibold transition ${
                  format === "csvzip"
                    ? "border-electric-blue bg-light-blue-30 text-electric-blue"
                    : "border-card-border bg-white/80 text-ink-muted"
                }`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  checked={format === "csvzip"}
                  onChange={() => setFormat("csvzip")}
                />
                CSV pack (.zip)
                <span className="mt-0.5 block font-normal text-[10px] opacity-80">
                  One CSV per tab
                </span>
              </label>
            </div>
          </fieldset>

          <fieldset className="mt-4">
            <div className="flex items-center justify-between gap-2">
              <legend className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                Sheets ({selectedCount})
              </legend>
              <button
                type="button"
                className="text-[11px] font-bold text-electric-blue"
                onClick={() =>
                  setIncluded(
                    included.length === DEFAULT_INCLUDED.length
                      ? ["readme", "summary"]
                      : [...DEFAULT_INCLUDED],
                  )
                }
              >
                {included.length === DEFAULT_INCLUDED.length
                  ? "Minimum"
                  : "Select all"}
              </button>
            </div>
            <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {DASHBOARD_SHEET_META.map((sheet) => {
                const checked = included.includes(sheet.id);
                return (
                  <li key={sheet.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-[var(--radius-sm)] px-1.5 py-1 hover:bg-light-blue-30/60">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(sheet.id)}
                        className="mt-0.5 accent-[var(--electric-blue)]"
                      />
                      <span>
                        <span className="block text-xs font-bold text-ink">
                          {sheet.name}
                        </span>
                        <span className="block text-[10px] text-ink-faint">
                          {sheet.description}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <button
            type="button"
            disabled={busy || selectedCount === 0}
            onClick={() => void download()}
            className="mt-4 flex w-full min-h-11 items-center justify-center rounded-full bg-electric-blue text-sm font-bold text-white transition hover:bg-navy-light disabled:opacity-60"
          >
            {busy
              ? "Building workbook…"
              : format === "xlsx"
                ? "Download Excel workbook"
                : "Download CSV pack"}
          </button>

          {done ? (
            <p className="mt-2 text-xs font-semibold text-success" role="status">
              {done}
            </p>
          ) : null}
          {error ? (
            <p className="mt-2 text-xs font-semibold text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
