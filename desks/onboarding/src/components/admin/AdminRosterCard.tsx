"use client";

import { useState, useTransition } from "react";
import { setMemberAdminAction } from "@/lib/actions/admin";
import { Link } from "@/i18n/navigation";
import styles from "./admin.module.css";

export interface AdminRosterMember {
  id: string;
  fullName: string;
  email: string;
  campus: string | null;
  isAdmin: boolean;
}

export default function AdminRosterCard({
  initialMembers,
}: {
  initialMembers: AdminRosterMember[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  function toggle(memberId: string, currentIsAdmin: boolean) {
    const next = !currentIsAdmin;
    setPending((p) => ({ ...p, [memberId]: true }));
    setErrors((e) => { const n = { ...e }; delete n[memberId]; return n; });
    startTransition(async () => {
      const result = await setMemberAdminAction(memberId, next);
      setPending((p) => { const n = { ...p }; delete n[memberId]; return n; });
      if (result.ok) {
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, isAdmin: next } : m)),
        );
      } else {
        setErrors((e) => ({ ...e, [memberId]: result.error.message }));
      }
    });
  }

  const admins = members.filter((m) => m.isAdmin);
  const nonAdmins = members.filter((m) => !m.isAdmin);

  const filtered = (list: AdminRosterMember[]) =>
    search.trim()
      ? list.filter(
          (m) =>
            (m.fullName ?? "").toLowerCase().includes(search.toLowerCase()) ||
            m.email.toLowerCase().includes(search.toLowerCase()),
        )
      : list;

  function row(m: AdminRosterMember) {
    const isPending = !!pending[m.id];
    const err = errors[m.id];
    return (
      <tr key={m.id}>
        <td className={styles.nameCell}>
          <Link href={`/admin/members/${m.id}`} className={styles.memberLink}>
            {m.fullName || "—"}
          </Link>
        </td>
        <td className={styles.muted} style={{ fontSize: "0.85rem" }}>{m.email}</td>
        <td className={styles.muted} style={{ fontSize: "0.85rem" }}>{m.campus ?? "—"}</td>
        <td>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <button
              type="button"
              disabled={isPending}
              onClick={() => toggle(m.id, m.isAdmin)}
              className={m.isAdmin ? styles.btnDanger : styles.btnSuccess}
              style={{ fontSize: "0.8rem", padding: "4px 10px" }}
            >
              {isPending
                ? m.isAdmin ? "Revoking…" : "Granting…"
                : m.isAdmin ? "Revoke admin" : "Grant admin"}
            </button>
            {err ? (
              <span style={{ color: "#dc2626", fontSize: "0.78rem" }}>{err}</span>
            ) : null}
          </div>
        </td>
      </tr>
    );
  }

  const filteredAdmins = filtered(admins);
  const filteredNonAdmins = filtered(nonAdmins);

  return (
    <div className={styles.card}>
      <h2 style={{ marginTop: 0 }}>Admin access</h2>
      <p className={styles.muted} style={{ marginBottom: "1rem" }}>
        Grant or revoke admin access for any staff member. Admins can manage
        sections, materials, members, and settings.
      </p>

      <input
        type="search"
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={styles.input}
        style={{ maxWidth: "320px", marginBottom: "1.25rem" }}
      />

      {filteredAdmins.length > 0 && (
        <>
          <h3 style={{ fontSize: "0.875rem", color: "#065f46", marginBottom: "0.4rem" }}>
            Current admins ({filteredAdmins.length})
          </h3>
          <div className={styles.tableWrap} style={{ marginBottom: "1.5rem" }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Campus</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>{filteredAdmins.map(row)}</tbody>
            </table>
          </div>
        </>
      )}

      {filteredNonAdmins.length > 0 && (
        <>
          <h3 style={{ fontSize: "0.875rem", color: "#4a5568", marginBottom: "0.4rem" }}>
            Other members ({filteredNonAdmins.length})
          </h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Campus</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>{filteredNonAdmins.map(row)}</tbody>
            </table>
          </div>
        </>
      )}

      {filteredAdmins.length === 0 && filteredNonAdmins.length === 0 && (
        <p className={styles.muted}>No members match your search.</p>
      )}
    </div>
  );
}
