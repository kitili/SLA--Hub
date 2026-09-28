"use client";

import { useEffect, useState } from "react";

type Props = {
  queuedCount?: number;
  gpsStatus?: string;
};

export function DriverConnectivityBanner({
  queuedCount = 0,
  gpsStatus,
}: Props) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    function sync() {
      setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    }
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (online && queuedCount === 0 && gpsStatus !== "denied") return null;

  let message = "";
  let tone: "warn" | "ok" | "danger" = "warn";

  if (!online) {
    message =
      queuedCount > 0
        ? "You’re offline — your location is saved on this phone and will send when you’re back online."
        : "You’re offline — location will send when you reconnect.";
    tone = "warn";
  } else if (gpsStatus === "denied") {
    message =
      "Location is off — allow location access so the office can see your bus.";
    tone = "danger";
  } else if (queuedCount > 0) {
    message = "Sending saved location to the office…";
    tone = "ok";
  }

  if (!message) return null;

  return (
    <div
      role="status"
      className={`mx-4 mt-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold shadow-sm ${
        tone === "danger"
          ? "bg-danger-15 text-danger"
          : tone === "ok"
            ? "bg-success-15 text-success"
            : "bg-gold-15 text-ink"
      }`}
    >
      {message}
    </div>
  );
}
