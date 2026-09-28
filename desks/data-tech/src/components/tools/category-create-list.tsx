"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DeviceIcon, DEVICE_ICON_OPTIONS, type DeviceIconKey } from "@/components/tools/device-icon";

type Category = { id: string; name: string; icon: DeviceIconKey; usefulLifeYears: number | null };

export function CategoryCreateList({ items, canManage }: { items: Category[]; canManage: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<DeviceIconKey>("other");
  const [usefulLifeYears, setUsefulLifeYears] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState<DeviceIconKey>("other");
  const [editUsefulLifeYears, setEditUsefulLifeYears] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/tools/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        icon,
        usefulLifeYears: usefulLifeYears ? Number(usefulLifeYears) : undefined,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    setName("");
    setIcon("other");
    setUsefulLifeYears("");
    router.refresh();
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setEditName(category.name);
    setEditIcon(category.icon);
    setEditUsefulLifeYears(category.usefulLifeYears != null ? String(category.usefulLifeYears) : "");
  }

  async function saveEdit(id: string) {
    setError(null);
    const res = await fetch(`/api/tools/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        icon: editIcon,
        usefulLifeYears: editUsefulLifeYears ? Number(editUsefulLifeYears) : null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(category: Category) {
    if (!confirm(`Delete "${category.name}"?`)) return;
    setError(null);
    const res = await fetch(`/api/tools/categories/${category.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-medium text-navy">Tool categories</h1>
      {canManage && (
        <Card className="mb-6 max-w-md">
          {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required className="flex-1" />
            <Select
              value={icon}
              onChange={(e) => setIcon(e.target.value as DeviceIconKey)}
              className="w-40 shrink-0"
            >
              {DEVICE_ICON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min={1}
              max={50}
              value={usefulLifeYears}
              onChange={(e) => setUsefulLifeYears(e.target.value)}
              placeholder="Useful life (yrs)"
              className="w-32 shrink-0"
            />
            <Button type="submit" disabled={submitting}>
              Add
            </Button>
          </form>
        </Card>
      )}

      <Card className="max-w-md p-0">
        <ul>
          {items.map((item) =>
            editingId === item.id ? (
              <li key={item.id} className="border-b border-black/5 p-3 last:border-0">
                <div className="flex flex-wrap gap-2">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1" />
                  <Select
                    value={editIcon}
                    onChange={(e) => setEditIcon(e.target.value as DeviceIconKey)}
                    className="w-36 shrink-0"
                  >
                    {DEVICE_ICON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={editUsefulLifeYears}
                    onChange={(e) => setEditUsefulLifeYears(e.target.value)}
                    placeholder="Useful life (yrs)"
                    className="w-32 shrink-0"
                  />
                </div>
                <div className="mt-2 flex gap-2">
                  <Button className="px-2 py-1 text-xs" onClick={() => saveEdit(item.id)}>
                    Save
                  </Button>
                  <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </li>
            ) : (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 border-b border-black/5 px-4 py-3 text-sm last:border-0"
              >
                <div className="flex items-center gap-3">
                  <DeviceIcon icon={item.icon} className="h-5 w-5 shrink-0 text-navy" />
                  {item.name}
                  {item.usefulLifeYears != null && (
                    <span className="text-xs text-black/40">{item.usefulLifeYears}yr life</span>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  {canManage && (
                    <>
                      <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => startEdit(item)}>
                        Edit
                      </Button>
                      <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => handleDelete(item)}>
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ),
          )}
          {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-black/50">Nothing yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
