"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Contact = {
  id: string;
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
};

export function SupportContactsManager({ contacts, canManage = true }: { contacts: Contact[]; canManage?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/support-contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        title: formData.get("title") || undefined,
        phone: formData.get("phone") || undefined,
        email: formData.get("email") || undefined,
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

  async function toggleActive(contact: Contact) {
    setError(null);
    const res = await fetch(`/api/support-contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !contact.isActive }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  async function handleDelete(contact: Contact) {
    if (!confirm(`Delete ${contact.name}?`)) return;
    setError(null);
    const res = await fetch(`/api/support-contacts/${contact.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  async function handleUpdate(contact: Contact, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const res = await fetch(`/api/support-contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        title: formData.get("title") || null,
        phone: formData.get("phone") || null,
        email: formData.get("email") || null,
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
      <h1 className="mb-6 text-xl font-medium text-navy">Technical support contacts</h1>
      {canManage && (
        <Card className="mb-6 max-w-lg">
          {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <Button type="submit" disabled={submitting}>
              Add contact
            </Button>
          </form>
        </Card>
      )}

      <Card className="max-w-lg p-0">
        <ul>
          {contacts.map((c) =>
            editingId === c.id && canManage ? (
              <li key={c.id} className="border-b border-black/5 p-4 last:border-0">
                <form onSubmit={(e) => handleUpdate(c, e)} className="flex flex-col gap-2">
                  <Input name="name" defaultValue={c.name} required placeholder="Name" />
                  <Input name="title" defaultValue={c.title ?? ""} placeholder="Title" />
                  <Input name="phone" defaultValue={c.phone ?? ""} placeholder="Phone" />
                  <Input name="email" type="email" defaultValue={c.email ?? ""} placeholder="Email" />
                  <div className="flex gap-2">
                    <Button type="submit">Save</Button>
                    <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </li>
            ) : (
              <li key={c.id} className="flex items-center justify-between gap-3 border-b border-black/5 px-4 py-3 text-sm last:border-0">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    {c.name}
                    {!c.isActive && <Badge tone="neutral">inactive</Badge>}
                  </div>
                  <div className="text-black/60">{[c.title, c.phone, c.email].filter(Boolean).join(" · ")}</div>
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditingId(c.id)}>
                      Edit
                    </Button>
                    <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => toggleActive(c)}>
                      {c.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => handleDelete(c)}>
                      Delete
                    </Button>
                  </div>
                )}
              </li>
            ),
          )}
          {contacts.length === 0 && <li className="px-4 py-6 text-center text-sm text-black/50">No contacts yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
