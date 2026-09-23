import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { recordDeskOpen } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { entryUrl, getDepartment, resolveDepartment } from "@/lib/departments";
import {
  getMemberDashboard,
  type NextStep,
  type Pacing as PacingData,
  type SectionSummary,
} from "@/lib/dashboard";
import { contentRepo } from "@/lib/db/repositories";
import { getBioStatus } from "@/lib/db/queries/bio";
import { resolveLocalized } from "@/lib/i18n-content";
import NameSetupOverlay from "@/components/NameSetupOverlay";
import SearchBar, { type SearchableItem } from "@/components/SearchBar";
import styles from "./dashboard.module.css";

export const metadata: Metadata = {
  title: "Onboarding",
  description: "Your Silverleaf Academy onboarding dashboard — track your progress and complete your modules.",
};

/**
 * Member dashboard — the authenticated home of the onboarding hub.
 *
 * Auth gate: when there is no current user we render the StaffRegistration
 * overlay wired to the `signInMemberAction` server action. Once signed in, the
 * session cookie is set and `router.refresh()` re-renders this page with the
 * full dashboard. Chrome is localised via next-intl (`member.*`); section
 * titles/descriptions are resolved per-locale inside `getMemberDashboard`.
 *
 * Dynamic: this page reads the session cookie and per-member DB state, so it
 * must render per-request (never prerendered at build time).
 */
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await recordDeskOpen("onboarding", `/${locale}`);

  const live = getDepartment("onboarding");
  if (live) redirect(entryUrl(resolveDepartment(live)));

  // ── Authenticated, no name yet → name-setup prompt ───────────────────
  if (!user.fullName?.trim()) {
    return <NameSetupOverlay />;
  }

  // ── Authenticated → dashboard ─────────────────────────────────────────
  const t = await getTranslations("member");
  const [summary, bioStatus] = await Promise.all([
    getMemberDashboard(
      { id: user.id, fullName: user.fullName },
      locale as Locale,
    ),
    getBioStatus(user.id),
  ]);

  // Flat searchable index over all items (for the SearchBar).
  const tree = await contentRepo.getSectionsWithItems();
  const searchItems: SearchableItem[] = tree.flatMap((section) =>
    section.items.map((item) => ({
      id: item.id,
      title: resolveLocalized(item, "title", locale as Locale) ?? item.id,
      sectionId: section.id,
      sectionNumber: section.number,
      sectionTitle:
        resolveLocalized(section, "title", locale as Locale) ?? section.id,
    })),
  );

  const heroTitle = summary.memberName
    ? t("dashboard.heroTitle", { name: summary.memberName })
    : t("dashboard.heroTitleNoName");

  return (
    <div className={styles.dashboard}>
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden />
        <p className={styles.heroKicker}>{t("dashboard.heroKicker")}</p>
        <h1 className={styles.heroTitle}>{heroTitle}</h1>
        {user.campus ? (
          <p className={styles.heroCampus}>
            {t("dashboard.campusAssigned", { campus: user.campus })}
          </p>
        ) : (
          <p className={styles.heroCampusPending}>{t("dashboard.campusPending")}</p>
        )}
        <p className={styles.heroIntro}>{t("dashboard.heroIntro")}</p>
        <div className={styles.heroSearch}>
          <SearchBar
            items={searchItems}
            placeholder={t("dashboard.searchPlaceholder")}
          />
        </div>
      </section>

      {/* ── Bio data reminder ───────────────────────────────────────── */}
      {!bioStatus.exists && (
        <div style={{
          background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
          border: "1px solid #fbbf24",
          borderLeft: "4px solid #f59e0b",
          borderRadius: "8px",
          padding: "1rem 1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}>
          <div>
            <p style={{ fontWeight: 600, color: "#92400e", margin: 0, fontSize: "0.95rem" }}>
              📋 Your bio data form is not yet filled
            </p>
            <p style={{ color: "#78350f", margin: "4px 0 0", fontSize: "0.85rem" }}>
              Complete it to unlock your onboarding documents — it is a one-time form fill.
            </p>
          </div>
          <Link
            href="/bio"
            style={{
              background: "#f59e0b",
              color: "#1c1917",
              fontWeight: 700,
              fontSize: "0.85rem",
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Fill bio form →
          </Link>
        </div>
      )}

      {/* ── Onboarding journey quick links ──────────────────────────── */}
      <nav className={styles.journey} aria-label={t("dashboard.journeyHeading")}>
        <Link href="/bio" className={styles.journeyLink}>
          <span aria-hidden>📝</span> {t("dashboard.journeyBio")}
        </Link>
      </nav>

      <FirstWeekChecklist />

      {/* ── Overall progress ────────────────────────────────────────── */}
      <section className={styles.overall} aria-labelledby="overall-heading">
        <div className={styles.overallHeader}>
          <h2 id="overall-heading">{t("dashboard.progressHeading")}</h2>
          <span className={styles.overallPct}>{summary.overallPct}%</span>
        </div>
        <div
          className={styles.overallBar}
          role="progressbar"
          aria-valuenow={summary.overallPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("dashboard.progressHeading")}
        >
          <div
            className={styles.overallFill}
            style={{ width: `${summary.overallPct}%` }}
          />
        </div>
        <p className={styles.overallNote}>
          {t("dashboard.progressNote", {
            done: summary.stepsDone,
            total: summary.totalSteps,
            checkpoints: summary.sectionsPassed,
            sections: summary.totalSections,
          })}
        </p>
      </section>

      {/* ── Pacing + What's next ────────────────────────────────────── */}
      <div className={styles.twoCol}>
        <WhatsNext nextStep={summary.nextStep} />
        <PacingPanel pacing={summary.pacing} locale={locale as Locale} />
      </div>

      {/* ── All sections ────────────────────────────────────────────── */}
      <section className={styles.sections} aria-labelledby="sections-heading">
        <h2 id="sections-heading">{t("dashboard.allSections")}</h2>
        <div className={styles.sectionsGrid}>
          {summary.sections.map((section) => (
            <SectionCard key={section.id} section={section} />
          ))}
        </div>
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Presentational pieces (server components). Co-located with the page so they
 * stay within the member-owned dashboard file.
 * ────────────────────────────────────────────────────────────────────────── */

async function FirstWeekChecklist() {
  const t = await getTranslations("member");
  const items = [
    t("dashboard.firstWeek.profile"),
    t("dashboard.firstWeek.welcome"),
    t("dashboard.firstWeek.people"),
    t("dashboard.firstWeek.policies"),
  ];

  return (
    <section className={styles.firstWeek} aria-labelledby="first-week-heading">
      <div className={styles.firstWeekIntro}>
        <span className={styles.firstWeekKicker}>
          {t("dashboard.firstWeek.kicker")}
        </span>
        <h2 id="first-week-heading">{t("dashboard.firstWeek.heading")}</h2>
        <p>{t("dashboard.firstWeek.body")}</p>
      </div>
      <ol className={styles.firstWeekList}>
        {items.map((item, index) => (
          <li key={item}>
            <span aria-hidden>{index + 1}</span>
            <p>{item}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The single "what's next" call-to-action card. */
async function WhatsNext({ nextStep }: { nextStep: NextStep }) {
  const t = await getTranslations("member");

  if (nextStep.kind === "done") {
    return (
      <section className={`${styles.nextCard} ${styles.nextDone}`}>
        <span className={styles.nextIcon} aria-hidden>
          🎉
        </span>
        <div className={styles.nextBody}>
          <h2 className={styles.nextHeading}>{t("dashboard.nextHeading")}</h2>
          <p className={styles.nextLine}>{t("dashboard.next.done")}</p>
          <Link href="/section/policies" className={styles.nextCta}>
            {t("dashboard.next.ctaDone")} →
          </Link>
        </div>
      </section>
    );
  }

  const params = {
    number: nextStep.sectionNumber ?? 0,
    title: nextStep.sectionTitle ?? "",
  };

  const line =
    nextStep.kind === "resume-reading"
      ? t("dashboard.next.resumeReading", params)
      : nextStep.kind === "take-quiz"
        ? t("dashboard.next.takeQuiz", params)
        : t("dashboard.next.startSection", params);

  const cta =
    nextStep.kind === "resume-reading"
      ? t("dashboard.next.ctaResume")
      : nextStep.kind === "take-quiz"
        ? t("dashboard.next.ctaQuiz")
        : t("dashboard.next.ctaStart");

  const icon =
    nextStep.kind === "resume-reading"
      ? "📖"
      : nextStep.kind === "take-quiz"
        ? "✅"
        : "🚀";

  return (
    <section className={styles.nextCard}>
      <span className={styles.nextIcon} aria-hidden>
        {icon}
      </span>
      <div className={styles.nextBody}>
        <h2 className={styles.nextHeading}>{t("dashboard.nextHeading")}</h2>
        <p className={styles.nextLine}>{line}</p>
        <Link
          href={
            nextStep.itemId
              ? `/section/${nextStep.sectionId}?resume=${encodeURIComponent(nextStep.itemId)}`
              : `/section/${nextStep.sectionId}`
          }
          className={styles.nextCta}
        >
          {cta} →
        </Link>
      </div>
    </section>
  );
}

/** Gentle 6-week pacing indicator. Uses text + icon, never colour alone. */
async function PacingPanel({
  pacing,
  locale,
}: {
  pacing: PacingData;
  locale: Locale;
}) {
  const t = await getTranslations("member");

  const currentWeek = Math.min(pacing.weeksElapsed + 1, pacing.totalWeeks);
  const startedDate = new Date(pacing.startedAtISO).toLocaleDateString(
    locale === "sw" ? "sw-TZ" : "en-GB",
    { day: "numeric", month: "short", year: "numeric" },
  );

  const stateClass = pacing.onTrack ? styles.paceOnTrack : styles.paceBehind;
  const tag = pacing.onTrack
    ? t("dashboard.pacing.onTrackTag")
    : t("dashboard.pacing.behindTag");
  const message = pacing.onTrack
    ? t("dashboard.pacing.onTrack")
    : t("dashboard.pacing.behind");
  const icon = pacing.onTrack ? "🟢" : "🟡";

  // Progress through the 6 weeks (for the small week meter).
  const weekPct = Math.min(
    100,
    Math.round((currentWeek / pacing.totalWeeks) * 100),
  );

  return (
    <section className={`${styles.paceCard} ${stateClass}`}>
      <div className={styles.paceTop}>
        <h2 className={styles.paceHeading}>{t("dashboard.pacing.heading")}</h2>
        <span className={styles.paceTag}>
          <span aria-hidden>{icon}</span> {tag}
        </span>
      </div>
      <p className={styles.paceWeek}>
        {t("dashboard.pacing.week", {
          current: currentWeek,
          total: pacing.totalWeeks,
        })}
      </p>
      <div
        className={styles.paceBar}
        role="progressbar"
        aria-valuenow={weekPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("dashboard.pacing.heading")}
      >
        <div className={styles.paceFill} style={{ width: `${weekPct}%` }} />
      </div>
      <p className={styles.paceMessage}>{message}</p>
      <p className={styles.paceStarted}>
        {t("dashboard.pacing.startedOn", { date: startedDate })}
      </p>
    </section>
  );
}

/** One section card: open from the start, passed or in-progress, with a bar. */
async function SectionCard({ section }: { section: SectionSummary }) {
  const t = await getTranslations("member");

  const cardClass = [
    styles.sectionCard,
    section.quizPassed ? styles.sectionPassed : "",
  ]
    .filter(Boolean)
    .join(" ");

  const ctaLabel = section.quizPassed
    ? t("dashboard.review")
    : section.itemsDone > 0
      ? t("dashboard.resume")
      : t("dashboard.start");

  const sectionHref =
    !section.quizPassed && section.firstIncompleteItemId
      ? `/section/${section.id}?resume=${encodeURIComponent(section.firstIncompleteItemId)}`
      : !section.quizPassed && section.itemsDone >= section.itemsTotal && section.itemsTotal > 0
        ? `/section/${section.id}?resume=checkpoint`
        : `/section/${section.id}`;

  return (
    <Link href={sectionHref} className={cardClass}>
      <div className={styles.sectionCardHeader}>
        {section.icon && (
          <span className={styles.sectionEmoji} aria-hidden>
            {section.icon}
          </span>
        )}
        <div>
          <span className={styles.sectionNum}>
            {t("dashboard.sectionLabel", { number: section.number })}
          </span>
          <h3 className={styles.sectionName}>{section.title}</h3>
        </div>
        {section.quizPassed && (
          <span className={styles.sectionPassedBadge}>
            ✓ {t("dashboard.passedBadge")}
          </span>
        )}
      </div>

      {section.description && (
        <p className={styles.sectionDesc}>{section.description}</p>
      )}

      <p className={styles.sectionDocCount}>
        {section.itemsTotal > 0
          ? t("dashboard.documentsCount", { count: section.itemsTotal })
          : t("dashboard.documentsComingSoon")}
      </p>

      <div className={styles.sectionProgress}>
        <div
          className={styles.sectionBar}
          role="progressbar"
          aria-valuenow={section.pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={styles.sectionFill}
            style={{ width: `${section.pct}%` }}
          />
        </div>
        <span className={styles.sectionPct}>
          {t("dashboard.pctComplete", { pct: section.pct })}
        </span>
      </div>
      <span className={styles.sectionLink}>{ctaLabel} →</span>
    </Link>
  );
}
