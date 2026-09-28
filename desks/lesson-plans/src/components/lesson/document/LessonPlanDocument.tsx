/**
 * LessonPlanDocument — Silverleaf-branded, print-ready lesson-plan document.
 *
 * A shared presentational component: the plan page renders it on the server,
 * but the AI Studio PreviewPane imports it into a client tree — so it must
 * stay client-safe (no `server-only` imports, no server APIs). It renders a
 * validated `StructuredLessonPlan` (AI Studio v2) as the 3-page A4 booklet
 * from the Antoine renderer
 * (silverleaf-lesson-plans-antoine/visual_design/src/silverleaf-lessonplan.js —
 * an external provenance repo, not part of this codebase), field-for-field
 * with `renderPages()`:
 *
 *   Page 1  Overview      — identifier cover + success criteria + knows/shows
 *                           + misconceptions
 *   Page 2  Teaching      — materials & prep + the four Surface→Deep stages
 *   Page 3  Differentiation & Close — tiers + conclusion/exit ticket +
 *                           assessment method + watch-for/reflection + gaps
 *
 * All text comes through JSX, so React auto-escapes it — there is no
 * dangerouslySetInnerHTML and untrusted content can never inject markup.
 *
 * This document is READ-ONLY for teachers: its PDF export is opt-in via
 * `showPrint` and only the AI Studio preview asks for it. What a teacher
 * downloads is the official government form (`ComplianceDocument`) — the school
 * files that with inspectors, not the branded booklet.
 *
 * Styling lives in `lessonPlanDocument.module.css`; the white brandmark and the
 * two raster brand patterns + 7 brand fonts are served from `/public/brand`.
 */
import type { ReactNode } from "react";

import {
  TEACHING_STAGES,
  type StructuredLessonPlan,
} from "@/lib/ai/lessonPlan/structuredSchema";
import PrintButton from "./PrintButton";
import styles from "./lessonPlanDocument.module.css";

/** Join several (possibly undefined) CSS-module class names. */
function cx(...names: Array<string | false | undefined>): string {
  return names.filter(Boolean).join(" ");
}

/**
 * A safe `<grade>_<subject>_<lesson>.pdf` filename for the download/print.
 *
 * NOTE: derived from the plan content, NOT the canonical stored
 * `lesson_plans.filename` (see lib/naming/format.ts `buildFilename`) — this
 * component also renders pre-save Studio previews that have no DB row, so the
 * two names intentionally differ.
 */
function pdfFileName(plan: StructuredLessonPlan): string {
  const id = plan.identifier;
  const slug = [id.grade, id.subject, `L${id.lesson_number}`, id.title]
    .filter(Boolean)
    .join("_")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "lesson-plan"}.pdf`;
}

/** White Silverleaf brandmark, sized like the original `badge()` helper. */
function BrandBadge({ tagline = false }: { tagline?: boolean }) {
  return (
    <div className={cx(styles.brandbadge, tagline && styles.tag)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG, intrinsic-sized via CSS height */}
      <img
        src={
          tagline ? "/brand/brandmark-white-tagline.svg" : "/brand/brandmark-white.svg"
        }
        alt="Silverleaf Academy"
      />
    </div>
  );
}

const FUTURE_STRIP = <div className={styles.fstrip} />;

/** One full A4 page section with its corner page number. */
function Page({
  children,
  n,
  total,
}: {
  children: ReactNode;
  n: number;
  total: number;
}) {
  return (
    <section className={styles.page} data-print-page>
      {children}
      <div className={styles.pagenum}>
        {n} / {total}
      </div>
    </section>
  );
}

/* ── Page 1: identifier + success criteria + knows/shows + misconceptions ──── */
function PageOverview({ plan }: { plan: StructuredLessonPlan }) {
  const id = plan.identifier;
  const term = (id.term || "").trim();
  const termLabel = term ? (/term/i.test(term) ? term : `Term ${term}`) : "";
  // The model sometimes echoes the same competence text into both fields —
  // don't print it twice when they're identical.
  const showMainCompetence =
    id.main_competence.trim().toLowerCase() !== id.specific_competence.trim().toLowerCase();

  return (
    <>
      <header className={styles.cover}>
        <BrandBadge tagline />
        <div className={styles.cd}>
          <span className={styles.ll}>Lesson</span>
          <b>{id.lesson_number}</b>
        </div>
        <div className={styles.cr}>
          <div className={styles.crtop}>
            Grade {id.grade} · {id.subject}
            {termLabel ? ` · ${termLabel}` : ""} · Week {id.week}
          </div>
          <h1>{id.title}</h1>
          <div className={styles.comp}>
            {showMainCompetence ? (
              <>
                {id.main_competence} &nbsp;·&nbsp; {id.specific_competence}
              </>
            ) : (
              id.specific_competence
            )}
          </div>
        </div>
      </header>
      {FUTURE_STRIP}
      <div className={styles.pad}>
        <div className={styles.sc}>
          <h2>SUCCESS CRITERIA — where this lesson is going</h2>
          <ul>
            {plan.success_criteria.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
        <div className={styles.two}>
          <div className={cx(styles.box, styles.mint)}>
            <h2>
              KNOWS <span className={styles.sub}>in their head</span>
            </h2>
            <ul>
              {plan.knows.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
          <div className={cx(styles.box, styles.gray)}>
            <h2>
              SHOWS <span className={styles.sub}>what they do</span>
            </h2>
            <ul>
              {plan.shows.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className={cx(styles.box, styles.mint, styles.misc)}>
          <h2>
            MISCONCEPTIONS{" "}
            <span className={styles.sub}>met inside the stages</span>
          </h2>
          <ul>
            {plan.misconceptions.map((mc, i) => (
              <li key={i}>
                <span className={styles.mt}>{mc.misconception}</span>{" "}
                <span className={styles.md}>{mc.description}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

/* ── Page 2: materials + the surface→deep teaching sequence ────────────────── */
function PageTeaching({ plan }: { plan: StructuredLessonPlan }) {
  const ts = plan.teaching_sequence;

  return (
    <>
      <header className={styles.phead}>
        <BrandBadge />
        <h1>
          Teaching Sequence
          <span className={styles.sub}>
            Backwards design · the lesson climbs Surface → Deep
          </span>
        </h1>
      </header>
      {FUTURE_STRIP}
      <div className={styles.pad}>
        <div className={cx(styles.box, styles.gray)}>
          <h2>MATERIALS &amp; PREPARATION</h2>
          <ul>
            {plan.materials_and_prep.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
        {TEACHING_STAGES.map(({ key, label }, idx) => {
          const s = ts[key];
          const depthClass =
            s.depth.toLowerCase() === "deep" ? styles.deep : styles.surface;
          return (
            <div key={key} className={cx(styles.stage, depthClass)}>
              <div className={styles.sh}>
                <span className={styles.sn}>{idx + 1}</span>
                <h3>{label}</h3>
                <span className={cx(styles.pill, depthClass)}>{s.depth}</span>
              </div>
              <div className={styles.body}>
                <p className={styles.txt}>{s.text}</p>
                {s.sentence_frame ? (
                  <div className={styles.frame}>
                    <b>Sentence frame:</b> {s.sentence_frame}
                  </div>
                ) : null}
                {s.checkpoint ? (
                  <div className={styles.cp}>
                    <span className={styles.cpl}>✓ CHECKPOINT (assessment)</span>
                    {s.checkpoint}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ── Page 3: differentiation + close + professional layer ──────────────────── */
function PageClose({ plan }: { plan: StructuredLessonPlan }) {
  const d = plan.differentiation;
  const ex = plan.conclusion_and_exit_ticket;
  const gaps = plan.meta.gaps_flagged;

  return (
    <>
      <header className={styles.phead}>
        <BrandBadge />
        <h1>
          <span className={styles.accent}>Differentiation &amp; Close</span>
          <span className={styles.sub}>
            Suggestions · pitched to each learner&apos;s Zone of Proximal
            Development
          </span>
        </h1>
      </header>
      {FUTURE_STRIP}
      <div className={styles.pad}>
        <div className={styles.tiers}>
          <div className={styles.tier}>
            <h3>
              Remedial <span className={styles.tp}>· fill the gap below</span>
            </h3>
            <p>{d.remedial}</p>
          </div>
          <div className={styles.tier}>
            <h3>
              Support <span className={styles.tp}>· scaffold through</span>
            </h3>
            <p>{d.support}</p>
          </div>
          <div className={cx(styles.tier, styles.challenge)}>
            <h3>
              Challenge <span className={styles.tp}>· push beyond</span>
            </h3>
            <p>{d.challenge}</p>
          </div>
          <div className={cx(styles.tier, styles.digital)}>
            <h3>
              Digital idea <span className={styles.tp}>· (if available)</span>
            </h3>
            {d.digital_resources.length ? (
              <ul>
                {d.digital_resources.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            ) : (
              <p>
                <em>(none suggested)</em>
              </p>
            )}
          </div>
        </div>
        <div className={cx(styles.understand, styles.spaced)}>
          <b>Conclusion:</b> {ex.understanding}
        </div>
        <div className={styles.exit}>
          <div className={styles.et}>EXIT TICKET</div>
          <h2>Before they go</h2>
          <p>{ex.exit_ticket}</p>
        </div>
        <div className={styles.method}>
          <h3>ASSESSMENT METHOD</h3>
          {plan.assessment_method}
        </div>
        <div className={styles.notesGrid}>
          <div className={cx(styles.box, styles.gray)}>
            <h2>WATCH-FOR NOTES</h2>
            <ul>
              {plan.watch_for_notes.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
          <div className={cx(styles.box, styles.mint)}>
            <h2>TEACHER REFLECTION</h2>
            <ul>
              {plan.teacher_reflection.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
        {gaps.length ? (
          <div className={styles.gaps}>
            <h3>NOTES / ASSUMPTIONS FLAGGED</h3>
            <ul>
              {gaps.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className={styles.footerStrip}>
        Silverleaf Academy &nbsp;·&nbsp; The Future Starts Here. &nbsp;·&nbsp;
        www.silverleaf.co.tz
      </div>
    </>
  );
}

/** The full 3-page branded lesson-plan document. */
export default function LessonPlanDocument({
  plan,
  showPrint = false,
}: {
  plan: StructuredLessonPlan;
  /**
   * Offer the branded PDF export. OFF by default: teachers download the official
   * government form instead (see `ComplianceDocument`), so defaulting to `false`
   * means a new surface cannot leak the branded PDF merely by forgetting. The AI
   * Studio preview opts in.
   */
  showPrint?: boolean;
}) {
  const total = 3;
  const fileName = pdfFileName(plan);
  return (
    <div className={styles.doc} data-print-root>
      {showPrint ? (
        <div className={styles.printBar}>
          <PrintButton className={styles.printButton} fileName={fileName} />
        </div>
      ) : null}
      <Page n={1} total={total}>
        <PageOverview plan={plan} />
      </Page>
      <Page n={2} total={total}>
        <PageTeaching plan={plan} />
      </Page>
      <Page n={3} total={total}>
        <PageClose plan={plan} />
      </Page>
    </div>
  );
}
