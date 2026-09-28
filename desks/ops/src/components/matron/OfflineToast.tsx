"use client";

import { useEffect, useState } from "react";

type Props = {
  offlineMessage?: string;
  onlineMessage?: string;
};

export function OfflineToast({
  offlineMessage = "You’re offline — scans won’t save until you’re back online.",
  onlineMessage = "Back online",
}: Props) {
  const [offline, setOffline] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function sync() {
      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
      setOffline(isOffline);
      if (isOffline) setVisible(true);
    }
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (!offline) {
      const t = window.setTimeout(() => setVisible(false), 2200);
      return () => window.clearTimeout(t);
    }
  }, [offline]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className={`fixed inset-x-4 bottom-20 z-50 mx-auto max-w-md rounded-[var(--radius)] px-4 py-3 text-sm font-semibold shadow-[var(--shadow-lg)] transition ${
        offline
          ? "border border-gold/50 bg-navy text-white"
          : "border border-success/40 bg-success-15 text-success"
      }`}
    >
      {offline ? offlineMessage : onlineMessage}
    </div>
  );
}
