import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "Access Restricted — Silverleaf Onboarding Hub",
};

/**
 * Unauthorized page — shown when `requireAdmin()` or `requireRole()` fails.
 *
 * Accessible, on-brand, bilingual. Does NOT leak which role is required.
 */
export default async function UnauthorizedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("errors");

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        textAlign: "center",
        gap: "1.25rem",
      }}
    >
      <span
        style={{ fontSize: "3rem", lineHeight: 1 }}
        role="img"
        aria-label={t("unauthorized.iconLabel")}
      >
        🔒
      </span>

      <h1
        style={{
          fontSize: "1.75rem",
          color: "var(--electric-blue)",
          fontWeight: 800,
        }}
      >
        {t("unauthorized.title")}
      </h1>

      <p
        style={{
          maxWidth: "36ch",
          color: "#444",
          lineHeight: 1.6,
        }}
      >
        {t("unauthorized.body")}
      </p>

      <Link
        href="/"
        style={{
          marginTop: "0.5rem",
          display: "inline-block",
          padding: "0.75rem 1.75rem",
          background: "var(--electric-blue)",
          color: "var(--white)",
          borderRadius: "var(--radius-sm)",
          fontWeight: 700,
          fontSize: "0.95rem",
          textDecoration: "none",
        }}
      >
        {t("unauthorized.cta")}
      </Link>
    </main>
  );
}
