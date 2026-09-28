import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import {
  getActivityTrend,
  getFeedbackHourParticipation,
  getLeastViewedPlans,
  getLowestRatedPlans,
  getMostViewedPlans,
  getNoResultSearches,
  getOverviewStats,
  getRecentComments,
  getTeacherActivity,
  type PlanViewCount,
} from "@/lib/admin/insights";
import InsightCards from "@/components/admin/InsightCards";
import TeacherActivityPanel from "@/components/admin/TeacherActivityPanel";

/** Live, authenticated data — render on demand (never prerender/cache). */
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Local style tokens (inline; the page itself owns no CSS module). The reusable
// visual pieces live in the admin components; these are light section frames.
// ---------------------------------------------------------------------------
const sectionStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--card-border)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow)",
  padding: "1rem 1.125rem 1.125rem",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "1.0625rem",
  marginBottom: "0.75rem",
};

const emptyStyle: React.CSSProperties = {
  color: "var(--ink-faint)",
  fontSize: "0.9375rem",
};

const listStyle: React.CSSProperties = {
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "0.75rem",
  paddingBottom: "0.5rem",
  borderBottom: "1px solid var(--card-border)",
};

const planLinkStyle: React.CSSProperties = {
  fontWeight: 600,
  color: "var(--electric-blue)",
  overflowWrap: "anywhere",
};

const countStyle: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
  color: "var(--ink)",
  whiteSpace: "nowrap",
};

const metaStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--ink-faint)",
};

/** A list of plans with their view counts (shared by most/least viewed). */
function PlanViewList({
  plans,
  emptyLabel,
  viewsLabel,
}: {
  plans: PlanViewCount[];
  emptyLabel: string;
  viewsLabel: (views: number) => string;
}) {
  if (plans.length === 0) {
    return <p style={emptyStyle}>{emptyLabel}</p>;
  }
  return (
    <ul style={listStyle}>
      {plans.map((plan) => (
        <li key={plan.planId} style={rowStyle}>
          <span style={{ minWidth: 0 }}>
            <Link href={`/admin/plans/${plan.slug}/edit`} style={planLinkStyle}>
              {plan.title}
            </Link>
            <span style={{ ...metaStyle, display: "block" }}>
              {plan.grade} · {plan.subject}
            </span>
          </span>
          <span style={countStyle}>{viewsLabel(plan.views)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Admin dashboard — usage insights.
 *
 * Re-asserts admin (the layout already gates, this is defence in depth), then
 * fetches every aggregate concurrently and lays them out as mobile-first cards
 * and sections.
 */
export default async function AdminPage() {
  await requireAdmin();

  const t = await getTranslations("lpAdmin.dashboard");
  const viewsLabel = (views: number) => t("views", { count: views });

  const [
    stats,
    mostViewed,
    leastViewed,
    noResultSearches,
    lowestRated,
    recentComments,
    feedbackHour,
    teacherActivity,
    activityTrend,
  ] = await Promise.all([
    getOverviewStats(),
    getMostViewedPlans(8),
    getLeastViewedPlans(8),
    getNoResultSearches(15),
    getLowestRatedPlans(8),
    getRecentComments(8),
    getFeedbackHourParticipation(),
    getTeacherActivity(),
    getActivityTrend(),
  ]);

  return (
    <div>
      <h1 style={{ marginBottom: "1.25rem" }}>{t("heading")}</h1>

      <InsightCards stats={stats} />

      <div
        style={{
          display: "grid",
          /* minmax(0, …): let items shrink below their content's min width so
             the nowrap tables scroll inside their own overflow-x wrappers
             instead of widening the whole page on phones. */
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: "1.25rem",
        }}
      >
        {/* Teacher activity */}
        <TeacherActivityPanel
          roster={teacherActivity}
          trend={activityTrend}
        />

        {/* Most viewed */}
        <section style={sectionStyle} aria-labelledby="most-viewed">
          <h2 id="most-viewed" style={sectionTitleStyle}>
            {t("mostViewed.heading")}
          </h2>
          <PlanViewList
            plans={mostViewed}
            emptyLabel={t("mostViewed.empty")}
            viewsLabel={viewsLabel}
          />
        </section>

        {/* Least viewed */}
        <section style={sectionStyle} aria-labelledby="least-viewed">
          <h2 id="least-viewed" style={sectionTitleStyle}>
            {t("leastViewed.heading")}
          </h2>
          <p style={{ ...metaStyle, marginBottom: "0.75rem" }}>
            {t("leastViewed.description")}
          </p>
          <PlanViewList
            plans={leastViewed}
            emptyLabel={t("leastViewed.empty")}
            viewsLabel={viewsLabel}
          />
        </section>

        {/* No-result searches */}
        <section style={sectionStyle} aria-labelledby="no-results">
          <h2 id="no-results" style={sectionTitleStyle}>
            {t("noResults.heading")}
          </h2>
          <p style={{ ...metaStyle, marginBottom: "0.75rem" }}>
            {t("noResults.description")}
          </p>
          {noResultSearches.length === 0 ? (
            <p style={emptyStyle}>{t("noResults.empty")}</p>
          ) : (
            <ul style={listStyle}>
              {noResultSearches.map((miss) => (
                <li key={miss.id} style={rowStyle}>
                  <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    “{miss.query}”
                    {miss.searcherEmail ? (
                      <span style={{ ...metaStyle, display: "block" }}>
                        {miss.searcherEmail}
                      </span>
                    ) : null}
                  </span>
                  <span style={metaStyle}>
                    {new Date(miss.occurredAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Lowest rated */}
        <section style={sectionStyle} aria-labelledby="lowest-rated">
          <h2 id="lowest-rated" style={sectionTitleStyle}>
            {t("lowestRated.heading")}
          </h2>
          {lowestRated.length === 0 ? (
            <p style={emptyStyle}>{t("lowestRated.empty")}</p>
          ) : (
            <ul style={listStyle}>
              {lowestRated.map((plan) => (
                <li key={plan.planId} style={rowStyle}>
                  <span style={{ minWidth: 0 }}>
                    <Link
                      href={`/admin/plans/${plan.slug}/edit`}
                      style={planLinkStyle}
                    >
                      {plan.title}
                    </Link>
                    <span style={{ ...metaStyle, display: "block" }}>
                      {t("ratings", { count: plan.feedbackCount })}
                    </span>
                  </span>
                  <span style={countStyle}>
                    {plan.avgRating.toFixed(1)} ★
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent comments */}
        <section style={sectionStyle} aria-labelledby="recent-comments">
          <h2 id="recent-comments" style={sectionTitleStyle}>
            {t("recentComments.heading")}
          </h2>
          {recentComments.length === 0 ? (
            <p style={emptyStyle}>{t("recentComments.empty")}</p>
          ) : (
            <ul style={{ ...listStyle, gap: "0.875rem" }}>
              {recentComments.map((c) => (
                <li
                  key={c.id}
                  style={{
                    background: "var(--app-bg)",
                    borderRadius: "var(--radius-sm)",
                    padding: "0.75rem 0.875rem",
                  }}
                >
                  <p
                    style={{
                      fontSize: "0.9375rem",
                      lineHeight: 1.5,
                      marginBottom: "0.5rem",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {c.comment}
                  </p>
                  <div style={{ fontSize: "0.8125rem" }}>
                    <span style={{ color: "var(--gold)" }}>
                      {"★".repeat(Math.max(0, Math.min(5, c.rating)))}
                    </span>{" "}
                    <Link
                      href={`/admin/plans/${c.slug}/edit`}
                      style={planLinkStyle}
                    >
                      {c.title}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p style={{ marginTop: "0.875rem" }}>
            <Link href="/admin/feedback" style={planLinkStyle}>
              {t("recentComments.viewAll")}
            </Link>
          </p>
        </section>

        {/* Feedback-hour participation */}
        <section style={sectionStyle} aria-labelledby="feedback-hour">
          <h2 id="feedback-hour" style={sectionTitleStyle}>
            {t("feedbackHour.heading")}
          </h2>
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            <span>
              <span
                style={{
                  display: "block",
                  fontSize: "1.875rem",
                  fontWeight: 700,
                  color: "var(--electric-blue)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {feedbackHour.awardCount}
              </span>
              <span style={metaStyle}>{t("feedbackHour.bonusesAwarded")}</span>
            </span>
            <span>
              <span
                style={{
                  display: "block",
                  fontSize: "1.875rem",
                  fontWeight: 700,
                  color: "var(--electric-blue)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {feedbackHour.distinctStaff}
              </span>
              <span style={metaStyle}>{t("feedbackHour.teachersTookPart")}</span>
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
