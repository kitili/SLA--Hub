"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import type { FeeCheck } from "@/lib/fees/fee-check";
import type { ParentNotifyResult } from "@/types/messaging";

export type BoardingScanSuccess = {
  student: {
    id: string;
    first_name: string;
    last_name: string;
    class_name: string | null;
    school_name: string | null;
  };
  fee: {
    balance: number;
    currency: string;
    synced_at: string | null;
  };
  fee_check: FeeCheck;
  event: {
    id: string;
    event_type: "in" | "out";
    scanned_at: string;
    lat: number | null;
    lng: number | null;
  };
  stop?: { id: string; name: string; distance_m: number } | null;
  aboard_count: number;
  parent_notify: ParentNotifyResult;
};

type GuardianVerifyResponse =
  | { matched: true; parent_name: string }
  | { matched: false; parent_name: string; reason: string }
  | { error: string };

function GuardianVerifySection({ boardingEventId }: { boardingEventId: string }) {
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const scannerElId = `guardian-scanner-${boardingEventId}`;

  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "matched"; parentName: string }
    | { kind: "mismatch"; parentName: string; reason: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const verify = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || busyRef.current) return;
    busyRef.current = true;
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/boarding/verify-guardian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardingEventId, code: trimmed }),
      });
      const data = (await res.json()) as GuardianVerifyResponse;
      if (!res.ok || "error" in data) {
        setState({
          kind: "error",
          message: "error" in data ? data.error : "Verification failed",
        });
        return;
      }
      setState(
        data.matched
          ? { kind: "matched", parentName: data.parent_name }
          : { kind: "mismatch", parentName: data.parent_name, reason: data.reason },
      );
    } catch {
      setState({ kind: "error", message: "Network error" });
    } finally {
      busyRef.current = false;
    }
  }, [boardingEventId]);

  const stopScanning = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
      scanner.clear();
    } catch {
      // already stopped
    }
  }, []);

  useEffect(() => {
    if (!scanning) return;
    const scanner = new Html5Qrcode(scannerElId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 12, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
        (decoded) => {
          void verify(decoded);
          void stopScanning();
        },
        () => {},
      )
      .then(() => setCameraError(null))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "";
        setCameraError(
          /NotAllowedError|Permission/i.test(msg)
            ? "Camera permission denied. Allow camera access, or type the code below."
            : "Camera unavailable. Type the code below instead.",
        );
        setScanning(false);
      });

    return () => {
      void stopScanning();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, scannerElId]);

  if (state.kind === "matched") {
    return (
      <div className="rounded-[var(--radius-sm)] border border-success/30 bg-success-15 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-success">
          Guardian verified
        </p>
        <p className="mt-1 text-base font-bold text-success">
          {state.parentName} — safe hand-off ✓
        </p>
      </div>
    );
  }

  if (state.kind === "mismatch") {
    return (
      <div className="rounded-[var(--radius-sm)] border border-danger/40 bg-danger-15 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-danger">
          Guardian mismatch
        </p>
        <p className="mt-1 text-base font-bold text-danger">
          {state.parentName} — {state.reason}
        </p>
        <p className="mt-1 text-xs text-ink">
          Do not release the child to this person. Contact the office.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-sm)] border border-gold/40 bg-gold-15 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink">
        Verify pickup guardian
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        Scan the parent&apos;s QR code to confirm they&apos;re authorized for
        this child before hand-off.
      </p>

      {scanning ? (
        <div className="mt-3">
          <div className="relative mx-auto aspect-square w-full max-w-[16rem] overflow-hidden rounded-[var(--radius-sm)] bg-black">
            <div
              id={scannerElId}
              className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover [&_img]:h-full [&_img]:w-full [&_img]:object-cover"
            />
          </div>
          <button
            type="button"
            onClick={() => void stopScanning()}
            className="mt-2 w-full rounded-[var(--radius-sm)] border border-card-border bg-white px-3 py-2 text-sm font-semibold text-ink"
          >
            Cancel scan
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setScanning(true)}
          disabled={state.kind === "loading"}
          className="mt-2 w-full rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {state.kind === "loading" ? "Verifying…" : "Scan guardian QR"}
        </button>
      )}

      {cameraError ? (
        <p className="mt-2 text-xs text-danger">{cameraError}</p>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verify(code);
        }}
        className="mt-2 flex gap-2"
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Or type the guardian code"
          className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-card-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-electric-blue"
        />
        <button
          type="submit"
          disabled={!code.trim() || state.kind === "loading"}
          className="shrink-0 rounded-[var(--radius-sm)] border border-card-border bg-white px-3 py-2 text-sm font-bold text-electric-blue disabled:opacity-50"
        >
          Verify
        </button>
      </form>

      {state.kind === "error" ? (
        <p className="mt-2 text-sm text-danger">{state.message}</p>
      ) : null}
    </div>
  );
}

type Props = {
  result: BoardingScanSuccess;
  onScanAgain: () => void;
};

function formatFee(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString()}`;
}

function FinanceCheckBanner({ check }: { check: FeeCheck }) {
  const styles =
    check.status === "ok"
      ? "border-success/30 bg-success-15"
      : check.status === "stale"
        ? "border-gold/40 bg-gold-15"
        : "border-danger/30 bg-danger-15";

  const labelColor =
    check.status === "ok"
      ? "text-success"
      : check.status === "stale"
        ? "text-ink"
        : "text-danger";

  return (
    <div className={`rounded-[var(--radius-sm)] border px-4 py-3 ${styles}`}>
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${labelColor}`}
      >
        Finance check
      </p>
      <p className={`mt-1 text-sm font-semibold ${labelColor}`}>{check.note}</p>
    </div>
  );
}

function ParentNotifyBanner({ notify }: { notify: ParentNotifyResult }) {
  if (notify.status === "skipped") {
    return (
      <div className="rounded-[var(--radius-sm)] border border-card-border bg-light-blue-30/60 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Parent notify
        </p>
        <p className="mt-1 text-sm font-semibold text-ink-muted">
          Skipped
          {notify.error ? ` — ${notify.error}` : ""}
        </p>
      </div>
    );
  }

  if (notify.notified && notify.status === "sent") {
    return (
      <div className="rounded-[var(--radius-sm)] border border-success/30 bg-success-15 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-success">
          Parent notify
        </p>
        <p className="mt-1 text-base font-bold text-success">
          Parent notified ✓
        </p>
        {notify.provider === "stub" || notify.error ? (
          <p className="mt-1 text-xs text-ink-muted">
            {notify.error ?? "Logged via stub (no live SMS keys)"}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger-15 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-danger">
        Parent notify
      </p>
      <p className="mt-1 text-base font-bold text-danger">
        Parent notified failed
      </p>
      {notify.error ? (
        <p className="mt-1 text-xs text-ink-muted">{notify.error}</p>
      ) : null}
    </div>
  );
}

export function ScanResultCard({ result, onScanAgain }: Props) {
  const { student, fee, fee_check, event, stop, aboard_count, parent_notify } =
    result;
  const fullName = `${student.first_name} ${student.last_name}`;
  const owes = fee.balance > 0;
  const scanClock = new Date(event.scanned_at).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Africa/Dar_es_Salaam",
  });

  return (
    <section className="matron-surface overflow-hidden">
      <div className="border-b border-card-border bg-success-15 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-success">
          {event.event_type === "in" ? "Boarded" : "Alighted"}
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-electric-blue">
          {fullName}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {[student.class_name, student.school_name].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-2 text-sm font-semibold text-ink">
          {scanClock}
          {stop?.name ? ` · ${stop.name}` : ""}
        </p>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        <div
          className={`rounded-xl border px-4 py-3 ${
            owes
              ? "border-danger/25 bg-danger-15"
              : "border-success/25 bg-success-15"
          }`}
        >
          <p className="text-xs font-semibold text-ink-muted">Fee balance</p>
          <p
            className={`mt-0.5 text-xl font-bold ${
              owes ? "text-danger" : "text-success"
            }`}
          >
            {formatFee(fee.balance, fee.currency)}
          </p>
        </div>

        <FinanceCheckBanner check={fee_check} />
        <ParentNotifyBanner notify={parent_notify} />

        {event.event_type === "out" ? (
          <GuardianVerifySection boardingEventId={event.id} />
        ) : null}

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-md bg-light-blue-30 px-2.5 py-1 font-semibold text-electric-blue">
            On board: {aboard_count}
          </span>
          {event.lat != null && event.lng != null ? (
            <span className="rounded-md bg-[var(--app-bg)] px-2.5 py-1 font-mono text-ink-muted">
              GPS ok
            </span>
          ) : (
            <span className="rounded-md bg-gold-15 px-2.5 py-1 font-semibold text-ink">
              No GPS
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onScanAgain}
          className="matron-btn-primary"
        >
          Scan next student
        </button>
      </div>
    </section>
  );
}
