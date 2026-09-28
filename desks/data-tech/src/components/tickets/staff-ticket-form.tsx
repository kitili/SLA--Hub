"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABELS, TICKET_IMPACT_LABELS, TICKET_IMPACTS } from "@/lib/ticket-constants";

export function StaffTicketForm({
  departments,
  defaultName,
}: {
  departments: { id: string; name: string }[];
  defaultName?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        issue: form.get("issue"),
        submitterName: form.get("submitterName") || defaultName,
        priority: form.get("priority"),
        category: form.get("category"),
        impact: form.get("impact"),
        campus: form.get("campus") || undefined,
        placeOfWork: form.get("placeOfWork") || undefined,
        departmentId: form.get("departmentId") || undefined,
        dueAt: form.get("dueAt") || undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create the ticket.");
      return;
    }
    const data = await res.json();
    router.push(`/dashboard/tickets/${data.ticket.id}`);
  }

  return (
    <Card className="max-w-xl">
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="issue">What needs doing?</Label>
          <Textarea id="issue" name="issue" rows={4} required minLength={5} maxLength={5000} />
        </div>
        <div>
          <Label htmlFor="submitterName">On behalf of</Label>
          <Input id="submitterName" name="submitterName" defaultValue={defaultName} placeholder="Your name or the requester" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="priority">Priority</Label>
            <Select id="priority" name="priority" defaultValue="medium">
              <option value="low">Low</option>
              <option value="medium">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Select id="category" name="category" defaultValue="other">
              {TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {TICKET_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="impact">Impact</Label>
            <Select id="impact" name="impact" defaultValue="individual">
              {TICKET_IMPACTS.map((i) => (
                <option key={i} value={i}>
                  {TICKET_IMPACT_LABELS[i]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="campus">Campus / site</Label>
            <Input id="campus" name="campus" placeholder="e.g. Usa River" />
          </div>
        </div>
        <div>
          <Label htmlFor="placeOfWork">Place of work / room</Label>
          <Input id="placeOfWork" name="placeOfWork" placeholder="Office, classroom, lab…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="dueAt">Due date</Label>
            <Input id="dueAt" name="dueAt" type="date" />
            <p className="mt-1 text-xs text-black/45">Leave blank to use the SLA for that priority.</p>
          </div>
          {departments.length > 0 && (
            <div>
              <Label htmlFor="departmentId">Department</Label>
              <Select id="departmentId" name="departmentId" defaultValue="">
                <option value="">None</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create ticket"}
        </Button>
      </form>
    </Card>
  );
}
