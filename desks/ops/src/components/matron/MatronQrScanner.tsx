"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  ScanResultCard,
  type BoardingScanSuccess,
} from "@/components/matron/ScanResultCard";
import { OfflineToast } from "@/components/matron/OfflineToast";
import { TripLivePanel } from "@/components/matron/TripLivePanel";
import { useGeolocation } from "@/components/matron/useGeolocation";
import { buildFeeCheck } from "@/lib/fees/fee-check";
import {
  loadActiveTrip,
  saveActiveTrip,
  type ActiveTrip,
} from "@/lib/matron/active-trip";
import {
  enqueueBoarding,
  flushBoardingOutbox,
  listQueuedBoardings,
} from "@/lib/matron/boarding-outbox";
import { notifyActiveTripChanged } from "@/components/matron/ActiveTripChip";
import { BoardingHeadcount } from "@/components/matron/BoardingHeadcount";
import {
  loadScannedCodes,
  refreshScannedCodesFromServer,
  rememberScannedCode,
} from "@/lib/matron/scanned-codes";
import type { ParentNotifyResult } from "@/types/messaging";

const SCANNER_ID = "matron-qr-scanner";
const DEDUP_MS = 8_000;

type ScanState =
  | { kind: "idle" }
  | { kind: "loading"; code: string }
  | { kind: "success"; result: BoardingScanSuccess }
  | { kind: "queued"; code: string; hint?: string }
  | { kind: "error"; message: string; code?: string; hint?: string };

function friendlyBoardingError(raw: string): { message: string; hint?: string } {
  const lower = raw.toLowerCase();
  if (
    lower.includes("duplicate") ||
    lower.includes("already boarded") ||
    lower.includes("already scanned")
  ) {
    return {
      message: "Already scanned for this trip",
      hint: "Each child is scanned once per trip. Move to the next student.",
    };
  }
  if (lower.includes("time-out") || lower.includes("alighted")) {
    return {
      message: "Already timed out",
      hint: "This student already alighted on this trip.",
    };
  }
  if (lower.includes("not recognized") || lower.includes("not found")) {
    return {
      message: "QR not recognized",
      hint: "Try again in better light, or type the roster code (e.g. SLV-USR-0001).",
    };
  }
  if (
    lower.includes("not assigned") ||
    lower.includes("not on this bus") ||
    lower.includes("forbidden")
  ) {
    return {
      message: "Wrong bus for this student",
      hint: "This QR belongs to another bus. Switch buses on Home, or check the roster filter.",
    };
  }
  if (lower.includes("cannot time-out")) {
    return {
      message: "No time-in yet",
      hint: "Scan time-in first before time-out.",
    };
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return {
      message: "No connection",
      hint: "Check mobile data / Wi‑Fi, then try again.",
    };
  }
  return { message: raw };
}

export function MatronQrScanner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripIdParam = searchParams.get("tripId");

  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [scanState, setScanState] = useState<ScanState>({ kind: "idle" });
  const [manualCode, setManualCode] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [queuedBoardings, setQueuedBoardings] = useState(0);
  const [endingTrip, setEndingTrip] = useState(false);
  const [endTripError, setEndTripError] = useState<string | null>(null);
  const [schoolGateBusy, setSchoolGateBusy] = useState(false);
  const [schoolGateMsg, setSchoolGateMsg] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [unlistedName, setUnlistedName] = useState("");
  const [unlistedNote, setUnlistedNote] = useState("");
  const [loggingUnlisted, setLoggingUnlisted] = useState(false);
  const [unlistedMsg, setUnlistedMsg] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);
  const boardCodeRef = useRef<(code: string) => Promise<void>>(async () => {});
  const startGenerationRef = useRef(0);
  const { captureNow, position } = useGeolocation({
    requestOnMount: true,
  });

  useEffect(() => {
    const saved = loadActiveTrip();
    if (tripIdParam && saved && saved.tripId === tripIdParam) {
      setActiveTrip(saved);
      return;
    }
    if (tripIdParam) {
      const trip: ActiveTrip = {
        tripId: tripIdParam,
        busId: saved?.busId ?? "",
        busLabel: saved?.busLabel ?? "Trip",
        direction: saved?.direction ?? "am",
        savedAt: new Date().toISOString(),
      };
      saveActiveTrip(trip);
      notifyActiveTripChanged();
      setActiveTrip(trip);
      return;
    }
    if (saved) setActiveTrip(saved);
  }, [tripIdParam]);

  const tripId = activeTrip?.tripId ?? tripIdParam;

  const refreshBoardingQueue = useCallback(async () => {
    if (!tripId) {
      setQueuedBoardings(0);
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine) {
      const outcome = await flushBoardingOutbox(tripId);
      if (outcome.sent > 0) {
        setSyncNotice(
          `Synced ${outcome.sent} queued scan${outcome.sent === 1 ? "" : "s"}.`,
        );
      } else if (outcome.lastError && outcome.remaining > 0) {
        setSyncNotice(outcome.lastError);
      }
    }
    const rows = await listQueuedBoardings(tripId);
    setQueuedBoardings(rows.length);
  }, [tripId]);

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/trips/${tripId}/scanned-codes`, {
          credentials: "include",
        });
        const data = (await res.json()) as { codes?: string[] };
        if (cancelled || !res.ok || !data.codes?.length) return;
        for (const code of data.codes) rememberScannedCode(tripId, code);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  useEffect(() => {
    void refreshBoardingQueue();
    const onOnline = () => void refreshBoardingQueue();
    window.addEventListener("online", onOnline);
    const t = window.setInterval(() => void refreshBoardingQueue(), 12_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(t);
    };
  }, [refreshBoardingQueue]);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setCameraReady(false);
    setTorchSupported(false);
    setTorchOn(false);
    if (!scanner) return;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      // already stopped
    }
  }, []);

  const toggleTorch = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner || !scanner.isScanning) return;
    try {
      const caps = scanner.getRunningTrackCameraCapabilities() as {
        torch?: { apply: (on: boolean) => Promise<void> };
      };
      const torch = caps?.torch;
      if (!torch || typeof torch.apply !== "function") {
        setTorchSupported(false);
        return;
      }
      const next = !torchOn;
      await torch.apply(next);
      setTorchOn(next);
    } catch {
      setCameraError("Torch not available on this camera.");
      setTorchSupported(false);
    }
  }, [torchOn]);

  const boardCode = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;

      if (!tripId) {
        setScanState({
          kind: "error",
          message: "Pick your bus on Home and start Morning or Afternoon.",
          code: trimmed,
        });
        return;
      }

      const now = Date.now();
      const normalized = trimmed.toLowerCase();
      if (
        lastCodeRef.current &&
        lastCodeRef.current.code === normalized &&
        now - lastCodeRef.current.at < DEDUP_MS
      ) {
        return;
      }

      if (tripId && loadScannedCodes(tripId).has(normalized)) {
        setScanState({
          kind: "error",
          message: "Already scanned for this trip",
          hint: "This student already has a time-in. Do not scan them again.",
          code: trimmed,
        });
        return;
      }

      if (busyRef.current) return;
      busyRef.current = true;
      lastCodeRef.current = { code: normalized, at: now };
      setScanState({ kind: "loading", code: trimmed });
      const scannedAt = new Date().toISOString();

      try {
        void captureNow();
        const lat = position?.lat ?? null;
        const lng = position?.lng ?? null;

        if (typeof navigator !== "undefined" && !navigator.onLine) {
          const queued = await enqueueBoarding({
            tripId,
            code: trimmed,
            lat,
            lng,
            queuedAt: scannedAt,
          });
          if (!queued.ok) {
            throw new Error(queued.error);
          }
          setQueuedBoardings((n) => n + 1);
          setManualCode("");
          rememberScannedCode(tripId, trimmed);
          await stopScanner();
          setScanState({
            kind: "queued",
            code: trimmed,
            hint: "Will upload automatically when you are back online.",
          });
          return;
        }

        const response = await fetch("/api/boarding", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tripId,
            code: trimmed,
            lat,
            lng,
            scannedAt,
          }),
        });

        const payload = (await response.json()) as
          | BoardingScanSuccess
          | { error?: string; code?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "Boarding failed",
          );
        }

        const success = payload as BoardingScanSuccess;
        if (!success.parent_notify) {
          success.parent_notify = {
            notified: false,
            status: "skipped",
            channel: "stub",
            provider: "none",
            message_log_id: null,
            error: "No parent_notify in response",
          } satisfies ParentNotifyResult;
        }
        if (!success.fee) {
          success.fee = { balance: 0, currency: "TZS", synced_at: null };
        } else if (success.fee.synced_at === undefined) {
          success.fee = { ...success.fee, synced_at: null };
        }
        if (!success.fee_check) {
          success.fee_check = buildFeeCheck(success.fee);
        }

        setManualCode("");
        rememberScannedCode(tripId, trimmed);
        setScanState({ kind: "success", result: success });
        await stopScanner();
        void refreshBoardingQueue();
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("matron-boarding", {
              detail: {
                tripId,
                stopId: success.stop?.id ?? null,
                scannedAt: success.event.scanned_at,
              },
            }),
          );
        }
      } catch (error) {
        const raw =
          error instanceof Error ? error.message : "Could not board student";
        // Network blip while "online" — queue like offline.
        if (/failed to fetch|network/i.test(raw) && tripId) {
          const geo = position;
          const queued = await enqueueBoarding({
            tripId,
            code: trimmed,
            lat: geo?.lat ?? null,
            lng: geo?.lng ?? null,
            queuedAt: scannedAt,
          });
          if (!queued.ok) {
            throw new Error(queued.error);
          }
          setQueuedBoardings((n) => n + 1);
          rememberScannedCode(tripId, trimmed);
          await stopScanner();
          setScanState({
            kind: "queued",
            code: trimmed,
            hint: "Network dropped — queued on this phone; syncing when back online.",
          });
          return;
        }
        if (/duplicate|already/i.test(raw) && tripId) {
          rememberScannedCode(tripId, trimmed);
        }
        const friendly = friendlyBoardingError(raw);
        setScanState({
          kind: "error",
          message: friendly.message,
          hint: friendly.hint,
          code: trimmed,
        });
      } finally {
        busyRef.current = false;
      }
    },
    [tripId, captureNow, position, stopScanner, refreshBoardingQueue],
  );

  boardCodeRef.current = boardCode;

  const startScanner = useCallback(async () => {
    if (!tripId) return;
    if (scannerRef.current?.isScanning) return;

    const gen = ++startGenerationRef.current;
    try {
      const scanner = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = scanner;

      const boxSize =
        typeof window !== "undefined"
          ? Math.min(280, Math.floor(window.innerWidth * 0.62))
          : 240;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 8,
          qrbox: { width: boxSize, height: boxSize },
          aspectRatio: 1,
          disableFlip: true,
        },
        (decoded) => {
          void (async () => {
            try {
              if (scanner.isScanning) {
                await scanner.pause(true);
              }
            } catch {
              try {
                if (scanner.isScanning) await scanner.stop();
              } catch {
                // already stopped
              }
            }
            void boardCodeRef.current(decoded);
          })();
        },
        () => {},
      );
      if (gen !== startGenerationRef.current) {
        await stopScanner();
        return;
      }
      setCameraError(null);
      setCameraReady(true);

      try {
        const caps = scanner.getRunningTrackCameraCapabilities() as {
          torch?: { apply: (on: boolean) => Promise<void> };
        };
        const torch = caps?.torch;
        setTorchSupported(Boolean(torch && typeof torch.apply === "function"));
      } catch {
        setTorchSupported(false);
      }
    } catch (err) {
      setCameraReady(false);
      try {
        scannerRef.current?.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
      const msg = err instanceof Error ? err.message : "";
      if (/NotAllowedError|Permission/i.test(msg)) {
        setCameraError(
          "Camera blocked. Tap Allow camera, or turn it on in browser settings.",
        );
      } else if (/NotFoundError|DevicesNotFound/i.test(msg)) {
        setCameraError(
          "No camera found on this device. Use manual code entry below.",
        );
      } else {
        setCameraError(
          "Camera unavailable. Tap Allow camera, or enter the code manually.",
        );
      }
    }
  }, [tripId, stopScanner]);

  useEffect(() => {
    if (scanState.kind === "idle" && tripId) {
      void startScanner();
    } else {
      void stopScanner();
    }

    return () => {
      startGenerationRef.current += 1;
      void stopScanner();
    };
  }, [scanState.kind, startScanner, stopScanner, tripId]);

  function handleScanAgain() {
    lastCodeRef.current = null;
    busyRef.current = false;
    setScanState({ kind: "idle" });
  }

  function handleManualSubmit(event: React.FormEvent) {
    event.preventDefault();
    void boardCode(manualCode);
  }

  async function handleUnlistedSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!tripId || !unlistedName.trim() || loggingUnlisted) return;
    setLoggingUnlisted(true);
    setUnlistedMsg(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/unlisted-child`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: unlistedName, notes: unlistedNote }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not log this child");
      }
      setUnlistedMsg(`Logged ${unlistedName.trim()} for the transport office to add.`);
      setUnlistedName("");
      setUnlistedNote("");
    } catch (error) {
      setUnlistedMsg(error instanceof Error ? error.message : "Could not log this child");
    } finally {
      setLoggingUnlisted(false);
    }
  }

  async function markSchoolGate() {
    if (!tripId || schoolGateBusy) return;
    setSchoolGateBusy(true);
    setSchoolGateMsg(null);
    try {
      const path =
        activeTrip?.direction === "pm"
          ? `/api/trips/${tripId}/depart`
          : `/api/trips/${tripId}/arrive`;
      const body =
        activeTrip?.direction === "pm"
          ? { lat: position?.lat ?? null, lng: position?.lng ?? null }
          : { arrivedAt: new Date().toISOString() };
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Could not log school gate");
      }
      setSchoolGateMsg(
        activeTrip?.direction === "pm"
          ? `Left school · ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Africa/Dar_es_Salaam" })}`
          : `School arrival · ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Africa/Dar_es_Salaam" })}`,
      );
    } catch (error) {
      setSchoolGateMsg(
        error instanceof Error ? error.message : "Could not log school gate",
      );
    } finally {
      setSchoolGateBusy(false);
    }
  }

  async function handleEndTrip() {
    if (!tripId || endingTrip) return;
    setEndingTrip(true);
    setEndTripError(null);
    try {
      await flushBoardingOutbox(tripId);
      const geo = (await captureNow()) ?? position;
      const endedAt = new Date().toISOString();
      const res = await fetch(`/api/trips/${tripId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: geo?.lat ?? null,
          lng: geo?.lng ?? null,
          endedAt,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        code?: string;
        missingStudents?: { id: string; name: string }[];
      };
      if (!res.ok) {
        if (data.code === "incomplete_roster") {
          const names = (data.missingStudents ?? []).map((s) => s.name).join(", ");
          const reason = window.prompt(
            `Not scanned: ${names}\n\nWhy weren't they scanned? (this goes to the transport office)`,
          );
          if (reason?.trim()) {
            const retry = await fetch(`/api/trips/${tripId}/complete`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                lat: geo?.lat ?? null,
                lng: geo?.lng ?? null,
                endedAt,
                incompleteRosterReason: reason.trim(),
              }),
            });
            if (!retry.ok) {
              const retryData = (await retry.json().catch(() => ({}))) as {
                error?: string;
              };
              throw new Error(retryData.error ?? "Could not end trip");
            }
            await stopScanner();
            router.push("/matron");
            return;
          }
        }
        throw new Error(data.error ?? "Could not end trip");
      }
      await stopScanner();
      router.push("/matron");
    } catch (error) {
      setEndTripError(
        error instanceof Error ? error.message : "Could not end trip",
      );
    } finally {
      setEndingTrip(false);
    }
  }

  return (
    <main className="matron-page">
      <OfflineToast
        offlineMessage={
          queuedBoardings > 0
            ? `Offline — ${queuedBoardings} scan${queuedBoardings === 1 ? "" : "s"} queued; will sync when you’re back.`
            : "You’re offline — new scans are queued on this phone until you reconnect."
        }
        onlineMessage={
          syncNotice ??
          (queuedBoardings > 0
            ? `Back online — syncing ${queuedBoardings} queued scan${queuedBoardings === 1 ? "" : "s"}…`
            : "Back online")
        }
      />

      {syncNotice && !queuedBoardings ? (
        <p className="mb-3 text-sm font-semibold text-success" role="status">
          {syncNotice}
        </p>
      ) : null}

      <header className="mb-4">
        <p className="matron-kicker">Scan</p>
        <h1 className="matron-title mt-1">Student QR</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {tripId
            ? `${activeTrip?.busLabel ?? "Bus"}${
                activeTrip?.direction
                  ? ` · ${activeTrip.direction.toUpperCase()}`
                  : ""
              } — hold the code inside the frame.${
                queuedBoardings ? ` ${queuedBoardings} queued.` : ""
              }`
            : "Choose a bus on Home first, then open the scanner."}
        </p>
      </header>

      {!tripId ? (
        <div className="matron-surface p-5">
          <p className="text-sm font-semibold text-ink">No bus ready to scan</p>
          <p className="mt-1 text-sm text-ink-muted">
            Go to Home, select your bus, and start Morning or Afternoon.
          </p>
          <Link href="/matron" className="matron-btn-primary mt-4">
            Back to Home
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-start">
          <div className="space-y-3">
            {scanState.kind === "success" ? (
              <ScanResultCard
                result={scanState.result}
                onScanAgain={handleScanAgain}
              />
            ) : scanState.kind === "queued" ? (
              <div className="matron-surface border-success/30 bg-success-15 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-success">
                  Saved on this phone
                </p>
                <p className="mt-2 text-lg font-bold text-ink">
                  Scan queued offline
                </p>
                <p className="mt-1 font-mono text-sm text-ink-muted">
                  {scanState.code}
                </p>
                {scanState.hint ? (
                  <p className="mt-2 text-sm text-ink-muted">{scanState.hint}</p>
                ) : null}
                <button
                  type="button"
                  onClick={handleScanAgain}
                  className="matron-btn-primary mt-4"
                >
                  Scan next student
                </button>
              </div>
            ) : (
              <>
                <section className="relative overflow-hidden rounded-2xl bg-[#0b1a33] shadow-[var(--shadow)]">
                  <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 px-3 py-2.5">
                    <span className="rounded-md bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white">
                      {cameraReady ? "Camera live" : "Starting…"}
                    </span>
                    {torchSupported ? (
                      <button
                        type="button"
                        onClick={() => void toggleTorch()}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                          torchOn
                            ? "bg-gold text-electric-blue"
                            : "bg-black/50 text-white"
                        }`}
                      >
                        {torchOn ? "Torch on" : "Torch"}
                      </button>
                    ) : null}
                  </div>

                  <div className="relative aspect-square w-full max-h-[min(70vh,32rem)] bg-black sm:aspect-[4/3] sm:max-h-[26rem]">
                    <div
                      id={SCANNER_ID}
                      className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover [&_video~video]:hidden [&_img]:hidden [&_input]:hidden [&_button]:hidden [&_select]:hidden"
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    >
                      <div className="relative h-[56%] w-[56%] max-w-[17rem]">
                        <span className="absolute left-0 top-0 h-7 w-7 rounded-tl-lg border-l-[3px] border-t-[3px] border-white/90" />
                        <span className="absolute right-0 top-0 h-7 w-7 rounded-tr-lg border-r-[3px] border-t-[3px] border-white/90" />
                        <span className="absolute bottom-0 left-0 h-7 w-7 rounded-bl-lg border-b-[3px] border-l-[3px] border-white/90" />
                        <span className="absolute bottom-0 right-0 h-7 w-7 rounded-br-lg border-b-[3px] border-r-[3px] border-white/90" />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/10 px-4 py-2.5 text-center text-xs text-white/70">
                    Records boarding time, fee check, and parent notify
                  </div>
                </section>

                {cameraError ? (
                  <div className="matron-surface border-gold/40 bg-gold-15 p-4">
                    <p className="text-sm font-semibold text-ink">{cameraError}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setCameraError(null);
                        void startScanner();
                      }}
                      className="matron-btn-primary mt-3"
                    >
                      Allow camera
                    </button>
                  </div>
                ) : null}

                {scanState.kind === "loading" ? (
                  <p className="matron-surface px-4 py-3 text-center text-sm font-semibold text-electric-blue">
                    Boarding{" "}
                    <span className="font-mono">{scanState.code}</span>…
                  </p>
                ) : null}

                {scanState.kind === "error" ? (
                  <div className="matron-surface border-danger/25 bg-danger-15 p-4">
                    <p className="text-sm font-semibold text-danger">
                      {scanState.message}
                    </p>
                    {scanState.hint ? (
                      <p className="mt-1 text-sm text-ink-muted">
                        {scanState.hint}
                      </p>
                    ) : null}
                    {scanState.code ? (
                      <p className="mt-1 font-mono text-xs text-ink-muted">
                        {scanState.code}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleScanAgain}
                      className="mt-3 text-sm font-semibold text-electric-blue"
                    >
                      Try again
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="space-y-3">
            <BoardingHeadcount tripId={tripId} />
            <TripLivePanel
              tripId={tripId}
              direction={activeTrip?.direction}
            />

            <div className="matron-surface border-gold/30 p-4">
              <p className="text-sm font-semibold text-ink">
                {activeTrip?.direction === "pm"
                  ? "Left school"
                  : "Bus entered school"}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {activeTrip?.direction === "pm"
                  ? "Stamp when you leave the gate, then drop off last-morning-pickup first."
                  : "After the last pickup, stamp the school-gate time (Excel Bus Arrival Time)."}
              </p>
              {schoolGateMsg ? (
                <p className="mt-2 text-sm font-semibold text-success">
                  {schoolGateMsg}
                </p>
              ) : null}
              <button
                type="button"
                disabled={schoolGateBusy}
                onClick={() => void markSchoolGate()}
                className="matron-btn-secondary mt-3 w-full disabled:opacity-50"
              >
                {schoolGateBusy
                  ? "Saving…"
                  : activeTrip?.direction === "pm"
                    ? "Log left school"
                    : "Log school arrival"}
              </button>
            </div>

            <div className="matron-surface border-electric-blue/20 p-4">
              <p className="text-sm font-semibold text-ink">Finish trip</p>
              <p className="mt-1 text-xs text-ink-muted">
                Syncs any queued scans with their original timestamps, then
                closes the trip.
              </p>
              {endTripError ? (
                <p className="mt-2 text-sm text-danger" role="alert">
                  {endTripError}
                </p>
              ) : null}
              <button
                type="button"
                disabled={endingTrip}
                onClick={() => void handleEndTrip()}
                className="matron-btn-primary mt-3 w-full disabled:opacity-50"
              >
                {endingTrip ? "Syncing & ending…" : "End trip & sync scans"}
              </button>
            </div>

            <form
              onSubmit={handleManualSubmit}
              className="matron-surface p-4"
            >
              <p className="text-sm font-semibold text-ink">Type code instead</p>
              <p className="mt-1 text-xs text-ink-muted">
                Use when the camera cannot read the QR.
              </p>
              <label className="mt-4 block text-sm font-semibold text-ink">
                Student code
                <input
                  type="text"
                  value={manualCode}
                  onChange={(event) => setManualCode(event.target.value)}
                  placeholder="e.g. SLV-USR-0001"
                  className="mt-2 w-full rounded-[var(--radius-sm)] border border-card-border bg-white/80 px-3 py-3 text-base outline-none transition focus:border-light-blue"
                />
              </label>
              <button
                type="submit"
                disabled={!manualCode.trim() || scanState.kind === "loading"}
                className="matron-btn-primary mt-3 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Board student
              </button>
            </form>

            <form onSubmit={handleUnlistedSubmit} className="matron-surface p-4">
              <p className="text-sm font-semibold text-ink">Child not in the system?</p>
              <p className="mt-1 text-xs text-ink-muted">
                New student, or not on the master sheet yet -- log their name so the
                transport office can add them. This doesn&apos;t count as a scan.
              </p>
              <label className="mt-4 block text-sm font-semibold text-ink">
                Child&apos;s name
                <input
                  type="text"
                  value={unlistedName}
                  onChange={(event) => setUnlistedName(event.target.value)}
                  placeholder="e.g. Amina Juma"
                  className="mt-2 w-full rounded-[var(--radius-sm)] border border-card-border bg-white/80 px-3 py-3 text-base outline-none transition focus:border-light-blue"
                />
              </label>
              <label className="mt-3 block text-sm font-semibold text-ink">
                Note (optional)
                <input
                  type="text"
                  value={unlistedNote}
                  onChange={(event) => setUnlistedNote(event.target.value)}
                  placeholder="e.g. new student, or picked from another campus"
                  className="mt-2 w-full rounded-[var(--radius-sm)] border border-card-border bg-white/80 px-3 py-3 text-base outline-none transition focus:border-light-blue"
                />
              </label>
              {unlistedMsg ? (
                <p className="mt-2 text-sm text-ink-muted" role="status">
                  {unlistedMsg}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={!unlistedName.trim() || loggingUnlisted}
                className="matron-btn-secondary mt-3 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loggingUnlisted ? "Logging…" : "Log child"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
