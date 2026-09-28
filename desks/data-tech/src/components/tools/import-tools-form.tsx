"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ImportResult = { created: number; errors: { row: number; message: string }[] };

export function ImportToolsForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setSubmitting(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.set("file", file);

    const res = await fetch("/api/tools/import", { method: "POST", body: formData });
    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    const data: ImportResult = await res.json();
    setResult(data);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (data.created > 0) router.refresh();
  }

  return (
    <Card className="max-w-xl">
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {result && (
        <div className="mb-4 rounded-md bg-gray-light/60 p-3 text-sm">
          <p className="font-medium text-navy">{result.created} device(s) imported.</p>
          {result.errors.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-red-700">
              {result.errors.map((e, i) => (
                <li key={i}>{e.row > 0 ? `Row ${e.row}: ` : ""}{e.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          required
          className="block w-full text-sm"
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? "Importing…" : "Import spreadsheet"}
        </Button>
      </form>
    </Card>
  );
}
