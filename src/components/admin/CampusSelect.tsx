"use client";

import { useEffect, useState, useTransition } from "react";
import { setMemberCampusAction } from "@/lib/actions/admin";
import styles from "./admin.module.css";

interface Props {
  memberId: string;
  currentCampus: string | null;
  campuses: { id: string; name: string }[];
}

export default function CampusSelect({ memberId, currentCampus, campuses }: Props) {
  const [selected, setSelected] = useState<string>(currentCampus ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Auto-hide the "Saved" flash after 2 s.
  useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(id);
  }, [saved]);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setSelected(value);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await setMemberCampusAction(memberId, value || null);
      if (result.ok) {
        setSaved(true);
      } else {
        setError(result.error.message);
      }
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
      <select
        className={styles.select}
        style={{ width: "auto", minWidth: "200px" }}
        value={selected}
        onChange={handleChange}
        disabled={isPending}
        aria-label="Campus"
      >
        <option value="">— No campus —</option>
        {campuses.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>

      {isPending && (
        <span className={styles.muted}>Saving…</span>
      )}
      {saved && !isPending && (
        <span className={styles.formSuccess} style={{ padding: "0.25rem 0.6rem" }}>
          Saved
        </span>
      )}
      {error && !isPending && (
        <span className={styles.formError} style={{ padding: "0.25rem 0.6rem" }}>
          {error}
        </span>
      )}
    </div>
  );
}
