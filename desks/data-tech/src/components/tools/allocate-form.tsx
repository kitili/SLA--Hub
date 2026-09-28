"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

type Target = "person" | "department" | "location";

export function AllocateForm({
  tools,
  departments,
  locations,
}: {
  tools: { id: string; assetTag: string; name: string }[];
  departments: { id: string; name: string }[];
  locations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [targetType, setTargetType] = useState<Target>("person");
  const [personName, setPersonName] = useState("");
  const [targetId, setTargetId] = useState("");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const targetOptions = targetType === "department" ? departments : targetType === "location" ? locations : [];
  const canSubmit = selected.length > 0 && (targetType === "person" ? personName.trim().length > 0 : Boolean(targetId));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const targetField =
      targetType === "person"
        ? { allocatedToPersonName: personName.trim() }
        : targetType === "department"
          ? { allocatedToDepartmentId: targetId }
          : { allocatedToLocationId: targetId };
    const extra = {
      expectedReturnAt: expectedReturnDate ? new Date(expectedReturnDate).toISOString() : undefined,
      purpose: purpose || undefined,
      notes: notes || undefined,
    };

    const isBulk = selected.length > 1;
    const res = await fetch(isBulk ? "/api/tools/allocate/bulk" : "/api/tools/allocate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isBulk ? { toolIds: selected, ...targetField, ...extra } : { toolId: selected[0], ...targetField, ...extra },
      ),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    setDone(true);
    setSelected([]);
    setPersonName("");
    setTargetId("");
    setExpectedReturnDate("");
    setPurpose("");
    setNotes("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="mb-3 text-sm font-medium text-black/60">Select tool(s) — unallocated only</h2>
        <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto text-sm">
          {tools.map((tool) => (
            <li key={tool.id}>
              <label className="flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-light">
                <input type="checkbox" checked={selected.includes(tool.id)} onChange={() => toggle(tool.id)} />
                <span className="font-medium">{tool.assetTag}</span>
                <span className="text-black/60">{tool.name}</span>
              </label>
            </li>
          ))}
          {tools.length === 0 && <li className="text-black/50">No unallocated tools.</li>}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-medium text-black/60">Distribute to</h2>
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {done && <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Allocated.</p>}

        <div className="mb-3 flex gap-4 text-sm">
          {(["person", "department", "location"] as const).map((t) => (
            <label key={t} className="flex items-center gap-1">
              <input
                type="radio"
                checked={targetType === t}
                onChange={() => {
                  setTargetType(t);
                  setTargetId("");
                  setPersonName("");
                }}
              />
              {t === "person" ? "Person" : t === "department" ? "Department" : "Place"}
            </label>
          ))}
        </div>

        {targetType === "person" ? (
          <>
            <Label htmlFor="personName">Name of the requester</Label>
            <Input
              id="personName"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              placeholder="e.g. Jane Doe"
            />
          </>
        ) : (
          <>
            <Label htmlFor="target">{targetType === "department" ? "Department" : "Location"}</Label>
            <Select id="target" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Select…</option>
              {targetOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
            {targetType === "location" && (
              <Link href="/dashboard/tools/locations" className="mt-1 inline-block text-xs text-navy underline">
                Manage locations
              </Link>
            )}
          </>
        )}

        <Label htmlFor="expectedReturnDate" className="mt-3">
          Expected return date
        </Label>
        <Input
          id="expectedReturnDate"
          type="date"
          value={expectedReturnDate}
          onChange={(e) => setExpectedReturnDate(e.target.value)}
        />

        <Label htmlFor="purpose" className="mt-3">
          Purpose of use
        </Label>
        <Input id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Field visit, WFH" />

        <Label htmlFor="notes" className="mt-3">
          Notes
        </Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />

        <Button type="submit" className="mt-4 w-full" disabled={submitting || !canSubmit}>
          {submitting ? "Allocating…" : `Allocate ${selected.length || ""} tool${selected.length === 1 ? "" : "s"}`}
        </Button>
      </Card>
    </form>
  );
}
