"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CloseDayForm } from "@/components/one-to-fives/close-day-form";
import { FeedbackThread, type FeedbackItem } from "@/components/one-to-fives/feedback-thread";
import { STATUS_LABELS, type OneToFiveProgress, type OneToFiveStatus } from "@/lib/one-to-fives-constants";

type Entry = {
  id?: string;
  workDate: string;
  slot1: string | null;
  slot2: string | null;
  slot3: string | null;
  blockers: string | null;
  notes: string | null;
  priorSlot1Progress: OneToFiveProgress | null;
  priorSlot2Progress: OneToFiveProgress | null;
  priorSlot3Progress: OneToFiveProgress | null;
  slot1Progress?: OneToFiveProgress | null;
  slot2Progress?: OneToFiveProgress | null;
  slot3Progress?: OneToFiveProgress | null;
  closedAt?: Date | string | null;
  status: OneToFiveStatus;
  skipReason: string | null;
  submittedAt: Date | string | null;
  feedback?: FeedbackItem[];
};

const STATUS_TONE: Record<OneToFiveStatus, "success" | "warning" | "danger" | "neutral"> = {
  on_time: "success",
  late: "warning",
  missed: "danger",
  skipped: "neutral",
};

export function OneToFiveForm({
  workDate,
  workDay,
  friendlyDate,
  current,
  previousDate: _previousDate,
  previous: _previous,
  history,
  deadlinePassed,
  suggestions = [],
}: {
  workDate: string;
  workDay: boolean;
  friendlyDate: string;
  current: Entry | null;
  previousDate: string;
  previous: Entry | null;
  history: Entry[];
  deadlinePassed: boolean;
  suggestions?: { title: string; systemName: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(Boolean(current?.skipReason));

  async function save(formEl: HTMLFormElement) {
    setError(null);
    setSaved(false);
    setSubmitting(true);
    const form = new FormData(formEl);
    const text = (name: string) => {
      const value = form.get(name);
      return typeof value === "string" ? value : "";
    };
    const res = await fetch("/api/one-to-fives", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workDate,
        slot1: text("slot1"),
        slot2: text("slot2"),
        slot3: text("slot3"),
        blockers: text("blockers"),
        skipReason: skipping ? text("skipReason") : undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : `Could not save (${res.status}).`);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  function fillSuggestion(title: string) {
    const form = document.querySelector<HTMLFormElement>("form[data-one-to-five]");
    if (!form) return;
    for (const name of ["slot1", "slot2", "slot3"]) {
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLInputElement && !field.value.trim()) {
        field.value = title;
        return;
      }
    }
  }

  return (
    <Card className="w-full">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium text-navy">Your 1–5</h2>
          <p className="text-sm text-black/50">
            Three things for {friendlyDate}. Send before 9:30 a.m.
            {deadlinePassed && workDay ? " Late now — still send it." : ""}
          </p>
        </div>
        {current?.submittedAt && <Badge tone={STATUS_TONE[current.status]}>{STATUS_LABELS[current.status]}</Badge>}
      </div>
      {!workDay && (
        <p className="mb-3 rounded-md bg-gray-light px-3 py-2 text-sm text-black/70">Off today.</p>
      )}
      {saved && <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Saved.</p>}
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <form
        data-one-to-five
        onSubmit={(e) => {
          e.preventDefault();
          void save(e.currentTarget);
        }}
        className="flex flex-col gap-3"
      >
        {skipping ? (
          <div>
            <Label htmlFor="skipReason">Why are you skipping?</Label>
            <Textarea id="skipReason" name="skipReason" rows={2} required defaultValue={current?.skipReason ?? ""} />
          </div>
        ) : (
          <>
            {suggestions.length > 0 && !current?.submittedAt && (
              <div className="flex flex-wrap gap-2">
                {suggestions.slice(0, 3).map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    className="max-w-full truncate rounded-full border border-navy/10 bg-navy/[0.04] px-3 py-1 text-left text-xs text-navy hover:bg-blue-accent/30"
                    onClick={() => fillSuggestion(item.title)}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            )}
            <div>
              <Label htmlFor="slot1">1</Label>
              <Input id="slot1" name="slot1" defaultValue={current?.slot1 ?? ""} placeholder="Must do" />
            </div>
            <div>
              <Label htmlFor="slot2">2</Label>
              <Input id="slot2" name="slot2" defaultValue={current?.slot2 ?? ""} placeholder="Next" />
            </div>
            <div>
              <Label htmlFor="slot3">3</Label>
              <Input id="slot3" name="slot3" defaultValue={current?.slot3 ?? ""} placeholder="If there’s time" />
            </div>
          </>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={!workDay || submitting}
            onClick={(e) => {
              const form = e.currentTarget.closest("form");
              if (form) void save(form);
            }}
          >
            {submitting ? "Saving…" : current?.submittedAt ? "Update" : "Send"}
          </Button>
          <button
            type="button"
            className="text-xs text-black/45 underline"
            onClick={() => setSkipping((value) => !value)}
          >
            {skipping ? "Back to 1–5" : "Skip today"}
          </button>
        </div>
      </form>
      {current?.submittedAt && !current.skipReason && (
        <div className="mt-6">
          <CloseDayForm
            workDate={workDate}
            current={{ closedAt: current.closedAt ?? null }}
            slots={[
              { key: "slot1Progress", label: current.slot1, value: current.slot1Progress ?? null },
              { key: "slot2Progress", label: current.slot2, value: current.slot2Progress ?? null },
              { key: "slot3Progress", label: current.slot3, value: current.slot3Progress ?? null },
            ]}
          />
        </div>
      )}
      {current?.id && (current.feedback?.length || current.submittedAt) ? (
        <div className="mt-6 border-t border-black/10 pt-4">
          <h3 className="text-sm font-medium text-navy">Feedback</h3>
          <FeedbackThread oneToFiveId={current.id} items={current.feedback ?? []} compact />
        </div>
      ) : null}
      {history.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-black/50">Earlier days</summary>
          <ul className="mt-3 flex flex-col gap-2">
            {history.slice(0, 5).map((row) => (
              <li key={row.workDate} className="rounded-md border border-black/10 px-3 py-2 text-sm">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-medium">{row.workDate}</span>
                  <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABELS[row.status]}</Badge>
                </div>
                {row.skipReason ? (
                  <p className="text-black/60">{row.skipReason}</p>
                ) : (
                  <ol className="list-decimal pl-4 text-black/80">
                    {row.slot1 && <li>{row.slot1}</li>}
                    {row.slot2 && <li>{row.slot2}</li>}
                    {row.slot3 && <li>{row.slot3}</li>}
                  </ol>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
