"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Mode = "email" | "phone";

type Ticket = {
  id: string;
  ticketNumber: string;
  issue: string;
  phase: "unassigned" | "in_progress" | "complete";
  priority: string;
  createdAt: string;
  resolvedAt: string | null;
};

export function TicketLookupForm() {
  const [mode, setMode] = useState<Mode>("email");
  const [value, setValue] = useState("");
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const param = mode === "email" ? "email" : "phone";
    const res = await fetch(`/api/public/tickets/lookup?${param}=${encodeURIComponent(value)}`);
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      setTickets(null);
      return;
    }

    const data = await res.json();
    setTickets(data.tickets);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={mode === "email"}
            onChange={() => {
              setMode("email");
              setValue("");
            }}
          />
          Search by email
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={mode === "phone"}
            onChange={() => {
              setMode("phone");
              setValue("");
            }}
          />
          Search by phone number
        </label>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type={mode === "email" ? "email" : "tel"}
          required
          placeholder={mode === "email" ? "you@company.com" : "0712 345 678"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </Button>
      </form>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {tickets && (
        <div className="flex flex-col gap-3">
          {tickets.map((t) => (
            <Card key={t.id}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-navy">{t.ticketNumber}</span>
                <Badge tone={t.phase === "complete" ? "success" : t.phase === "in_progress" ? "info" : "warning"}>
                  {t.phase.replace("_", " ")}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-black/80">{t.issue}</p>
              <p className="mt-1 text-xs text-black/50">
                Submitted {new Date(t.createdAt).toLocaleDateString()}
                {t.resolvedAt ? ` · Resolved ${new Date(t.resolvedAt).toLocaleDateString()}` : ""}
              </p>
            </Card>
          ))}
          {tickets.length === 0 && (
            <p className="text-sm text-black/50">No tickets found for that {mode === "email" ? "email" : "phone number"}.</p>
          )}
        </div>
      )}
    </div>
  );
}
