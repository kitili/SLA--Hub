"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MODULE_KEYS, MODULE_LABELS, DATA_TECH_DEPARTMENT, DATA_TECH_STAFF_MODULES, type ModuleKey, type AccessLevel } from "@/lib/modules";

type ModuleMap = Partial<Record<ModuleKey, AccessLevel>>;

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "hod" | "tech";
  departmentId: string | null;
  isActive: boolean;
  modules?: ModuleMap;
};

function ModuleGrid({
  modules,
  onChange,
}: {
  modules: ModuleMap;
  onChange: (module: ModuleKey, level: AccessLevel | "") => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {MODULE_KEYS.map((module) => (
        <div key={module} className="flex items-center justify-between gap-2 rounded-md bg-gray-light/60 px-3 py-2">
          <span className="text-sm text-black/70">{MODULE_LABELS[module]}</span>
          <Select
            value={modules[module] ?? ""}
            onChange={(e) => onChange(module, e.target.value as AccessLevel | "")}
            className="w-28"
          >
            <option value="">None</option>
            <option value="view">View</option>
            <option value="manage">Manage</option>
          </Select>
        </div>
      ))}
    </div>
  );
}

export function UsersManager({
  users,
  departments,
  canManage = true,
}: {
  users: UserRow[];
  departments: { id: string; name: string }[];
  canManage?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [newModules, setNewModules] = useState<ModuleMap>({});
  const [createdPassword, setCreatedPassword] = useState<{ email: string; password: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editModules, setEditModules] = useState<ModuleMap>({});

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        isAdmin: newIsAdmin,
        modules: newIsAdmin ? undefined : newModules,
        departmentId: formData.get("departmentId") || undefined,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    const data = await res.json();
    setCreatedPassword({ email: data.user.email, password: data.temporaryPassword });
    e.currentTarget.reset();
    setNewIsAdmin(false);
    setNewModules({});
    router.refresh();
  }

  async function updateUser(id: string, body: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  function startEditAccess(u: UserRow) {
    setEditingId(u.id);
    setEditIsAdmin(u.role === "admin");
    setEditModules(u.modules ?? {});
  }

  async function saveAccess(u: UserRow) {
    // Send null for every module not in the new set so it's explicitly cleared server-side.
    const modules = Object.fromEntries(
      MODULE_KEYS.map((m) => [m, editModules[m] ?? null]),
    );
    await updateUser(u.id, { isAdmin: editIsAdmin, modules: editIsAdmin ? undefined : modules });
    setEditingId(null);
  }

  async function resetPassword(id: string) {
    const newPassword = window.prompt("New temporary password (min 10 characters):");
    if (!newPassword) return;
    setError(null);
    const res = await fetch(`/api/users/${id}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-medium text-navy">Users</h1>
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {canManage && (
      <Card className="mb-6 max-w-2xl">
        <h2 className="mb-3 text-sm font-medium text-black/60">Add user</h2>
        {createdPassword && (
          <div className="mb-3 rounded-md bg-gold-accent/40 px-3 py-2 text-sm text-black">
            <p className="mb-1">
              A welcome email with a temporary password was sent to <strong>{createdPassword.email}</strong>. If it
              doesn&apos;t arrive, share this temporary password directly — it won&apos;t be shown again:
            </p>
            <div className="flex items-center justify-between gap-2">
              <code className="rounded bg-white px-2 py-1 font-mono">{createdPassword.password}</code>
              <Button
                type="button"
                variant="ghost"
                className="px-2 py-1 text-xs"
                onClick={() => setCreatedPassword(null)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="departmentId">Department</Label>
              <Select
                id="departmentId"
                name="departmentId"
                defaultValue=""
                onChange={(e) => {
                  const dept = departments.find((d) => d.id === e.target.value);
                  if (dept?.name === DATA_TECH_DEPARTMENT) {
                    setNewModules((prev) => ({ ...DATA_TECH_STAFF_MODULES, ...prev }));
                  }
                }}
              >
                <option value="">None</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-black/80">
            <input type="checkbox" checked={newIsAdmin} onChange={(e) => setNewIsAdmin(e.target.checked)} />
            Admin (full access to everything)
          </label>

          {!newIsAdmin && (
            <div>
              <Label>Module access</Label>
              <p className="mb-2 text-xs text-black/50">
                Data &amp; Tech staff always get Projects, Tickets, Tech tools, and 1–5s.
              </p>
              <ModuleGrid
                modules={newModules}
                onChange={(module, level) =>
                  setNewModules((prev) => {
                    const next = { ...prev };
                    if (level === "") delete next[module];
                    else next[module] = level;
                    return next;
                  })
                }
              />
            </div>
          )}

          <div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create user"}
            </Button>
          </div>
        </form>
      </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-black/10 text-left text-black/60">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Access</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <Fragment key={u.id}>
                <tr className="border-b border-black/5 last:border-0">
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3 text-black/70">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.role === "admin" ? (
                      <Badge tone="info">Admin</Badge>
                    ) : (
                      <span className="text-black/60">
                        {Object.keys(u.modules ?? {}).length} module{Object.keys(u.modules ?? {}).length === 1 ? "" : "s"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={u.isActive}
                          onChange={(e) => updateUser(u.id, { isActive: e.target.checked })}
                        />
                        {u.isActive ? "Active" : "Disabled"}
                      </label>
                    ) : (
                      <span className="text-black/60">{u.isActive ? "Active" : "Disabled"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canManage && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          className="px-2 py-1 text-xs"
                          onClick={() => (editingId === u.id ? setEditingId(null) : startEditAccess(u))}
                        >
                          {editingId === u.id ? "Cancel" : "Manage access"}
                        </Button>
                        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => resetPassword(u.id)}>
                          Reset password
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
                {editingId === u.id && (
                  <tr className="border-b border-black/5 bg-gray-light/40 last:border-0">
                    <td colSpan={5} className="px-4 py-4">
                      <label className="mb-3 flex items-center gap-2 text-sm text-black/80">
                        <input
                          type="checkbox"
                          checked={editIsAdmin}
                          onChange={(e) => setEditIsAdmin(e.target.checked)}
                        />
                        Admin (full access to everything)
                      </label>
                      {!editIsAdmin && (
                        <ModuleGrid
                          modules={editModules}
                          onChange={(module, level) =>
                            setEditModules((prev) => {
                              const next = { ...prev };
                              if (level === "") delete next[module];
                              else next[module] = level;
                              return next;
                            })
                          }
                        />
                      )}
                      <Button className="mt-3 px-3 py-1.5 text-xs" onClick={() => saveAccess(u)}>
                        Save access
                      </Button>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
