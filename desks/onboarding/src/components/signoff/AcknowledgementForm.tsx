"use client";

/**
 * AcknowledgementForm — interactive client component for the sign-off page.
 *
 * Renders:
 *   - A clearly-marked PLACEHOLDER acknowledgement text block (bilingual)
 *   - A visible draft warning banner
 *   - An explicit checkbox the member must tick
 *   - An "I Acknowledge" submit button
 *
 * On submit it calls the `submitSignoffAction` server action and, on success,
 * calls `onSuccess` so the parent page can switch to the completion view.
 */

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { submitSignoffAction } from "@/lib/actions/signoff";

interface Props {
  onSuccess: (signedAt: Date) => void;
}

export default function AcknowledgementForm({ onSuccess }: Props) {
  const t = useTranslations("signoff");
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const acknowledgedText = [
    "[EN] " + t("acknowledgementTextEN"),
    "[SW] " + t("acknowledgementTextSW"),
  ].join("\n\n");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checked) return;
    setError(null);

    startTransition(async () => {
      const result = await submitSignoffAction(acknowledgedText);
      if (result.ok && result.signoff) {
        onSuccess(new Date(result.signoff.signedAt));
      } else {
        if (result.error === "not-eligible") {
          setError(t("errorNotEligible"));
        } else if (result.error === "no-content-version") {
          setError(t("errorNoContentVersion"));
        } else {
          setError(t("errorGeneric"));
        }
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* ── Acknowledgement text block ───────────────────────────────── */}
      <section
        aria-labelledby="ack-heading"
        style={{
          border: "1px solid #dee2e6",
          borderRadius: 8,
          padding: "20px 24px",
          marginBottom: 24,
          background: "#f8f9fa",
        }}
      >
        <h2 id="ack-heading" style={{ marginTop: 0, fontSize: "1.1rem" }}>
          {t("acknowledgementTitle")}
        </h2>

        <div style={{ marginBottom: 16 }}>
          <strong>English</strong>
          <p style={{ lineHeight: 1.7, marginTop: 8 }}>
            {t("acknowledgementTextEN")}
          </p>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid #dee2e6", margin: "16px 0" }} />

        <div>
          <strong>Kiswahili</strong>
          <p style={{ lineHeight: 1.7, marginTop: 8 }}>
            {t("acknowledgementTextSW")}
          </p>
        </div>
      </section>

      {/* ── Checkbox ─────────────────────────────────────────────────── */}
      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          cursor: "pointer",
          marginBottom: 24,
          lineHeight: 1.5,
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          disabled={isPending}
          style={{ marginTop: 3, flexShrink: 0, width: 20, height: 20 }}
          aria-required="true"
        />
        <span>{t("checkboxLabel")}</span>
      </label>

      {/* ── Error ────────────────────────────────────────────────────── */}
      {error && (
        <p role="alert" style={{ color: "#dc3545", marginBottom: 16 }}>
          {error}
        </p>
      )}

      {/* ── Submit ───────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={!checked || isPending}
        style={{
          padding: "12px 32px",
          minHeight: 44, // touch-friendly submit on mobile
          background: checked && !isPending ? "#198754" : "#6c757d",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          fontSize: "1rem",
          fontWeight: 600,
          cursor: checked && !isPending ? "pointer" : "not-allowed",
          transition: "background 0.15s",
        }}
      >
        {isPending ? t("submitting") : t("submitButton")}
      </button>
    </form>
  );
}
