"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SimpleCreateList({
  title,
  apiPath,
  items,
  canManage = true,
}: {
  title: string;
  apiPath: string;
  items: { id: string; name: string; description?: string | null }[];
  canManage?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    setName("");
    router.refresh();
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-medium text-navy">{title}</h1>
      {canManage && (
        <Card className="mb-6 max-w-md">
          {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
            <Button type="submit" disabled={submitting}>
              Add
            </Button>
          </form>
        </Card>
      )}

      <Card className="max-w-md p-0">
        <ul>
          {items.map((item) => (
            <li key={item.id} className="border-b border-black/5 px-4 py-3 text-sm last:border-0">
              {item.name}
            </li>
          ))}
          {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-black/50">Nothing yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
