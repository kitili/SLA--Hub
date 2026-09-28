"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Holiday = { id: string; holidayDate: string; name: string };
type ExtraDay = { id: string; workDate: string; reason: string | null };

export function CalendarSettings({
  holidays,
  extraDays,
}: {
  holidays: Holiday[];
  extraDays: ExtraDay[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function postJson(url: string, form: HTMLFormElement, fail: string) {
    const body = Object.fromEntries(new FormData(form).entries());
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? fail);
      return;
    }
    form.reset();
    router.refresh();
  }

  async function remove(kind: "holidays" | "extra-days", id: string) {
    await fetch(`/api/one-to-fives/${kind}?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="mb-3 text-lg font-medium text-navy">Public holidays</h2>
        <p className="mb-3 text-sm text-black/50">No 1–5 or pulse is expected on these dates.</p>
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <form
          method="post"
          onSubmit={(e) => {
            e.preventDefault();
            void postJson("/api/one-to-fives/holidays", e.currentTarget, "Could not add holiday.");
          }}
          className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
        >
          <div>
            <Label htmlFor="holidayDate">Date</Label>
            <Input id="holidayDate" name="holidayDate" type="date" required />
          </div>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="e.g. Nyerere Day" />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              onClick={(e) => {
                const form = e.currentTarget.closest("form");
                if (form) void postJson("/api/one-to-fives/holidays", form, "Could not add holiday.");
              }}
            >
              Add
            </Button>
          </div>
        </form>
        <ul className="flex flex-col gap-2 text-sm">
          {holidays.map((h) => (
            <li key={h.id} className="flex items-center justify-between">
              <span>
                {h.holidayDate} · {h.name}
              </span>
              <Button variant="ghost" type="button" onClick={() => remove("holidays", h.id)}>
                Remove
              </Button>
            </li>
          ))}
          {holidays.length === 0 && <li className="text-black/50">None marked.</li>}
        </ul>
      </Card>
      <Card>
        <h2 className="mb-3 text-lg font-medium text-navy">Extra work days</h2>
        <p className="mb-3 text-sm text-black/50">Weekends the admin turns on so staff still file a 1–5.</p>
        <form
          method="post"
          onSubmit={(e) => {
            e.preventDefault();
            void postJson("/api/one-to-fives/extra-days", e.currentTarget, "Could not add extra day.");
          }}
          className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
        >
          <div>
            <Label htmlFor="workDate">Date</Label>
            <Input id="workDate" name="workDate" type="date" required />
          </div>
          <div>
            <Label htmlFor="reason">Reason</Label>
            <Input id="reason" name="reason" placeholder="e.g. Saturday catch-up" />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              onClick={(e) => {
                const form = e.currentTarget.closest("form");
                if (form) void postJson("/api/one-to-fives/extra-days", form, "Could not add extra day.");
              }}
            >
              Add
            </Button>
          </div>
        </form>
        <ul className="flex flex-col gap-2 text-sm">
          {extraDays.map((d) => (
            <li key={d.id} className="flex items-center justify-between">
              <span>
                {d.workDate}
                {d.reason ? ` · ${d.reason}` : ""}
              </span>
              <Button variant="ghost" type="button" onClick={() => remove("extra-days", d.id)}>
                Remove
              </Button>
            </li>
          ))}
          {extraDays.length === 0 && <li className="text-black/50">None marked.</li>}
        </ul>
      </Card>
    </div>
  );
}
