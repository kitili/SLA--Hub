"use client";

import { useActionState } from "react";

import {
  changeMyAdminPasswordAction,
  type ActionResult,
} from "@/lib/actions/admin";
import styles from "./admin.module.css";

export default function AdminPasswordForm() {
  const [state, formAction, isPending] = useActionState<
    ActionResult | undefined,
    FormData
  >(changeMyAdminPasswordAction, undefined);

  return (
    <section className={styles.card} aria-labelledby="admin-password-heading">
      <div className={styles.cardHeader}>
        <h2 id="admin-password-heading">Admin password</h2>
      </div>
      <p className={styles.muted} style={{ marginBottom: "1rem" }}>
        Change the password you use after entering your admin email.
      </p>

      <form action={formAction} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="current-admin-password">
            Current password
          </label>
          <input
            id="current-admin-password"
            name="currentPassword"
            type="password"
            className={styles.input}
            autoComplete="current-password"
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="new-admin-password">
            New password
          </label>
          <input
            id="new-admin-password"
            name="newPassword"
            type="password"
            className={styles.input}
            autoComplete="new-password"
            minLength={3}
            maxLength={128}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="confirm-admin-password">
            Confirm new password
          </label>
          <input
            id="confirm-admin-password"
            name="confirmPassword"
            type="password"
            className={styles.input}
            autoComplete="new-password"
            minLength={3}
            maxLength={128}
            required
          />
        </div>

        {state && !state.ok && (
          <p role="alert" className={styles.formError}>
            {state.error.message}
          </p>
        )}

        {state?.ok && (
          <p className={styles.formSuccess}>Admin password updated.</p>
        )}

        <div className={styles.formActions}>
          <button type="submit" className={styles.btn} disabled={isPending}>
            {isPending ? "Updating…" : "Update password"}
          </button>
        </div>
      </form>
    </section>
  );
}
