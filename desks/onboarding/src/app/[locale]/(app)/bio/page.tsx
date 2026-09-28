import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Bio Data Form — Silverleaf Onboarding Hub",
  description: "Submit your personal and employment details to complete your staff onboarding.",
};
import { loadMyBio } from "@/lib/actions/bio";
import BioForm, { type BioInitialValues } from "@/components/bio/BioForm";
import { toInitialValues } from "@/components/bio/serialize";
import {
  listMemberCvDocuments,
  listMemberQualDocsByIndex,
  toBioDocumentView,
} from "@/lib/db/queries/bio-documents";

/**
 * Bio-data page — the member's extended onboarding profile.
 *
 * - Not authenticated → redirect to the locale home (sign-in overlay).
 * - Authenticated → render the multi-section form, prefilled from any
 *   previously-saved profile.
 *
 * Dynamic: reads the session + the current user's own PII on every request.
 * Never cached (this is per-member sensitive data) and never reads another
 * member's profile — `loadMyBio()` resolves the id from the session only.
 */
export const dynamic = "force-dynamic";

export default async function BioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // ── Auth gate ──────────────────────────────────────────────────────────────
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}`);
  }

  const t = await getTranslations("bio");

  // ── Prefill from existing data (current user's own profile only) ────────────
  const existing = await loadMyBio();
  const initial: BioInitialValues = toInitialValues(existing);

  const [qualDocuments, cvDocuments] = await Promise.all([
    listMemberQualDocsByIndex(user.id),
    listMemberCvDocuments(user.id).then((rows) => rows.map(toBioDocumentView)),
  ]);

  const lastSaved = existing?.profile.updatedAt
    ? new Date(existing.profile.updatedAt).toLocaleDateString(
        locale === "sw" ? "sw-TZ" : "en-GB",
        { day: "numeric", month: "long", year: "numeric" },
      )
    : null;

  return (
    <main
      style={{
        maxWidth: 880,
        margin: "32px auto",
        padding: "0 16px 64px",
      }}
    >
      <h1 style={{ marginBottom: 4 }}>{t("pageTitle")}</h1>
      <p style={{ color: "#6c757d", marginBottom: 24 }}>{t("pageSubtitle")}</p>

      <BioForm
        initial={initial}
        locale={locale}
        lastSaved={lastSaved}
        initialQualDocuments={qualDocuments}
        initialCvDocuments={cvDocuments}
      />
    </main>
  );
}
