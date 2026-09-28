import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { lessonPlans, planFeedback } from "@/lib/db/schema";
import { logUsage } from "@/lib/usage";
import FeedbackForm from "@/components/lesson/FeedbackForm";
import ComplianceDocument from "@/components/lesson/document/ComplianceDocument";
import LessonPlanDocument from "@/components/lesson/document/LessonPlanDocument";
import { structuredLessonPlanSchema } from "@/lib/ai/lessonPlan/structuredSchema";
import { toComplianceForm } from "@/lib/compliance/mapPlan";
import { markdownToReact } from "@/lib/lesson/markdownToReact";
import { formatPlanMeta } from "@/lib/lesson/planMeta";
import BackButton from "./BackButton";
import PlanVersionSwitch from "./PlanVersionSwitch";
import styles from "./plan.module.css";

/**
 * Plan detail.
 *
 * Loads a single PUBLISHED lesson plan by slug (404 otherwise), logs an "open"
 * usage event for the current teacher, and renders the title, a meta line, the
 * objectives, and the lesson body. The body markdown is rendered with the
 * small, dependency-free `markdownToReact` transform (NO
 * dangerouslySetInnerHTML), so untrusted content can never inject markup.
 *
 * A structured plan is shown as two projections of the same content_json, and
 * the teacher switches between them: the Silverleaf-branded document (read-only)
 * and the official government form, which is the ONLY one they can download —
 * the form is what the school files with inspectors. Both are rendered here on
 * the server and passed to the switch as slots, so neither document's markup
 * reaches the client bundle.
 *
 * The teacher's existing feedback (if any) seeds the FeedbackForm.
 *
 * Dynamic: per-teacher usage logging + session read, so never prerendered.
 */
export const dynamic = "force-dynamic";

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const user = await requireUser();
  const t = await getTranslations("lpPlan");
  const tc = await getTranslations("common");

  const [plan] = await db
    .select()
    .from(lessonPlans)
    .where(and(eq(lessonPlans.slug, slug), eq(lessonPlans.status, "published")))
    .limit(1);

  if (!plan) {
    notFound();
  }

  // Best-effort: logUsage never throws (see lib/usage.ts).
  await logUsage(user.id, plan.id, "open");

  const [fb] = await db
    .select()
    .from(planFeedback)
    .where(
      and(
        eq(planFeedback.staffId, user.id),
        eq(planFeedback.planId, plan.id),
      ),
    )
    .limit(1);

  const objectives = toStringArray(plan.objectives);

  // AI Studio v2: when the stored content_json is a valid StructuredLessonPlan,
  // offer both projections of it — the branded document and the official
  // government form; otherwise fall back to the safe markdown body. safeParse
  // never throws, so malformed/absent JSON simply degrades.
  //
  // The fallback keeps no switch and no download, by structure rather than by a
  // check: without structured data there is nothing to project onto the form,
  // and the markdown branch never had a download to begin with.
  //
  // The admin editor honours the same contract: it makes content_markdown
  // read-only for these plans (see admin/plans/[slug]/edit) because it is a
  // derived artefact that this page never displays while content_json is valid.
  const structured = structuredLessonPlanSchema.safeParse(plan.contentJson);

  return (
    <main className={styles.page}>
      <BackButton label={tc("back")} fallbackHref={`/${locale}`} />

      <article className={styles.plan}>
        <header className={styles.header}>
          <h1 className={styles.title}>{plan.title}</h1>
          <p className={styles.meta}>{formatPlanMeta(plan, t)}</p>
          {plan.topic ? <p className={styles.topic}>{plan.topic}</p> : null}
        </header>

        {objectives.length > 0 ? (
          <section className={styles.objectives} aria-labelledby="objectives-heading">
            <h2 id="objectives-heading" className={styles.sectionHeading}>
              {t("objectives")}
            </h2>
            <ul className={styles.objectiveList}>
              {objectives.map((objective, i) => (
                <li key={i}>{objective}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={styles.body} aria-label={t("body")}>
          {structured.success ? (
            <PlanVersionSwitch
              groupLabel={t("versionLabel")}
              brandedLabel={t("versionBranded")}
              governmentLabel={t("versionGovernment")}
              branded={<LessonPlanDocument plan={structured.data} />}
              government={
                <ComplianceDocument
                  form={toComplianceForm(structured.data, plan.durationMinutes)}
                  fileName={`${plan.filename}_Government_Form.pdf`}
                  downloadLabel={t("downloadGovernment")}
                />
              }
            />
          ) : (
            markdownToReact(plan.contentMarkdown, {
              paragraph: styles.paragraph,
              h2: styles.bodyH2,
              h3: styles.bodyH3,
              h4: styles.bodyH4,
              list: styles.bodyList,
            })
          )}
        </section>
      </article>

      <section className={styles.feedback} aria-labelledby="feedback-heading">
        <h2 id="feedback-heading" className={styles.sectionHeading}>
          {t("feedbackHeading")}
        </h2>
        <FeedbackForm
          planId={plan.id}
          initialRating={fb?.rating ?? null}
          initialComment={fb?.comment ?? null}
        />
      </section>
    </main>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

/** Coerce an unknown jsonb value into a clean string[] (drops non-strings). */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

