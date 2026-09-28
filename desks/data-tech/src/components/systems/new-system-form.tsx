"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function NewSystemForm({
  staff,
  departments,
}: {
  staff: { id: string; name: string }[];
  departments: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

    const res = await fetch("/api/systems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        description: formData.get("description") || undefined,
        features,
        techStack,
        url: formData.get("url") || undefined,
        status: formData.get("status"),
        leadId: formData.get("leadId") || undefined,
        departmentId: formData.get("departmentId") || undefined,
        state: formData.get("state"),
        startDate: formData.get("startDate") || undefined,
        targetDate: formData.get("targetDate") || undefined,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    const { system } = await res.json();
    router.push(`/dashboard/systems/${system.id}`);
  }

  return (
    <Card className="max-w-lg">
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={3} />
        </div>
        <div>
          <Label htmlFor="features">Features (one per line)</Label>
          <Textarea id="features" name="features" rows={4} placeholder={"Ticket phases\nMulti-assignee\nEmail notifications"} />
        </div>
        <div>
          <Label htmlFor="techStack">Tech stack (comma-separated)</Label>
          <Input id="techStack" name="techStack" placeholder="Next.js, Postgres, Drizzle" />
        </div>
        <div>
          <Label htmlFor="url">Live URL</Label>
          <Input id="url" name="url" type="url" placeholder="https://example.com" />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue="active">
            <option value="active">Active</option>
            <option value="in_development">In development</option>
            <option value="maintenance">Maintenance</option>
            <option value="deprecated">Deprecated</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="leadId">Project lead (optional)</Label>
          <Select id="leadId" name="leadId" defaultValue="">
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
          <Select id="departmentId" name="departmentId" defaultValue="">
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
          <Select id="state" name="state" defaultValue="open">
            <option value="open">Open — anyone with access can add/edit/assign tasks</option>
            <option value="closed">Closed — only the lead/managers can, others move only their own tasks</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="startDate">Start date (optional)</Label>
            <Input id="startDate" name="startDate" type="date" />
          </div>
          <div>
            <Label htmlFor="targetDate">Target date (optional)</Label>
            <Input id="targetDate" name="targetDate" type="date" />
          </div>
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Add system"}
        </Button>
      </form>
    </Card>
  );
}
