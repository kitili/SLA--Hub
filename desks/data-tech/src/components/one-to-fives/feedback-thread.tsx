"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type FeedbackItem = {
  id: string;
  body: string;
  createdAt: Date | string;
  author?: { name: string } | null;
};

export function FeedbackThread({
  oneToFiveId,
  items,
  compact = false,
}: {
  oneToFiveId: string;
  items: FeedbackItem[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function send() {
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/one-to-fives/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oneToFiveId, body }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not send feedback.");
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <div className={compact ? "mt-2" : "mt-4"}>
      {items.length > 0 && (
        <ul className="mb-2 flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-md bg-gray-light px-3 py-2 text-sm">
              <div className="text-xs font-medium text-navy">{item.author?.name ?? "Staff"}</div>
              <p className="text-black/80">{item.body}</p>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mb-2 text-xs text-red-700">{error}</p>}
      <div className="flex flex-col gap-2">
        <Textarea
          rows={compact ? 2 : 3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Leave feedback on this 1–5"
        />
        <Button type="button" variant="secondary" disabled={submitting || !body.trim()} onClick={() => void send()}>
          {submitting ? "Sending…" : "Send feedback"}
        </Button>
      </div>
    </div>
  );
}
