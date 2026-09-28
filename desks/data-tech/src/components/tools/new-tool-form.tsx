"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function NewToolForm({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetTag: formData.get("assetTag"),
        name: formData.get("name"),
        categoryId: formData.get("categoryId"),
        brand: formData.get("brand") || undefined,
        model: formData.get("model") || undefined,
        specifications: formData.get("specifications") || undefined,
        serialNumber: formData.get("serialNumber") || undefined,
        purchaseDate: formData.get("purchaseDate") || undefined,
        purchasePrice: formData.get("purchasePrice") || undefined,
        notes: formData.get("notes") || undefined,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    const { tool } = await res.json();
    router.push(`/dashboard/tools/${tool.id}`);
  }

  return (
    <Card className="max-w-lg">
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="assetTag">Asset tag</Label>
          <Input id="assetTag" name="assetTag" required />
        </div>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required />
        </div>
        <div>
          <Label htmlFor="categoryId">Category</Label>
          <Select id="categoryId" name="categoryId" required defaultValue="">
            <option value="" disabled>
              Select a category
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Link href="/dashboard/tools/categories" className="mt-1 inline-block text-xs text-navy underline">
            Manage categories
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="brand">Brand</Label>
            <Input id="brand" name="brand" />
          </div>
          <div>
            <Label htmlFor="model">Model</Label>
            <Input id="model" name="model" />
          </div>
        </div>
        <div>
          <Label htmlFor="specifications">Specifications</Label>
          <Input id="specifications" name="specifications" placeholder="e.g. 16GB RAM, 512GB SSD, i7" />
        </div>
        <div>
          <Label htmlFor="serialNumber">Serial number</Label>
          <Input id="serialNumber" name="serialNumber" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="purchaseDate">Purchase date</Label>
            <Input id="purchaseDate" name="purchaseDate" type="date" />
          </div>
          <div>
            <Label htmlFor="purchasePrice">Purchase price</Label>
            <Input id="purchasePrice" name="purchasePrice" type="number" min="0" step="0.01" />
          </div>
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Input id="notes" name="notes" />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Add tool"}
        </Button>
      </form>
    </Card>
  );
}
