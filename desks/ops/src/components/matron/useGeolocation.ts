"use client";

import { useCallback, useEffect, useState } from "react";
import type { GeoPosition, GeoStatus } from "@/lib/geo/format";

type Options = {
  requestOnMount?: boolean;
};

export function useGeolocation({ requestOnMount = true }: Options = {}) {
  const [status, setStatus] = useState<GeoStatus>(
    requestOnMount ? "loading" : "idle",
  );
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);

  const captureNow = useCallback((): Promise<GeoPosition | null> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !("geolocation" in navigator)) {
        setStatus("unavailable");
        setError("GPS is not supported on this device or browser.");
        resolve(null);
        return;
      }

      setStatus("loading");
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (result) => {
          const next: GeoPosition = {
            lat: result.coords.latitude,
            lng: result.coords.longitude,
            accuracy: result.coords.accuracy,
            capturedAt: new Date().toISOString(),
          };
          setPosition(next);
          setStatus("granted");
          resolve(next);
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setStatus("denied");
            setError(
              "Location permission denied. Enable GPS in browser settings.",
            );
          } else if (err.code === err.TIMEOUT) {
            setStatus("unavailable");
            setError(
              "GPS timed out. Tap Retry outdoors, or continue without GPS for now.",
            );
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            setStatus("unavailable");
            setError(
              "Location unavailable. Try moving to an open area, or tap Retry.",
            );
          } else {
            setStatus("unavailable");
            setError("Could not read GPS. Tap Retry to try again.");
          }
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 0,
        },
      );
    });
  }, []);

  const requestLocation = useCallback(() => {
    void captureNow();
  }, [captureNow]);

  useEffect(() => {
    if (requestOnMount) {
      void captureNow();
    }
  }, [requestOnMount, captureNow]);

  return {
    status,
    position,
    error,
    requestLocation,
    captureNow,
  };
}
