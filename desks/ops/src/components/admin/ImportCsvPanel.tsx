"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ImportRowOutcome =
  | { row: number; status: "valid"; action: "create" | "update"; matchedId?: string }
  | { row: number; status: "error"; errors: string[] };

type ImportPreview = {
  headerErrors: string[];
  totalRows: number;
  validCount: number;
  errorCount: number;
  createCount: number;
  updateCount: number;
  warnings: string[];
  rows: ImportRowOutcome[];
};

type ImportCommitResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

export function ImportCsvPanel({
  entity,
  columnsHelpText,
}: {
  entity: string;
  columnsHelpText: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCsvText(null);
    setFileName(null);
    setPreview(null);
    setResult(null);
    setError(null);
  }

  async function onFileChosen(file: File) {
    setError(null);
    setResult(null);
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/import/${entity}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text, dryRun: true }),
      });
      const data = (await res.json()) as { preview?: ImportPreview; error?: string };
      if (!res.ok || !data.preview) {
        setError(data.error ?? `Preview failed (${res.status})`);
        return;
      }
      setPreview(data.preview);
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    if (!csvText) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/import/${entity}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText, dryRun: false }),
      });
      const data = (await res.json()) as { result?: ImportCommitResult; error?: string };
      if (!res.ok || !data.result) {
        setError(data.error ?? `Import failed (${res.status})`);
        return;
      }
      setResult(data.result);
      setPreview(null);
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[var(--radius-sm)] border border-card-border bg-card px-3 py-2 text-sm font-semibold text-electric-blue hover:border-light-blue"
      >
        Import CSV
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10">
      <div className="w-full max-w-3xl rounded-[var(--radius)] border border-card-border bg-card p-6 shadow-[var(--shadow)]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-electric-blue">Import CSV</h2>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              reset();
            }}
            className="text-sm font-semibold text-ink-muted hover:underline"
          >
            Close
          </button>
        </div>
        <p className="mt-2 text-sm text-ink-muted">{columnsHelpText}</p>
        <a
          href={`/api/admin/export/${entity}`}
          className="mt-1 inline-block text-sm font-semibold text-electric-blue hover:underline"
        >
          Download a template (current data as CSV)
        </a>

        <div className="mt-4">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFileChosen(file);
            }}
            className="text-sm"
          />
          {fileName ? <p className="mt-1 text-xs text-ink-faint">{fileName}</p> : null}
        </div>

        {loading ? <p className="mt-4 text-sm text-ink-muted">Working…</p> : null}
        {error ? <p className="mt-4 text-sm font-semibold text-danger">{error}</p> : null}

        {preview && preview.headerErrors.length > 0 ? (
          <div className="mt-4 rounded-[var(--radius-sm)] border border-danger/40 bg-danger-15 px-3 py-2 text-sm text-danger">
            {preview.headerErrors.join("; ")}
          </div>
        ) : null}

        {preview && preview.headerErrors.length === 0 ? (
          <div className="mt-4">
            <p className="text-sm font-semibold text-ink">
              {preview.totalRows} rows · {preview.validCount} valid (
              {preview.createCount} create, {preview.updateCount} update) ·{" "}
              {preview.errorCount} errors
            </p>
            {preview.warnings.map((w) => (
              <p key={w} className="mt-1 text-xs font-semibold text-gold">
                ⚠ {w}
              </p>
            ))}
            <ul className="mt-2 max-h-64 divide-y divide-card-border overflow-y-auto rounded-[var(--radius-sm)] border border-card-border text-sm">
              {preview.rows.map((row) => (
                <li key={row.row} className="px-3 py-2">
                  {row.status === "valid" ? (
                    <span className="text-success">
                      Row {row.row}: {row.action === "create" ? "Create" : "Update existing"}
                    </span>
                  ) : (
                    <span className="text-danger">
                      Row {row.row}: {row.errors.join("; ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => void commit()}
              disabled={loading || preview.validCount === 0}
              className="mt-4 rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
            >
              Import {preview.validCount} valid row(s)
            </button>
          </div>
        ) : null}

        {result ? (
          <div className="mt-4 rounded-[var(--radius-sm)] border border-success/40 bg-success-15 px-3 py-2 text-sm text-success">
            <p className="font-semibold">
              Created {result.created} · Updated {result.updated} · Skipped {result.skipped}
            </p>
            {result.errors.map((e) => (
              <p key={e.row} className="mt-1 text-xs text-danger">
                Row {e.row}: {e.message}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
