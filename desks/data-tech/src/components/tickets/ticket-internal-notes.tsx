"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function TicketInternalNotes({ ticketId, notes }: { ticketId: string; notes: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(notes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ internalNotes: value.trim() || null }),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save notes.");
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <Label htmlFor="internalNotes">Internal notes</Label>
      <p className="mb-2 text-xs text-black/45">Staff only — not sent to the person who filed the ticket.</p>
      {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Textarea
        id="internalNotes"
        rows={4}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={8000}
        placeholder="Root cause, workaround, who to call, parts on order…"
      />
      <Button className="mt-3" variant="secondary" disabled={pending} onClick={() => void save()}>
        {pending ? "Saving…" : "Save notes"}
      </Button>
    </Card>
  );
}
