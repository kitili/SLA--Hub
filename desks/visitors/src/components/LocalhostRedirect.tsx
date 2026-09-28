"use client";

import { useEffect } from "react";

export function LocalhostRedirect() {
  useEffect(() => {
    const hostname = window.location.hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") return;

    void fetch("/api/check-in-url")
      .then((response) => response.json())
      .then((payload: { base: string; onLocalhost: boolean }) => {
        if (!payload.onLocalhost || !payload.base) return;
        const target = new URL(window.location.pathname + window.location.search, payload.base);
        if (target.hostname === hostname) return;
        window.location.replace(target.toString());
      })
      .catch(() => undefined);
  }, []);

  return null;
}
