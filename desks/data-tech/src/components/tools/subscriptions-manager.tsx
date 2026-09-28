"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Department = { id: string; name: string };

type Subscription = {
  id: string;
  name: string;
  description: string | null;
  url: string | null;
  renewalDate: string;
  isActive: boolean;
  departments: Department[];
  notifyEmails: string[];
};

function daysUntil(dateStr: string) {
  const target = new Date(`${dateStr}T00:00:00Z`);
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((target.getTime() - todayUtc) / 86_400_000);
}

function renewalTone(days: number): "danger" | "warning" | "neutral" {
  if (days <= 2) return "danger";
  if (days <= 7) return "warning";
  return "neutral";
}

function parseEmails(value: string) {
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function DepartmentPicker({
  departments,
  selected,
  onToggle,
}: {
  departments: Department[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {departments.map((d) => (
        <label key={d.id} className="flex items-center gap-1.5 rounded-md bg-gray-light/60 px-2.5 py-1.5 text-sm">
          <input type="checkbox" checked={selected.includes(d.id)} onChange={() => onToggle(d.id)} />
          {d.name}
        </label>
      ))}
      {departments.length === 0 && <span className="text-sm text-black/50">No departments yet.</span>}
    </div>
  );
}

export function SubscriptionsManager({
  subscriptions,
  departments,
  canManage = true,
}: {
  subscriptions: Subscription[];
  departments: Department[];
  canManage?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newDepartmentIds, setNewDepartmentIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDepartmentIds, setEditDepartmentIds] = useState<string[]>([]);

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((d) => d !== id) : [...list, id]);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        description: formData.get("description") || undefined,
        url: formData.get("url") || undefined,
        renewalDate: formData.get("renewalDate"),
        departmentIds: newDepartmentIds,
        notifyEmails: parseEmails(String(formData.get("notifyEmails") ?? "")),
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    e.currentTarget.reset();
    setNewDepartmentIds([]);
    setShowAdd(false);
    router.refresh();
  }

  async function updateSubscription(id: string, body: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/subscriptions/${id}`, {
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

  async function handleDelete(sub: Subscription) {
    if (!confirm(`Delete "${sub.name}"? This also clears its reminder history.`)) return;
    const res = await fetch(`/api/subscriptions/${sub.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  function startEdit(sub: Subscription) {
    setEditingId(sub.id);
    setEditDepartmentIds(sub.departments.map((d) => d.id));
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium text-navy">Subscriptions</h1>
          <p className="mt-1 text-sm text-black/60">Third-party systems and platforms Silverleaf pays for periodically.</p>
        </div>
        {canManage && (
          <Button variant={showAdd ? "ghost" : "primary"} onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? "Cancel" : "Add subscription"}
          </Button>
        )}
      </div>

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {canManage && showAdd && (
        <Card className="mb-6 max-w-xl">
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="e.g. Google Workspace" />
            </div>
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <div>
              <Label htmlFor="url">Link (optional)</Label>
              <Input id="url" name="url" type="url" placeholder="https://..." />
            </div>
            <div>
              <Label htmlFor="renewalDate">Renewal date</Label>
              <Input id="renewalDate" name="renewalDate" type="date" required />
            </div>
            <div>
              <Label>Departments using this</Label>
              <DepartmentPicker
                departments={departments}
                selected={newDepartmentIds}
                onToggle={(id) => toggle(newDepartmentIds, setNewDepartmentIds, id)}
              />
            </div>
            <div>
              <Label htmlFor="notifyEmails">Notify emails (optional)</Label>
              <Textarea id="notifyEmails" name="notifyEmails" rows={2} placeholder="it@silverleaf.co.tz, finance@silverleaf.co.tz" />
              <p className="mt-1 text-xs text-black/50">
                Comma or newline-separated. Leave blank to notify Tech Tools managers and admins by default.
              </p>
            </div>
            <div>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Add subscription"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {subscriptions.map((sub) => {
          const days = daysUntil(sub.renewalDate);
          const isEditing = editingId === sub.id;
          return (
            <Card key={sub.id} className={!sub.isActive ? "opacity-60" : undefined}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-medium text-navy">
                      {sub.url ? (
                        <a href={sub.url} target="_blank" rel="noreferrer" className="hover:underline">
                          {sub.name}
                        </a>
                      ) : (
                        sub.name
                      )}
                    </h2>
                    {!sub.isActive && <Badge tone="neutral">inactive</Badge>}
                    {sub.isActive && (
                      <Badge tone={renewalTone(days)}>
                        {days < 0 ? `Overdue ${Math.abs(days)}d` : days === 0 ? "Renews today" : `Renews in ${days}d`}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-black/50">
                    Renewal: {new Date(`${sub.renewalDate}T00:00:00Z`).toLocaleDateString()}
                    {sub.departments.length > 0 && <> · {sub.departments.map((d) => d.name).join(", ")}</>}
                  </div>
                  {sub.description && <p className="mt-2 text-sm text-black/70">{sub.description}</p>}
                  <div className="mt-2 text-xs text-black/50">
                    Notifies: {sub.notifyEmails.length > 0 ? sub.notifyEmails.join(", ") : "Tech Tools managers & admins (default)"}
                  </div>
                </div>
                {canManage && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() => (isEditing ? setEditingId(null) : startEdit(sub))}
                    >
                      {isEditing ? "Cancel" : "Edit"}
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() => updateSubscription(sub.id, { isActive: !sub.isActive })}
                    >
                      {sub.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => handleDelete(sub)}>
                      Delete
                    </Button>
                  </div>
                )}
              </div>

              {isEditing && (
                <form
                  className="mt-4 flex flex-col gap-3 border-t border-black/10 pt-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    await updateSubscription(sub.id, {
                      name: formData.get("name"),
                      description: formData.get("description") || null,
                      url: formData.get("url") || null,
                      renewalDate: formData.get("renewalDate"),
                      departmentIds: editDepartmentIds,
                      notifyEmails: parseEmails(String(formData.get("notifyEmails") ?? "")),
                    });
                    setEditingId(null);
                  }}
                >
                  <div>
                    <Label htmlFor={`name-${sub.id}`}>Name</Label>
                    <Input id={`name-${sub.id}`} name="name" defaultValue={sub.name} required />
                  </div>
                  <div>
                    <Label htmlFor={`description-${sub.id}`}>Description</Label>
                    <Textarea id={`description-${sub.id}`} name="description" rows={2} defaultValue={sub.description ?? ""} />
                  </div>
                  <div>
                    <Label htmlFor={`url-${sub.id}`}>Link</Label>
                    <Input id={`url-${sub.id}`} name="url" type="url" defaultValue={sub.url ?? ""} />
                  </div>
                  <div>
                    <Label htmlFor={`renewalDate-${sub.id}`}>Renewal date</Label>
                    <Input id={`renewalDate-${sub.id}`} name="renewalDate" type="date" defaultValue={sub.renewalDate} required />
                  </div>
                  <div>
                    <Label>Departments using this</Label>
                    <DepartmentPicker
                      departments={departments}
                      selected={editDepartmentIds}
                      onToggle={(id) => toggle(editDepartmentIds, setEditDepartmentIds, id)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`notifyEmails-${sub.id}`}>Notify emails</Label>
                    <Textarea
                      id={`notifyEmails-${sub.id}`}
                      name="notifyEmails"
                      rows={2}
                      defaultValue={sub.notifyEmails.join(", ")}
                      placeholder="Leave blank for Tech Tools managers & admins"
                    />
                  </div>
                  <div>
                    <Button type="submit" className="px-3 py-1.5 text-xs">
                      Save changes
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          );
        })}
        {subscriptions.length === 0 && <p className="text-center text-sm text-black/50">No subscriptions yet.</p>}
      </div>
    </div>
  );
}
