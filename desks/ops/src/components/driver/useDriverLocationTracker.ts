"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  enqueueLocationPing,
  flushLocationOutbox,
  listQueuedPings,
} from "@/lib/driver/location-outbox";

const MIN_SEND_INTERVAL_MS = 10_000;
const WATCHDOG_INTERVAL_MS = 10_000;
const STALE_FIX_MS = 40_000;
const RETRY_BACKOFF_MS = [4_000, 8_000, 15_000];
const ERROR_STATUS_THRESHOLD = 2;
const FLUSH_INTERVAL_MS = 15_000;

type TrackerStatus = "idle" | "tracking" | "denied" | "error" | "unsupported";

type Options = {
  tripId: string | null | undefined;
  enabled?: boolean;
};

type Coords = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
};

/**
 * Matron GPS → live trail, with IndexedDB outbox when the network drops.
 */
export function useDriverLocationTracker({ tripId, enabled = true }: Options) {
  const [status, setStatus] = useState<TrackerStatus>("idle");
  const [lastPingAt, setLastPingAt] = useState<string | null>(null);
  const [pingCount, setPingCount] = useState(0);
  const [queuedCount, setQueuedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [lastCoords, setLastCoords] = useState<Coords | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const capWatchIdRef = useRef<string | null>(null);
  const lastSentRef = useRef(0);
  const lastFixAtRef = useRef(0);
  const consecutiveErrorsRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tripIdRef = useRef(tripId);
  tripIdRef.current = tripId;

  const refreshQueueCount = useCallback(async () => {
    const id = tripIdRef.current;
    if (!id) {
      setQueuedCount(0);
      return;
    }
    if (typeof navigator === "undefined" || navigator.onLine) {
      await flushLocationOutbox(id).catch(() => null);
    }
    const remaining = await listQueuedPings(id);
    setQueuedCount(remaining.length);
  }, []);

  const sendPing = useCallback(
    async (coords: Coords) => {
      const id = tripIdRef.current;
      if (!id) return;

      const now = Date.now();
      if (now - lastSentRef.current < MIN_SEND_INTERVAL_MS) return;
      lastSentRef.current = now;

      const payload = {
        tripId: id,
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy,
        speed: coords.speed,
        heading: coords.heading,
        capturedAt: new Date().toISOString(),
      };

      try {
        const res = await fetch(`/api/trips/${id}/locations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: payload.lat,
            lng: payload.lng,
            accuracy: payload.accuracy,
            speed: payload.speed,
            heading: payload.heading,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setError(data.error ?? "Location ping failed");
          await enqueueLocationPing(payload);
          setQueuedCount((n) => n + 1);
          return;
        }
        setLastPingAt(new Date().toISOString());
        setPingCount((n) => n + 1);
        setError(null);
        setStatus("tracking");
        void refreshQueueCount();
      } catch {
        await enqueueLocationPing(payload);
        setQueuedCount((n) => n + 1);
        setError("Offline — GPS queued; will sync when network returns");
      }
    },
    [refreshQueueCount],
  );

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void refreshQueueCount();
    };
    const onOffline = () => setOnline(false);
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refreshQueueCount]);

  useEffect(() => {
    if (!enabled || !tripId) {
      setStatus("idle");
      return;
    }

    if (typeof window === "undefined") return;

    let cancelled = false;
    setStatus("tracking");
    setError(null);
    consecutiveErrorsRef.current = 0;
    lastFixAtRef.current = Date.now();
    void refreshQueueCount();

    const clearRetry = () => {
      if (retryTimeoutRef.current != null) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };

    const applyCoords = (coords: Coords) => {
      if (cancelled) return;
      lastFixAtRef.current = Date.now();
      consecutiveErrorsRef.current = 0;
      clearRetry();
      setLastCoords(coords);
      setStatus("tracking");
      void sendPing(coords);
    };

    const flushTimer = window.setInterval(() => {
      if (!cancelled && navigator.onLine) void refreshQueueCount();
    }, FLUSH_INTERVAL_MS);

    // Prefer Capacitor native GPS inside the APK (better background/call behavior).
    void (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) throw new Error("web");
        const { Geolocation } = await import("@capacitor/geolocation");
        const perm = await Geolocation.requestPermissions();
        if (perm.location === "denied") {
          if (!cancelled) {
            setStatus("denied");
            setError("Allow location so the live map can track this bus.");
          }
          return;
        }
        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 15_000 },
          (position, err) => {
            if (cancelled) return;
            if (err || !position) {
              consecutiveErrorsRef.current += 1;
              if (consecutiveErrorsRef.current >= ERROR_STATUS_THRESHOLD) {
                setStatus("error");
                setError("Could not read GPS — retrying…");
              }
              return;
            }
            applyCoords({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy ?? null,
              speed: position.coords.speed ?? null,
              heading: position.coords.heading ?? null,
            });
            setStatus("tracking");
          },
        );
        if (!cancelled) capWatchIdRef.current = id;
      } catch {
        // Browser / PWA path
        if (!("geolocation" in navigator)) {
          if (!cancelled) {
            setStatus("unsupported");
            setError("GPS not supported on this device");
          }
          return;
        }

        const onPos = (pos: GeolocationPosition) => {
          applyCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
            heading: pos.coords.heading,
          });
        };

        const onErr = (err: GeolocationPositionError) => {
          if (cancelled) return;
          if (err.code === err.PERMISSION_DENIED) {
            setStatus("denied");
            setError("Allow location so the live map can track this bus.");
            clearRetry();
            return;
          }
          consecutiveErrorsRef.current += 1;
          if (consecutiveErrorsRef.current >= ERROR_STATUS_THRESHOLD) {
            setStatus("error");
            setError("Could not read GPS — retrying…");
          }
          const attempt = consecutiveErrorsRef.current - 1;
          clearRetry();
          const delay =
            RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)];
          retryTimeoutRef.current = setTimeout(() => {
            if (cancelled) return;
            navigator.geolocation.getCurrentPosition(onPos, onErr, {
              enableHighAccuracy: false,
              maximumAge: 15_000,
              timeout: 10_000,
            });
          }, delay);
        };

        watchIdRef.current = navigator.geolocation.watchPosition(onPos, onErr, {
          enableHighAccuracy: true,
          maximumAge: 2_000,
          timeout: 15_000,
        });

        const watchdog = window.setInterval(() => {
          if (cancelled) return;
          if (Date.now() - lastFixAtRef.current > STALE_FIX_MS) {
            if (watchIdRef.current != null) {
              navigator.geolocation.clearWatch(watchIdRef.current);
            }
            watchIdRef.current = navigator.geolocation.watchPosition(
              onPos,
              onErr,
              { enableHighAccuracy: true, maximumAge: 2_000, timeout: 15_000 },
            );
          }
        }, WATCHDOG_INTERVAL_MS);

        const onVisibilityChange = () => {
          if (document.visibilityState === "visible" && !cancelled) {
            navigator.geolocation.getCurrentPosition(onPos, onErr, {
              enableHighAccuracy: true,
              maximumAge: 5_000,
              timeout: 12_000,
            });
            if (navigator.onLine) void refreshQueueCount();
          }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);

        // Stash cleanup hooks on the effect scope via cancelled flag + refs
        (watchIdRef as { _watchdog?: number })._watchdog = watchdog;
        (watchIdRef as { _vis?: () => void })._vis = onVisibilityChange;
      }
    })();

    return () => {
      cancelled = true;
      clearRetry();
      window.clearInterval(flushTimer);
      const wd = (watchIdRef as { _watchdog?: number })._watchdog;
      if (wd) window.clearInterval(wd);
      const vis = (watchIdRef as { _vis?: () => void })._vis;
      if (vis) document.removeEventListener("visibilitychange", vis);
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      const capId = capWatchIdRef.current;
      if (capId) {
        void import("@capacitor/geolocation").then(({ Geolocation }) => {
          void Geolocation.clearWatch({ id: capId });
        });
        capWatchIdRef.current = null;
      }
    };
  }, [enabled, tripId, sendPing, refreshQueueCount]);

  return {
    status,
    lastPingAt,
    pingCount,
    queuedCount,
    error,
    online,
    lastCoords,
  };
}
