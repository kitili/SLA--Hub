/**
 * ComplianceDocument — the official Tanzanian (NECTA/TIE-CBC) bilingual
 * lesson-plan form, filled from a plan.
 *
 * The teacher's downloadable artefact: what Silverleaf hands an inspector. It
 * renders a `ComplianceForm` (see lib/compliance/mapPlan.ts, which holds the
 * whole of the JSON → form mapping) as an HTML re-creation of the school's
 * Compliance_LP_Template.docx — checked field-for-field against the handover's
 * `reference_output/pdf/L001__*.pdf`.
 *
 * The form is LANDSCAPE A4 (297×210mm), which is why `PrintButton` is given an
 * explicit orientation: the five-column process table only fits on a turned
 * page.
 *
 * The form's labels are printed BILINGUALLY (Kiswahili / English) as literals
 * and deliberately do NOT go through next-intl: they are the government's form
 * text, not app chrome, so they read the same whatever locale the teacher is in.
 * Only the download button is localised. The filled content is English, matching
 * the handover (only Kiswahili-medium subjects would differ, and no such plans
 * exist yet).
 *
 * Fields left BLANK on purpose — teacher's name, date, period, the pupil counts
 * and the remarks — are the delivery fields the teacher completes by hand on the
 * printout. The per-step TIME column is blank for the same reason (we hold no
 * per-stage timing; see mapPlan.ts).
 *
 * Markup mirrors LessonPlanDocument so `PrintButton` works on it: a
 * `[data-print-root]` wrapper, a `.printBar` that sits OUTSIDE every page (so it
 * is never rasterised), and one `[data-print-page]` section per sheet. Pages set
 * `min-height`, so a long one shrinks to fit the PDF rather than clipping —
 * which is what lets the process table hold prose of any length.
 *
 * All text comes through JSX, so React escapes it; no dangerouslySetInnerHTML.
 */
import type { ComplianceForm, ComplianceStepRow } from "@/lib/compliance/form";
import PrintButton from "./PrintButton";
import styles from "./complianceDocument.module.css";

/** The form's ruled blank for a hand-written delivery field. */
function Rule({ short = false }: { short?: boolean }) {
  return (
    <span
      className={short ? `${styles.rule} ${styles.ruleShort}` : styles.rule}
      aria-hidden="true"
    />
  );
}

/** One sheet of the form. */
function Page({ children }: { children: React.ReactNode }) {
  return (
    <section className={styles.page} data-print-page>
      {children}
    </section>
  );
}

/** A body field: bold bilingual label, the filled value, closed by a hairline. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <p className={styles.field}>
      <span className={styles.labelSmall}>{label}</span> {value}
    </p>
  );
}

/** The five column headers of the LESSON PROCESS table. */
function ProcessHead() {
  return (
    <thead>
      <tr>
        <th className={styles.stepCell}>HATUA / STEPS</th>
        <th className={styles.timeCell}>MUDA / TIME</th>
        <th className={styles.teachingCell}>SHUGHULI ZA UFUNDISHAJI / TEACHING ACTIVITIES</th>
        <th className={styles.learningCell}>SHUGHULI ZA UJIFUNZAJI / LEARNING ACTIVITIES</th>
        <th className={styles.testingCell}>VIGEZO VYA UPIMAJI / TESTING CRITERIA</th>
      </tr>
    </thead>
  );
}

/** Render a cell's lines as paragraphs, as the form's own cells are laid out. */
function paragraphs(lines: string[]) {
  return lines.map((line, i) => <p key={i}>{line}</p>);
}

/**
 * One official step. The `data-label`s carry the column headings for the stacked
 * narrow layout, where the table's own `thead` is hidden.
 */
function ProcessRow({ row }: { row: ComplianceStepRow }) {
  return (
    <tr>
      <td className={styles.stepCell}>{row.step}</td>
      <td className={styles.timeCell} data-label="MUDA / TIME">
        {row.time}
      </td>
      <td className={styles.teachingCell} data-label="SHUGHULI ZA UFUNDISHAJI / TEACHING ACTIVITIES">
        {paragraphs(row.teaching)}
      </td>
      <td className={styles.learningCell} data-label="SHUGHULI ZA UJIFUNZAJI / LEARNING ACTIVITIES">
        {paragraphs(row.learning)}
      </td>
      <td className={styles.testingCell} data-label="VIGEZO VYA UPIMAJI / TESTING CRITERIA">
        {paragraphs(row.testing)}
      </td>
    </tr>
  );
}

const PUPIL_ROWS = [
  "WALIOSAJILIWA / REGISTERED",
  "WALIOHUDHURIA / ATTENDED",
  "WATORO / ABSENTEES",
];

export default function ComplianceDocument({
  form,
  fileName,
  downloadLabel,
}: {
  form: ComplianceForm;
  fileName: string;
  /** Localised label for the download button (app chrome, unlike the form). */
  downloadLabel?: string;
}) {
  const [intro, competence, design, assessment] = form.steps;

  return (
    <div className={styles.doc} data-print-root>
      <div className={styles.printBar}>
        <PrintButton
          className={styles.printButton}
          fileName={fileName}
          label={downloadLabel}
          orientation="landscape"
          stageWidth="320mm"
        />
      </div>

      {/* Sheet 1 — the identifying header. */}
      <Page>
        {/* eslint-disable-next-line @next/next/no-img-element -- the form's own logo, lifted from the school's template; intrinsic-sized via CSS height */}
        <img
          className={styles.logo}
          src="/brand/compliance-header.png"
          alt="Silverleaf Academy"
        />

        <p className={styles.line}>
          <span className={styles.label}>JINA LA SHULE / NAME OF SCHOOL:</span>
          <span>{form.schoolName}</span>
        </p>
        <p className={styles.line}>
          <span className={styles.labelSmall}>JINA LA MWALIMU / TEACHER&apos;S NAME:</span>
          <Rule />
        </p>
        <p className={styles.line}>
          <span className={styles.label}>UMAHIRI MKUU / MAIN COMPETENCE:</span>
          <span>{form.mainCompetence}</span>
        </p>

        <div className={styles.subjectLine}>
          <span className={styles.subjectField}>
            <span className={styles.label}>SOMO / SUBJECT:</span> {form.subject}
          </span>
          <span className={styles.subjectField}>
            <span className={styles.label}>DARASA / CLASS:</span> {form.className}
          </span>
          <span className={styles.subjectField}>
            <span className={styles.label}>MUDA / TIME:</span> {form.time}
          </span>
          <span className={`${styles.subjectField} ${styles.grow}`}>
            <span className={styles.label}>TAREHE / DATE:</span>
            <Rule short />
          </span>
          <span className={`${styles.subjectField} ${styles.grow}`}>
            <span className={styles.label}>KIPINDI / PERIOD:</span>
            <Rule short />
          </span>
        </div>

        <p className={styles.pupilsHeading}>IDADI YA WANAFUNZI / NUMBER OF PUPILS</p>
        <table className={`${styles.table} ${styles.pupils}`}>
          <thead>
            <tr>
              <th className={styles.pupilsCat} aria-label="Category" />
              <th className={styles.pupilsCount}>WAVULANA / BOYS</th>
              <th className={styles.pupilsCount}>WASICHANA / GIRLS</th>
              <th className={styles.pupilsCount}>JUMLA / TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {PUPIL_ROWS.map((rowLabel) => (
              <tr key={rowLabel}>
                <td>{rowLabel}</td>
                {/* Counted by hand on the day. */}
                <td />
                <td />
                <td />
              </tr>
            ))}
          </tbody>
        </table>

        <Field
          label="Umahiri Mahususi / Specific Competence:"
          value={form.specificCompetence}
        />
        <Field label="Shughuli Kuu / Main Activity:" value={form.mainActivity} />
        <Field
          label="Shughuli Mahususi / Specific Activity:"
          value={form.specificActivity}
        />
        <Field
          label="Zana za Ufundishaji na Ujifunzaji / Teaching Aids & Resources:"
          value={form.teachingAids}
        />
        <Field label="Rejea / Reference:" value={form.reference} />
      </Page>

      {/* Sheet 2 — the first half of the process table. */}
      <Page>
        <p className={styles.processHeading}>
          MCHAKATO WA UFUNDISHAJI NA UJIFUNZAJI / LESSON PROCESS &amp; DEVELOPMENT
        </p>
        <table className={`${styles.table} ${styles.process}`}>
          <ProcessHead />
          <tbody>
            {intro ? <ProcessRow row={intro} /> : null}
            {competence ? <ProcessRow row={competence} /> : null}
          </tbody>
        </table>
      </Page>

      {/* Sheet 3 — the rest of the table, then the hand-written remarks. */}
      <Page>
        <p className={styles.processHeading}>
          MCHAKATO WA UFUNDISHAJI NA UJIFUNZAJI / LESSON PROCESS &amp; DEVELOPMENT
        </p>
        <table className={`${styles.table} ${styles.process}`}>
          <ProcessHead />
          <tbody>
            {design ? <ProcessRow row={design} /> : null}
            {assessment ? <ProcessRow row={assessment} /> : null}
          </tbody>
        </table>
        <p className={styles.remarks}>
          <span>MAONI / REMARKS:</span>
          <Rule />
        </p>
      </Page>
    </div>
  );
}
