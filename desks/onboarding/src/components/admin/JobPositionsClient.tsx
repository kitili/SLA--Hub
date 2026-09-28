"use client";

import { useState } from "react";
import styles from "./admin.module.css";

type Position = {
  id: string;
  title: string;
  status: string;
  createdAt: Date;
};

export function JobPositionsClient({
  initialPositions,
}: {
  initialPositions: Position[];
}) {
  const [positions, setPositions] = useState<Position[]>(initialPositions);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    setAddError("");

    const res = await fetch("/api/admin/hiring/positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const data = await res.json().catch(() => ({}));
    setAdding(false);

    if (!res.ok) {
      setAddError(data.error || "Failed to add position.");
      return;
    }

    setPositions((prev) => [...prev, data.position]);
    setNewTitle("");
  }

  async function handleToggle(id: string, currentStatus: string) {
    setBusy(id);
    const nextStatus = currentStatus === "active" ? "closed" : "active";
    const res = await fetch(`/api/admin/hiring/positions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) {
      setPositions((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: data.position.status } : p)),
      );
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this position? This cannot be undone.")) return;
    setBusy(id);
    await fetch(`/api/admin/hiring/positions/${id}`, { method: "DELETE" });
    setBusy(null);
    setPositions((prev) => prev.filter((p) => p.id !== id));
  }

  const active = positions.filter((p) => p.status === "active");
  const inactive = positions.filter((p) => p.status !== "active");

  return (
    <div>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>Add position</h2>
        </div>
        <form onSubmit={handleAdd} className={styles.inlineForm}>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Head of Section — Lower Primary"
            className={styles.input}
            disabled={adding}
            maxLength={200}
          />
          <button
            type="submit"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={adding || !newTitle.trim()}
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </form>
        {addError && <p className={styles.error}>{addError}</p>}
      </div>

      {active.length > 0 && (
        <div className={styles.card} style={{ marginTop: "1rem" }}>
          <div className={styles.cardHeader}>
            <h2>Active positions</h2>
            <p className={styles.muted} style={{ marginTop: 0, fontSize: "0.85rem" }}>
              Visible to applicants in the form dropdown
            </p>
          </div>
          <ul className={styles.positionList}>
            {active.map((p) => (
              <li key={p.id} className={styles.positionRow}>
                <span className={styles.positionTitle}>{p.title}</span>
                <div className={styles.positionActions}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSmall}`}
                    onClick={() => handleToggle(p.id, p.status)}
                    disabled={busy === p.id}
                  >
                    {busy === p.id ? "…" : "Deactivate"}
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
                    onClick={() => handleDelete(p.id)}
                    disabled={busy === p.id}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {inactive.length > 0 && (
        <div className={styles.card} style={{ marginTop: "1rem" }}>
          <div className={styles.cardHeader}>
            <h2>Inactive positions</h2>
            <p className={styles.muted} style={{ marginTop: 0, fontSize: "0.85rem" }}>
              Hidden from the application form
            </p>
          </div>
          <ul className={styles.positionList}>
            {inactive.map((p) => (
              <li key={p.id} className={`${styles.positionRow} ${styles.positionRowInactive}`}>
                <span className={styles.positionTitle}>{p.title}</span>
                <div className={styles.positionActions}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}
                    onClick={() => handleToggle(p.id, p.status)}
                    disabled={busy === p.id}
                  >
                    {busy === p.id ? "…" : "Activate"}
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
                    onClick={() => handleDelete(p.id)}
                    disabled={busy === p.id}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {positions.length === 0 && (
        <div className={styles.card} style={{ marginTop: "1rem" }}>
          <p className={styles.muted} style={{ padding: "1rem 0" }}>
            No positions yet. Add one above to have it appear in the application form.
          </p>
        </div>
      )}
    </div>
  );
}
