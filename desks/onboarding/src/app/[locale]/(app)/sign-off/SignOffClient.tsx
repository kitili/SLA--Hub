"use client";

/**
 * SignOffClient — thin client island that owns the "eligible → signed"
 * state transition.
 *
 * The parent RSC renders this when the user is eligible but has not yet signed.
 * Once the form is submitted successfully, this component swaps to the
 * celebratory completion view (no full-page navigation required).
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import AcknowledgementForm from "@/components/signoff/AcknowledgementForm";

interface Props {
  locale: string;
}

export default function SignOffClient({ locale }: Props) {
  const t = useTranslations("signoff");
  const router = useRouter();
  const [signedAt, setSignedAt] = useState<Date | null>(null);

  if (signedAt) {
    const signedDate = signedAt.toLocaleDateString(
      locale === "sw" ? "sw-TZ" : "en-GB",
      { day: "numeric", month: "long", year: "numeric" },
    );

    return (
      <div
        style={{
          textAlign: "center",
          padding: "40px 32px",
          border: "1px solid #d1e7dd",
          borderRadius: 12,
          background: "#f0fff4",
          maxWidth: 640,
          margin: "0 auto",
        }}
      >
        <span style={{ fontSize: 48, display: "block", marginBottom: 16 }}>
          🎉
        </span>
        <h2 style={{ color: "#198754", marginBottom: 8 }}>
          {t("completionTitle")}
        </h2>
        <p style={{ color: "#6c757d", marginBottom: 8 }}>
          {t("completionBody")}
        </p>
        <p style={{ fontWeight: 600, marginBottom: 32 }}>
          {t("completionSignedOn", { date: signedDate })}
        </p>
        <button
          onClick={() => router.push("/")}
          style={{
            padding: "10px 24px",
            minHeight: 44, // touch-friendly CTA on mobile
            background: "#198754",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {t("backToDashboardAfterSign")}
        </button>
      </div>
    );
  }

  return (
    <AcknowledgementForm
      onSuccess={(date) => {
        setSignedAt(date);
        // Also revalidate so a hard-refresh shows the confirmed state from RSC.
        router.refresh();
      }}
    />
  );
}
