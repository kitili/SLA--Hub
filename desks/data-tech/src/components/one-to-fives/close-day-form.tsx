"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { OneToFiveProgress } from "@/lib/one-to-fives-constants";

export function CloseDayForm({
  workDate,
  slots,
  current,
}: {
  workDate: string;
  slots: { key: "slot1Progress" | "slot2Progress" | "slot3Progress"; label: string | null; value: OneToFiveProgress | null }[];
  current: { closedAt: Date | string | null };
}) {
  const router = useRouter();
  const filled = slots.filter((s) => s.label);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (filled.length === 0) return null;

  async function save(formEl: HTMLFormElement) {
    setError(null);
    setSaved(false);
    setSubmitting(true);
    const form = new FormData(formEl);
    const progress = Object.fromEntries(
      filled.map((slot) => [slot.key, form.get(slot.key) === "completed" ? "completed" : "in_progress"]),
    );
    const res = await fetch("/api/one-to-fives", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workDate, ...progress }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not close the day.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="rounded-md border border-navy/15 bg-navy/[0.03] p-4">
      <h3 className="text-sm font-medium text-navy">End of day</h3>
      <p className="mb-3 text-xs text-black/50">Tick what you finished.</p>
      {saved && <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Day closed.</p>}
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(e.currentTarget);
        }}
        className="flex flex-col gap-3"
      >
        {filled.map((slot) => (
          <label key={slot.key} className="flex items-start gap-2 text-sm text-black/80">
            <input
              type="checkbox"
              name={slot.key}
              value="completed"
              defaultChecked={slot.value === "completed"}
              className="mt-1"
            />
            <span>{slot.label}</span>
          </label>
        ))}
        <Button
          type="button"
          disabled={submitting}
          onClick={(e) => {
            const form = e.currentTarget.closest("form");
            if (form) void save(form);
          }}
        >
          {submitting ? "Saving…" : current.closedAt ? "Update" : "Close my day"}
        </Button>
      </form>
    </div>
  );
}
