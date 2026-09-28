"use client";

import { useState } from "react";
import { StudentQrDisplay } from "@/components/matron/StudentQrDisplay";

type GenerateResponse = {
  code?: string;
  parent?: { id: string; full_name: string };
  error?: string;
};

export function GuardianQrSection({
  studentId,
  hasParent,
}: {
  studentId: string;
  hasParent: boolean;
}) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ready"; code: string; parentName: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function generate(regenerate: boolean) {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/qr/guardian/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, regenerate }),
      });
      const data = (await res.json()) as GenerateResponse;
      if (!res.ok || !data.code || !data.parent) {
        setState({
          kind: "error",
          message: data.error ?? "Could not generate guardian QR",
        });
        return;
      }
      setState({ kind: "ready", code: data.code, parentName: data.parent.full_name });
    } catch {
      setState({ kind: "error", message: "Network error" });
    }
  }

  if (!hasParent) {
    return (
      <p className="mt-3 text-sm text-ink-muted">
        Add parent contact info above first, then a guardian QR can be
        generated here.
      </p>
    );
  }

  return (
    <div className="mt-3">
      {state.kind === "ready" ? (
        <div className="flex flex-col items-center gap-3">
          <StudentQrDisplay
            code={state.code}
            studentName={`${state.parentName} · guardian`}
            size="lg"
          />
          <button
            type="button"
            onClick={() => void generate(true)}
            className="text-xs font-semibold text-ink-muted hover:text-electric-blue"
          >
            Regenerate (invalidates the old code)
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={state.kind === "loading"}
          onClick={() => void generate(false)}
          className="rounded-[var(--radius-sm)] bg-gradient-to-br from-navy-light to-electric-blue px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(0,35,104,0.2)] transition hover:brightness-105 disabled:opacity-60"
        >
          {state.kind === "loading" ? "Generating…" : "Generate parent QR"}
        </button>
      )}
      {state.kind === "error" ? (
        <p className="mt-2 text-sm text-danger">{state.message}</p>
      ) : null}
      <p className="mt-2 text-xs text-ink-faint">
        Scanned at evening drop-off to confirm the right guardian is picking
        up this child.
      </p>
    </div>
  );
}
