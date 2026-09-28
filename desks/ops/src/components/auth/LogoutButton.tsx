"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  className?: string;
};

export function LogoutButton({ className }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={loading}
      className={
        className ??
        "rounded-[var(--radius-sm)] border border-card-border px-3 py-1.5 text-sm font-semibold text-ink-muted hover:bg-light-blue-30 disabled:opacity-60"
      }
    >
      {loading ? "…" : "Sign out"}
    </button>
  );
}
