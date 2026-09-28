"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  const router = useRouter();
  const forced = useSearchParams().get("forced") === "1";
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/users/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: formData.get("currentPassword"),
        newPassword: formData.get("newPassword"),
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong.");
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/login"), 1500);
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-xl font-medium text-navy">My profile</h1>
      {forced && !done && (
        <p className="mb-4 rounded-md bg-gold-accent/40 px-3 py-2 text-sm text-black">
          You need to set a new password before continuing.
        </p>
      )}
      <Card>
        <h2 className="mb-4 text-sm font-medium text-black/70">Change password</h2>
        {done ? (
          <p className="text-sm text-green-700">Password changed. Redirecting to sign in…</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div>
              <Label htmlFor="currentPassword">Current password</Label>
              <Input id="currentPassword" name="currentPassword" type="password" required />
            </div>
            <div>
              <Label htmlFor="newPassword">New password</Label>
              <Input id="newPassword" name="newPassword" type="password" required minLength={10} />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save new password"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
