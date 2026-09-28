"use client";

import { useOffline } from "next/offline";

export function OfflineBanner() {
  const isOffline = useOffline();
  if (!isOffline) return null;
  return (
    <div
      role="status"
      className="no-print bg-gold px-4 py-2 text-center text-sm font-semibold text-electric-blue"
    >
      You are offline. Catalogue, size guide, and last orders stay on this phone. New orders wait here
      until you are back online.
    </div>
  );
}
