"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Recipient = { id: string; email: string; name: string | null; isActive: boolean };

export function TicketNotifyRecipientsManager({
  recipients,
  canManage = true,
}: {
  recipients: Recipient[];
  canManage?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/ticket-notify-recipients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        name: formData.get("name") || undefined,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    e.currentTarget.reset();
    router.refresh();
  }

  async function toggleActive(recipient: Recipient) {
    setError(null);
    const res = await fetch(`/api/ticket-notify-recipients/${recipient.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !recipient.isActive }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  async function handleDelete(recipient: Recipient) {
    if (!confirm(`Remove ${recipient.email} from new-ticket notifications?`)) return;
    setError(null);
    const res = await fetch(`/api/ticket-notify-recipients/${recipient.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  async function handleUpdate(recipient: Recipient, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const res = await fetch(`/api/ticket-notify-recipients/${recipient.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        name: formData.get("name") || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  return (
    <div>
      <h1 className="mb-2 text-xl font-medium text-navy">New ticket notifications</h1>
      <p className="mb-6 max-w-lg text-sm text-black/60">
        Everyone on this list gets emailed whenever a new ticket is submitted. If the list is empty, active
        admins and anyone with Tickets manage access are notified by default instead.
      </p>

      {canManage && (
        <Card className="mb-6 max-w-lg">
          {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="flex-1">
              <Label htmlFor="name">Name (optional)</Label>
              <Input id="name" name="name" />
            </div>
            <Button type="submit" disabled={submitting}>
              Add
            </Button>
          </form>
        </Card>
      )}

      <Card className="max-w-lg p-0">
        <ul>
          {recipients.map((r) =>
            editingId === r.id && canManage ? (
              <li key={r.id} className="border-b border-black/5 p-3 last:border-0">
                <form onSubmit={(e) => handleUpdate(r, e)} className="flex flex-col gap-2">
                  <Input name="email" type="email" defaultValue={r.email} required placeholder="Email" />
                  <Input name="name" defaultValue={r.name ?? ""} placeholder="Name" />
                  <div className="flex gap-2">
                    <Button type="submit" className="px-2 py-1 text-xs">
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </li>
            ) : (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 border-b border-black/5 px-4 py-3 text-sm last:border-0"
              >
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    {r.email}
                    {!r.isActive && <Badge tone="neutral">inactive</Badge>}
                  </div>
                  {r.name && <div className="text-black/60">{r.name}</div>}
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditingId(r.id)}>
                      Edit
                    </Button>
                    <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => toggleActive(r)}>
                      {r.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => handleDelete(r)}>
                      Delete
                    </Button>
                  </div>
                )}
              </li>
            ),
          )}
          {recipients.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-black/50">
              Nobody added yet — admins and HODs are notified by default.
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}
