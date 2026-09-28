import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/auth";
import { Link, redirect } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { lessonPlans } from "@/lib/db/schema";
import { updatePlan, type PlanStatus } from "@/lib/actions/adminPlans";
import { structuredLessonPlanSchema } from "@/lib/ai/lessonPlan/structuredSchema";

/** Live, authenticated data — render on demand (never prerender/cache). */
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Inline form styles (the edit page owns no CSS module). Tokens from globals.
// ---------------------------------------------------------------------------
const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.375rem",
  marginBottom: "1.25rem",
};

const labelStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "0.875rem",
  color: "var(--ink)",
};

const controlStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.625rem 0.75rem",
  fontSize: "1rem",
  color: "var(--ink)",
  background: "var(--white)",
  border: "1px solid var(--card-border)",
  borderRadius: "var(--radius-sm)",
  minHeight: "44px",
};

const hintStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--ink-faint)",
};

/**
 * Admin plan editor.
 *
 * Loads the plan by `slug`, then renders a form bound to a server action that
 * parses the submitted fields and calls {@link updatePlan} (which re-asserts
 * admin and recomputes `search_text`). On success we redirect back to the
 * plans listing.
 */
export default async function EditPlanPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  await requireAdmin();
  const { locale, slug } = await params;

  const rows = await db
    .select()
    .from(lessonPlans)
    .where(eq(lessonPlans.slug, slug))
    .limit(1);

  const plan = rows[0];
  if (!plan) notFound();
  const planId = plan.id;

  const objectives = plan.objectives ?? [];

  // AI Studio v2 contract (see src/app/[locale]/plans/[slug]/page.tsx): when
  // content_json holds a valid StructuredLessonPlan, teachers see the branded
  // document rendered from it — NOT content_markdown. Editing the markdown
  // here would silently change nothing, so the field is read-only for those
  // plans and excluded from the save below.
  const hasStructuredContent = structuredLessonPlanSchema.safeParse(
    plan.contentJson,
  ).success;

  /**
   * Server action: read the form, normalise fields, persist, redirect.
   * Defined inline so it closes over `plan.id`, `slug`, and `locale`.
   */
  async function saveAction(formData: FormData) {
    "use server";

    const title = String(formData.get("title") ?? "");
    const topic = String(formData.get("topic") ?? "");
    const objectivesRaw = String(formData.get("objectives") ?? "");
    const contentMarkdown = String(formData.get("contentMarkdown") ?? "");
    const durationRaw = String(formData.get("durationMinutes") ?? "").trim();
    const statusRaw = String(formData.get("status") ?? "published");

    const status: PlanStatus = statusRaw === "draft" ? "draft" : "published";
    const durationMinutes =
      durationRaw === "" ? null : Number.parseInt(durationRaw, 10);

    await updatePlan(planId, {
      title,
      topic,
      // Split the textarea into one objective per line.
      objectives: objectivesRaw
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
      // For v2 plans the markdown is a derived, non-displayed artefact — never
      // patch it (the read-only textarea still submits its value).
      ...(hasStructuredContent ? {} : { contentMarkdown }),
      durationMinutes:
        durationMinutes != null && Number.isNaN(durationMinutes)
          ? null
          : durationMinutes,
      status,
    });

    redirect({ href: "/admin/plans", locale });
  }

  const t = await getTranslations("lpAdmin.plans.edit");

  return (
    <div style={{ maxWidth: 760 }}>
      <p style={{ marginBottom: "0.5rem" }}>
        <Link
          href="/admin/plans"
          style={{ fontWeight: 600, color: "var(--electric-blue)" }}
        >
          {t("backToPlans")}
        </Link>
      </p>

      <h1 style={{ marginBottom: "0.25rem" }}>{t("heading")}</h1>
      <p style={{ ...hintStyle, marginBottom: "1.5rem" }}>
        {plan.grade} · {plan.subject} · T{plan.term} · W{plan.week} · L
        {plan.lesson} · <code>{plan.slug}</code>
      </p>

      <form action={saveAction}>
        <div style={fieldStyle}>
          <label htmlFor="title" style={labelStyle}>
            {t("title")}
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={plan.title}
            style={controlStyle}
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="topic" style={labelStyle}>
            {t("topic")}
          </label>
          <input
            id="topic"
            name="topic"
            type="text"
            defaultValue={plan.topic ?? ""}
            style={controlStyle}
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="objectives" style={labelStyle}>
            {t("objectives")}
          </label>
          <textarea
            id="objectives"
            name="objectives"
            rows={4}
            defaultValue={objectives.join("\n")}
            style={{ ...controlStyle, minHeight: "96px", resize: "vertical" }}
          />
          <span style={hintStyle}>{t("objectivesHint")}</span>
        </div>

        <div style={fieldStyle}>
          <label htmlFor="durationMinutes" style={labelStyle}>
            {t("duration")}
          </label>
          <input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min={0}
            inputMode="numeric"
            defaultValue={plan.durationMinutes ?? ""}
            style={{ ...controlStyle, maxWidth: "200px" }}
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="status" style={labelStyle}>
            {t("status")}
          </label>
          <select
            id="status"
            name="status"
            defaultValue={plan.status}
            style={{ ...controlStyle, maxWidth: "240px" }}
          >
            <option value="published">{t("statusPublished")}</option>
            <option value="draft">{t("statusDraft")}</option>
          </select>
        </div>

        <div style={fieldStyle}>
          <label htmlFor="contentMarkdown" style={labelStyle}>
            {t("content")}
          </label>
          <textarea
            id="contentMarkdown"
            name="contentMarkdown"
            rows={16}
            readOnly={hasStructuredContent}
            defaultValue={plan.contentMarkdown}
            style={{
              ...controlStyle,
              minHeight: "320px",
              resize: "vertical",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              ...(hasStructuredContent ? { opacity: 0.6 } : {}),
            }}
          />
          {hasStructuredContent ? (
            <span style={hintStyle}>{t("contentLockedNote")}</span>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="submit"
            style={{
              minHeight: "44px",
              padding: "0 1.5rem",
              fontWeight: 700,
              color: "var(--white)",
              background: "var(--electric-blue)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {t("save")}
          </button>
          <Link
            href="/admin/plans"
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: "44px",
              padding: "0 1.5rem",
              fontWeight: 600,
              color: "var(--electric-blue)",
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {t("cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
