import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { signoffStatus } from "@/lib/actions/signoff";

export const metadata: Metadata = {
  title: "Sign Off — Silverleaf Onboarding Hub",
  description: "Acknowledge completion of your Silverleaf Academy onboarding programme.",
};
import { Link } from "@/i18n/navigation";
import SignOffClient from "./SignOffClient";

/**
 * Sign-off page — the final step of the Silverleaf onboarding programme.
 *
 * States:
 *   1. Not authenticated → redirect to home (sign-in overlay)
 *   2. Not eligible (sections incomplete) → friendly gate with progress info
 *   3. Already signed → completion/confirmation view
 *   4. Eligible, not yet signed → acknowledgement form
 *
 * Dynamic: reads session + per-member DB state on every request.
 */
export const dynamic = "force-dynamic";

export default async function SignOffPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // ── Auth gate ─────────────────────────────────────────────────────────────
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}`);
  }

  const t = await getTranslations("signoff");

  // ── Resolve current status (resolves the member from the session) ─────────
  const status = await signoffStatus();

  // ── Not eligible ──────────────────────────────────────────────────────────
  if (status.status === "not-eligible") {
    const passed = status.passedSections ?? 0;
    const total = status.totalSections ?? 0;

    return (
      <main style={{ maxWidth: 640, margin: "48px auto", padding: "0 24px" }}>
        <h1 style={{ marginBottom: 8 }}>{t("notEligibleTitle")}</h1>
        <p style={{ color: "#6c757d", marginBottom: 16 }}>
          {t("notEligibleBody")}
        </p>
        <p style={{ marginBottom: 24 }}>
          <strong>{t("progressNote", { passed, total })}</strong>
        </p>

        {/* Progress bar */}
        <div
          role="progressbar"
          aria-valuenow={total > 0 ? Math.round((passed / total) * 100) : 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("progressNote", { passed, total })}
          style={{
            background: "#e9ecef",
            borderRadius: 4,
            height: 12,
            marginBottom: 32,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: total > 0 ? `${Math.round((passed / total) * 100)}%` : "0%",
              height: "100%",
              background: "#0d6efd",
              transition: "width 0.3s",
            }}
          />
        </div>

        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 44,
            boxSizing: "border-box",
            padding: "10px 24px",
            background: "#0d6efd",
            color: "#fff",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          {t("backToDashboard")}
        </Link>
      </main>
    );
  }

  // ── Already signed ────────────────────────────────────────────────────────
  if (status.status === "signed" && status.signoff) {
    const signedDate = new Date(status.signoff.signedAt).toLocaleDateString(
      locale === "sw" ? "sw-TZ" : "en-GB",
      { day: "numeric", month: "long", year: "numeric" },
    );

    return (
      <main style={{ maxWidth: 640, margin: "48px auto", padding: "0 24px" }}>
        <div
          style={{
            textAlign: "center",
            padding: "40px 32px",
            border: "1px solid #d1e7dd",
            borderRadius: 12,
            background: "#f0fff4",
          }}
        >
          <span style={{ fontSize: 48, display: "block", marginBottom: 16 }}>
            🎉
          </span>
          <h1 style={{ color: "#198754", marginBottom: 8 }}>
            {t("alreadySignedTitle")}
          </h1>
          <p style={{ color: "#6c757d", marginBottom: 8 }}>
            {t("alreadySignedBody")}
          </p>
          <p style={{ fontWeight: 600, marginBottom: 32 }}>
            {t("signedOn", { date: signedDate })}
          </p>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 44,
              boxSizing: "border-box",
              padding: "10px 24px",
              background: "#198754",
              color: "#fff",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            {t("backToDashboardAfterSign")}
          </Link>
        </div>
      </main>
    );
  }

  // ── Eligible, not yet signed → acknowledgement form ───────────────────────
  return (
    <main style={{ maxWidth: 760, margin: "48px auto", padding: "0 24px" }}>
      <h1 style={{ marginBottom: 4 }}>{t("pageTitle")}</h1>
      <p style={{ color: "#6c757d", marginBottom: 32 }}>
        {t("progressNote", {
          passed: status.passedSections ?? 0,
          total: status.totalSections ?? 0,
        })}
      </p>

      {/* Client island: checkbox + submit logic */}
      <SignOffClient locale={locale} />
    </main>
  );
}
