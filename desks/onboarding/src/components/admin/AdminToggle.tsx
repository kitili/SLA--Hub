"use client";

import { useState, useTransition } from "react";
import { setMemberAdminAction } from "@/lib/actions/admin";
import styles from "./admin.module.css";

interface Props {
  memberId: string;
  initialIsAdmin: boolean;
}

export default function AdminToggle({ memberId, initialIsAdmin }: Props) {
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !isAdmin;
    setError(null);
    startTransition(async () => {
      const result = await setMemberAdminAction(memberId, next);
      if (result.ok) {
        setIsAdmin(next);
      } else {
        setError(result.error.message);
      }
    });
  }

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <h2 style={{ marginBottom: "0.5rem" }}>Admin Access</h2>
      <p style={{ marginBottom: "0.75rem", color: "#6c757d", fontSize: "0.9rem" }}>
        {isAdmin
          ? "This member currently has admin access and can manage sections, materials, and members."
          : "This member does not have admin access."}
      </p>
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        className={isAdmin ? styles.btnDanger : styles.btnSuccess}
      >
        {isPending
          ? isAdmin ? "Revoking…" : "Granting…"
          : isAdmin ? "Revoke Admin Access" : "Grant Admin Access"}
      </button>
      {error && (
        <p role="alert" style={{ color: "#dc3545", marginTop: "0.5rem", fontSize: "0.875rem" }}>
          {error}
        </p>
      )}
    </div>
  );
}
