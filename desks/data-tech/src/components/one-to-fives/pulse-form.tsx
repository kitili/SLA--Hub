"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { OneToFiveStatus } from "@/lib/one-to-fives-constants";

type Pulse = {
  departmentId: string;
  weekThursday: string;
  wins: string | null;
  risks: string | null;
  helpNeeded: string | null;
  status: OneToFiveStatus;
  skipReason: string | null;
  submittedAt: Date | string | null;
  department?: { name: string } | null;
};

export function PulseForm({
  weekThursday,
  isThursday,
  departments,
  pulses,
  defaultDepartmentId,
  canManage,
}: {
  weekThursday: string;
  isThursday: boolean;
  departments: { id: string; name: string }[];
  pulses: Pulse[];
  defaultDepartmentId?: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const current = pulses.find((p) => p.departmentId === (defaultDepartmentId ?? pulses[0]?.departmentId));

  async function save(formEl: HTMLFormElement) {
    setError(null);
    setSaved(false);
    setSubmitting(true);
    const form = new FormData(formEl);
    const res = await fetch("/api/pulse-checks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        departmentId: form.get("departmentId"),
        weekThursday,
        wins: form.get("wins"),
        risks: form.get("risks"),
        helpNeeded: form.get("helpNeeded"),
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  if (!isThursday) {
    return (
      <p className="text-sm text-black/45">
        Thursday pulse is next. Last week: {weekThursday}.
      </p>
    );
  }

  return (
    <Card className="max-w-2xl">
      <h2 className="text-lg font-medium text-navy">Thursday pulse</h2>
      <p className="mb-4 text-sm text-black/50">Wins, risks, and help needed. Same 9:30 a.m. deadline.</p>
      {saved && <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Pulse saved.</p>}
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(e.currentTarget);
        }}
        className="flex flex-col gap-3"
      >
        {canManage && (
          <div>
            <Label htmlFor="departmentId">Department</Label>
            <Select id="departmentId" name="departmentId" defaultValue={defaultDepartmentId ?? departments[0]?.id}>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        {!canManage && <input type="hidden" name="departmentId" value={defaultDepartmentId ?? departments[0]?.id} />}
        <div>
          <Label htmlFor="wins">Wins</Label>
          <Textarea id="wins" name="wins" rows={2} defaultValue={current?.wins ?? ""} />
        </div>
        <div>
          <Label htmlFor="risks">Risks</Label>
          <Textarea id="risks" name="risks" rows={2} defaultValue={current?.risks ?? ""} />
        </div>
        <div>
          <Label htmlFor="helpNeeded">Help needed</Label>
          <Textarea id="helpNeeded" name="helpNeeded" rows={2} defaultValue={current?.helpNeeded ?? ""} />
        </div>
        <Button
          type="button"
          disabled={submitting}
          onClick={(e) => {
            const form = e.currentTarget.closest("form");
            if (form) void save(form);
          }}
        >
          {submitting ? "Saving…" : "Send pulse"}
        </Button>
      </form>
    </Card>
  );
}
