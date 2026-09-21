"use client";

import { useActionState, useTransition } from "react";
import { createCampusAction, deleteCampusAction } from "@/lib/actions/admin";
import type { ActionResult } from "@/lib/actions/admin";
import styles from "./admin.module.css";

interface CampusRow {
  id: string;
  name: string;
}

interface Props {
  campuses: CampusRow[];
}

export default function CampusesPanel({ campuses }: Props) {
  const [state, formAction, isPending] = useActionState<
    ActionResult<{ id: string }> | undefined,
    FormData
  >(createCampusAction, undefined);

  const [isDeleting, startDelete] = useTransition();

  function handleDelete(id: string) {
    if (!confirm("Delete this campus? This cannot be undone.")) return;
    startDelete(async () => {
      await deleteCampusAction(id);
    });
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2>Campuses</h2>
      </div>

      {campuses.length === 0 ? (
        <p className={styles.muted} style={{ marginBottom: "1rem" }}>
          No campuses yet.
        </p>
      ) : (
        <div className={styles.tableWrap} style={{ marginBottom: "1.5rem" }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campuses.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                      onClick={() => handleDelete(c.id)}
                      disabled={isDeleting}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ marginBottom: "0.75rem", fontSize: "0.95rem", color: "var(--electric-blue)" }}>
        Add campus
      </h3>

      <form action={formAction} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="campus-name">
            Campus name
          </label>
          <input
            id="campus-name"
            name="name"
            type="text"
            className={styles.input}
            placeholder="e.g. Usa River"
            maxLength={150}
            required
            autoComplete="off"
          />
        </div>

        {state && !state.ok && (
          <p role="alert" className={styles.formError}>
            {state.error.message}
          </p>
        )}

        {state?.ok && (
          <p className={styles.formSuccess}>Campus added.</p>
        )}

        <div className={styles.formActions}>
          <button
            type="submit"
            className={styles.btn}
            disabled={isPending}
          >
            {isPending ? "Adding…" : "Add campus"}
          </button>
        </div>
      </form>
    </div>
  );
}
