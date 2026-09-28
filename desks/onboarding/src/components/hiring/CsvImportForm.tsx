"use client";

import { useRouter } from "@/i18n/navigation";
import { FormEvent, useState } from "react";

import { Link } from "@/i18n/navigation";
import styles from "@/components/admin/admin.module.css";

export function CsvImportForm() {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setErrors([]);

    const res = await fetch("/api/hiring/candidates/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setMessage(json.error || "Import failed");
      return;
    }

    setMessage(
      `Imported ${json.imported} candidate(s). Skipped ${json.skipped}.`,
    );
    if (Array.isArray(json.errors) && json.errors.length > 0) {
      setErrors(json.errors);
    }
    if (json.imported > 0) {
      router.refresh();
    }
  }

  function onFileChange(file: File | null) {
    if (!file) return;
    file.text().then(setCsv);
  }

  return (
    <div>
      <p className={styles.muted}>
        CSV from the Google Form / linked Sheet works as-is (question titles as
        headers). Required: name + email. Missing LinkedIn/CV still import as
        Incomplete. Existing emails are skipped.
      </p>
      <form onSubmit={onSubmit} className={styles.form}>
        <label className={styles.field}>
          <span className={styles.label}>Upload CSV file</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Or paste CSV</span>
          <textarea
            rows={12}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            className={styles.input}
            placeholder={`Timestamp,Full Name,Preferred Email Address,Which position would you like to be considered for?\n2/09/2026,Jane Doe,jane@example.com,Finance Manager`}
          />
        </label>
        <button type="submit" disabled={busy || !csv.trim()} className={styles.submit}>
          {busy ? "Importing…" : "Import candidates"}
        </button>
      </form>
      {message ? <p className={styles.success}>{message}</p> : null}
      {errors.length > 0 ? (
        <ul className={styles.errorList}>
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}
      <p>
        <Link href="/admin/hiring" className={styles.link}>
          Back to board
        </Link>
      </p>
    </div>
  );
}
