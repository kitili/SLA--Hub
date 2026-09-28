"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DeleteToolButton({
  toolId,
  label,
  redirectTo,
  small,
}: {
  toolId: string;
  label: string;
  redirectTo?: string;
  small?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete ${label}? This removes its allocation and condition history too. This can't be undone.`)) {
      return;
    }

    setPending(true);
    const res = await fetch(`/api/tools/${toolId}`, { method: "DELETE" });
    setPending(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Something went wrong.");
      return;
    }

    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <Button
      variant="danger"
      disabled={pending}
      onClick={handleDelete}
      className={small ? "px-2 py-1 text-xs" : undefined}
    >
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}
