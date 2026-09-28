"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Reminder = { id: string; label: string; date: string; isActive: boolean };

function daysUntil(dateStr: string) {
  const target = new Date(`${dateStr}T00:00:00Z`);
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((target.getTime() - todayUtc) / 86_400_000);
}

function tone(days: number): "danger" | "warning" | "neutral" {
  if (days <= 2) return "danger";
  if (days <= 7) return "warning";
  return "neutral";
}

export function ToolReminderDates({
  toolId,
  reminders,
  canManage = true,
}: {
  toolId: string;
  reminders: Reminder[];
  canManage?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const res = await fetch(`/api/tools/${toolId}/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: formData.get("label"), date: formData.get("date") }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    e.currentTarget.reset();
    setShowAdd(false);
    router.refresh();
  }

  async function handleDelete(reminder: Reminder) {
    if (!confirm(`Delete reminder "${reminder.label}"?`)) return;
    const res = await fetch(`/api/tools/${toolId}/reminders/${reminder.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <ul className="flex flex-col gap-2 text-sm">
        {reminders.map((r) => {
          const days = daysUntil(r.date);
          return (
            <li key={r.id} className="flex items-center justify-between gap-2 border-b border-black/5 pb-2 last:border-0">
              <span>
                {r.label} <span className="text-black/50">— {new Date(`${r.date}T00:00:00Z`).toLocaleDateString()}</span>
              </span>
              <div className="flex items-center gap-2">
                <Badge tone={tone(days)}>{days < 0 ? `Overdue ${Math.abs(days)}d` : days === 0 ? "Today" : `${days}d`}</Badge>
                {canManage && (
                  <Button variant="ghost" className="px-2 py-0.5 text-xs" onClick={() => handleDelete(r)}>
                    Delete
                  </Button>
                )}
              </div>
            </li>
          );
        })}
        {reminders.length === 0 && <li className="text-black/50">No reminder dates set.</li>}
      </ul>

      {canManage && (
        <div className="mt-3">
          {showAdd ? (
            <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
              <div>
                <Label htmlFor="reminder-label">Label</Label>
                <Input id="reminder-label" name="label" placeholder="e.g. Warranty expiry" required className="w-48" />
              </div>
              <div>
                <Label htmlFor="reminder-date">Date</Label>
                <Input id="reminder-date" name="date" type="date" required />
              </div>
              <Button type="submit" disabled={submitting} className="px-3 py-1.5 text-xs">
                Add
              </Button>
              <Button variant="ghost" type="button" className="px-3 py-1.5 text-xs" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setShowAdd(true)}>
              + Add reminder date
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
