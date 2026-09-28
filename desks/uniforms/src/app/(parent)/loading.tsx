"use client";

import { useOffline } from "next/offline";

export default function ParentLoading() {
  const offline = useOffline();
  return (
    <p className="text-sm text-ink-muted">
      {offline ? "Waiting for a connection to refresh your orders…" : "Loading parent app…"}
    </p>
  );
}
