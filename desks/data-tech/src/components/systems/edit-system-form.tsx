"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type System = {
  id: string;
  name: string;
  description: string | null;
  features: string[];
  techStack: string[];
  url: string | null;
  status: "active" | "in_development" | "maintenance" | "deprecated";
  leadId: string | null;
  departmentId: string | null;
  state: "open" | "closed";
  startDate: string | null;
  targetDate: string | null;
  wipInProgress: number | null;
  wipReview: number | null;
  defaultCapacityPoints: number | null;
  defaultCapacityMinutes: number | null;
};

export function EditSystemForm({
  system,
  staff,
  departments,
}: {
  system: System;
  staff: { id: string; name: string }[];
  departments: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const features = String(formData.get("features") ?? "")
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
    const techStack = String(formData.get("techStack") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const res = await fetch(`/api/systems/${system.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        description: formData.get("description") || null,
        features,
        techStack,
        url: formData.get("url") || null,
        status: formData.get("status"),
        leadId: formData.get("leadId") || null,
        departmentId: formData.get("departmentId") || null,
        state: formData.get("state"),
        startDate: formData.get("startDate") || null,
        targetDate: formData.get("targetDate") || null,
        wipInProgress: formData.get("wipInProgress") ? Number(formData.get("wipInProgress")) : null,
        wipReview: formData.get("wipReview") ? Number(formData.get("wipReview")) : null,
        defaultCapacityPoints: formData.get("defaultCapacityPoints") ? Number(formData.get("defaultCapacityPoints")) : null,
        defaultCapacityMinutes: formData.get("defaultCapacityMinutes") ? Number(formData.get("defaultCapacityMinutes")) : null,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    router.push(`/dashboard/systems/${system.id}`);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Delete "${system.name}"? This also deletes its task board.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/systems/${system.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      setDeleting(false);
      return;
    }
    router.push("/dashboard/systems");
  }

  return (
    <Card className="max-w-lg">
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={system.name} required />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={3} defaultValue={system.description ?? ""} />
        </div>
        <div>
          <Label htmlFor="features">Features (one per line)</Label>
          <Textarea id="features" name="features" rows={4} defaultValue={system.features.join("\n")} />
        </div>
        <div>
          <Label htmlFor="techStack">Tech stack (comma-separated)</Label>
          <Input id="techStack" name="techStack" defaultValue={system.techStack.join(", ")} />
        </div>
        <div>
          <Label htmlFor="url">Live URL</Label>
          <Input id="url" name="url" type="url" defaultValue={system.url ?? ""} />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={system.status}>
            <option value="active">Active</option>
            <option value="in_development">In development</option>
            <option value="maintenance">Maintenance</option>
            <option value="deprecated">Deprecated</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="leadId">Project lead (optional)</Label>
          <Select id="leadId" name="leadId" defaultValue={system.leadId ?? ""}>
            <option value="">None</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="departmentId">Department desk</Label>
          <Select id="departmentId" name="departmentId" defaultValue={system.departmentId ?? ""}>
            <option value="">Unassigned</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="state">Access</Label>
          <Select id="state" name="state" defaultValue={system.state}>
            <option value="open">Open — anyone with access can add/edit/assign tasks</option>
            <option value="closed">Closed — only the lead/managers can, others move only their own tasks</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="wipInProgress">WIP limit — In progress</Label>
            <Input id="wipInProgress" name="wipInProgress" type="number" min={1} defaultValue={system.wipInProgress ?? ""} />
          </div>
          <div>
            <Label htmlFor="wipReview">WIP limit — Review</Label>
            <Input id="wipReview" name="wipReview" type="number" min={1} defaultValue={system.wipReview ?? ""} />
          </div>
          <div>
            <Label htmlFor="defaultCapacityPoints">Default capacity (points)</Label>
            <Input id="defaultCapacityPoints" name="defaultCapacityPoints" type="number" min={0} defaultValue={system.defaultCapacityPoints ?? ""} />
          </div>
          <div>
            <Label htmlFor="defaultCapacityMinutes">Default capacity (minutes)</Label>
            <Input id="defaultCapacityMinutes" name="defaultCapacityMinutes" type="number" min={0} defaultValue={system.defaultCapacityMinutes ?? ""} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="startDate">Start date (optional)</Label>
            <Input id="startDate" name="startDate" type="date" defaultValue={system.startDate ?? ""} />
          </div>
          <div>
            <Label htmlFor="targetDate">Target date (optional)</Label>
            <Input id="targetDate" name="targetDate" type="date" defaultValue={system.targetDate ?? ""} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Button type="button" variant="danger" disabled={deleting} onClick={handleDelete}>
            {deleting ? "Deleting…" : "Delete system"}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
