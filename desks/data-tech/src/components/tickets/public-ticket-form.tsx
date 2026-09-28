"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABELS, TICKET_IMPACT_LABELS, TICKET_IMPACTS } from "@/lib/ticket-constants";

export function PublicTicketForm({ departments }: { departments: { id: string; name: string }[] }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    if (formData.get("attachment") instanceof File && (formData.get("attachment") as File).size === 0) {
      formData.delete("attachment");
    }

    if (!formData.get("submitterEmail") && !formData.get("submitterPhone")) {
      setSubmitting(false);
      setError("Please provide an email or a phone number.");
      return;
    }

    const res = await fetch("/api/public/tickets", { method: "POST", body: formData });
    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    const data = await res.json();
    setTicketNumber(data.ticketNumber);
    e.currentTarget.reset();
  }

  if (ticketNumber) {
    return (
      <Card>
        <h2 className="text-lg font-medium text-navy">Ticket submitted</h2>
        <p className="mt-2 text-black/70">
          Your ticket <strong>{ticketNumber}</strong> has been received. We&apos;ve emailed you a confirmation — our
          tech team will be back to you shortly.
        </p>
        <Button className="mt-4" variant="secondary" onClick={() => setTicketNumber(null)}>
          Submit another ticket
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="submitterName">Your name</Label>
          <Input id="submitterName" name="submitterName" />
        </div>
        <div>
          <Label htmlFor="issue">Describe the issue</Label>
          <Textarea id="issue" name="issue" rows={4} required minLength={5} maxLength={5000} />
        </div>
        <div>
          <Label htmlFor="category">What kind of issue?</Label>
          <Select id="category" name="category" defaultValue="other">
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {TICKET_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="impact">Who is affected?</Label>
            <Select id="impact" name="impact" defaultValue="individual">
              {TICKET_IMPACTS.map((i) => (
                <option key={i} value={i}>
                  {TICKET_IMPACT_LABELS[i]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="campus">Campus / site</Label>
            <Input id="campus" name="campus" placeholder="Which campus?" />
          </div>
        </div>
        <p className="text-sm text-black/60">Provide your email, your phone number, or both — we just need one to reach you.</p>
        <div>
          <Label htmlFor="submitterEmail">Your email</Label>
          <Input id="submitterEmail" name="submitterEmail" type="email" />
        </div>
        <div>
          <Label htmlFor="submitterPhone">Phone number</Label>
          <Input id="submitterPhone" name="submitterPhone" type="tel" />
        </div>
        <div>
          <Label htmlFor="placeOfWork">Place of work</Label>
          <Input id="placeOfWork" name="placeOfWork" />
        </div>
        {departments.length > 0 && (
          <div>
            <Label htmlFor="departmentId">Department (optional)</Label>
            <Select id="departmentId" name="departmentId" defaultValue="">
              <option value="">Not sure</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="attachment">Attach a screenshot (optional)</Label>
          <input
            id="attachment"
            name="attachment"
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="block w-full text-sm"
          />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit ticket"}
        </Button>
      </form>
    </Card>
  );
}
