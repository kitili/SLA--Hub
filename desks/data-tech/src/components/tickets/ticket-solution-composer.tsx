"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export function TicketSolutionComposer({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [isSolution, setIsSolution] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePost() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/tickets/${ticketId}/solutions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: comment, isSolution }),
    });
    setPending(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    setComment("");
    setIsSolution(false);
    router.refresh();
  }

  return (
    <div className="rounded-md border border-dashed border-navy/30 bg-navy/[0.03] p-3">
      {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Textarea
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Add an update, or describe the fix that solved it…"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-black/70">
          <input type="checkbox" checked={isSolution} onChange={(e) => setIsSolution(e.target.checked)} />
          This is the solution
        </label>
        <Button disabled={pending || comment.trim().length === 0} onClick={handlePost}>
          {pending ? "Posting…" : "Post update"}
        </Button>
      </div>
    </div>
  );
}
