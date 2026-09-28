/**
 * Tests for the official government form's markup.
 *
 * The load-bearing case is the bilingual labels. They are the government's own
 * form text and must print in Kiswahili AND English whatever locale the teacher
 * is in — so they are literals, not `t()` calls. That looks like an i18n bug to
 * a passing reader, and "fixing" it would quietly produce a form the school
 * cannot file. This pins it.
 *
 * The other guard is that the delivery fields stay blank: the whole point of the
 * handover's design is that the teacher completes them by hand.
 *
 * No DOM: the component is rendered to static markup. PrintButton is stubbed —
 * it is a client component wanting an intl provider, and it is not under test.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { toComplianceForm } from "@/lib/compliance/mapPlan";
import { VALID_PLAN } from "../../../../test/fixtures/structuredPlan";
import ComplianceDocument from "./ComplianceDocument";

vi.mock("./PrintButton", () => ({
  default: ({ label }: { label?: string }) => <button type="button">{label}</button>,
}));

function render(durationMinutes: number | null = 40) {
  return renderToStaticMarkup(
    <ComplianceDocument
      form={toComplianceForm(VALID_PLAN, durationMinutes)}
      fileName="plan.pdf"
      downloadLabel="Download government version"
    />,
  );
}

/** Strip tags and unescape entities, so assertions read as the teacher sees it. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

describe("ComplianceDocument — the official form", () => {
  it("prints every label bilingually, never through next-intl", () => {
    const text = textOf(render());
    for (const label of [
      "JINA LA SHULE / NAME OF SCHOOL:",
      "JINA LA MWALIMU / TEACHER'S NAME:",
      "UMAHIRI MKUU / MAIN COMPETENCE:",
      "SOMO / SUBJECT:",
      "DARASA / CLASS:",
      "MUDA / TIME:",
      "TAREHE / DATE:",
      "KIPINDI / PERIOD:",
      "IDADI YA WANAFUNZI / NUMBER OF PUPILS",
      "WAVULANA / BOYS",
      "WASICHANA / GIRLS",
      "JUMLA / TOTAL",
      "WALIOSAJILIWA / REGISTERED",
      "WALIOHUDHURIA / ATTENDED",
      "WATORO / ABSENTEES",
      "Umahiri Mahususi / Specific Competence:",
      "Shughuli Kuu / Main Activity:",
      "Shughuli Mahususi / Specific Activity:",
      "Zana za Ufundishaji na Ujifunzaji / Teaching Aids & Resources:",
      "Rejea / Reference:",
      "MCHAKATO WA UFUNDISHAJI NA UJIFUNZAJI / LESSON PROCESS & DEVELOPMENT",
      "HATUA / STEPS",
      "SHUGHULI ZA UFUNDISHAJI / TEACHING ACTIVITIES",
      "SHUGHULI ZA UJIFUNZAJI / LEARNING ACTIVITIES",
      "VIGEZO VYA UPIMAJI / TESTING CRITERIA",
      "MAONI / REMARKS:",
    ]) {
      expect(text).toContain(label);
    }
  });

  it("names the four official steps in the form's order", () => {
    const text = textOf(render());
    const order = [
      "UTANGULIZI / INTRODUCTION",
      "KUENDELEZA UJENZI WA UMAHIRI / COMPETENCE DEVELOPMENT",
      "KUBUNI / DESIGN",
      "TATHMINI / ASSESSMENT",
    ].map((step) => text.indexOf(step));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("exposes exactly one print root and one page per sheet", () => {
    const html = render();
    expect(html.match(/data-print-root/g)).toHaveLength(1);
    expect(html.match(/data-print-page/g)).toHaveLength(3);
  });

  it("fills the school and the plan's own identifying fields", () => {
    const text = textOf(render());
    expect(text).toContain("Silverleaf Academy");
    expect(text).toContain("Grade 1");
    expect(text).toContain("40 minutes");
    expect(text).toContain(VALID_PLAN.identifier.title);
    expect(text).toContain(
      "Tanzania Institute of Education (TIE) — Grade 1 Arithmetic Scheme of Work",
    );
  });

  it("leaves the hand-written delivery fields blank", () => {
    const html = render();
    // Pupil counts: three rows, three empty count cells each, plus the header's
    // empty corner. Any filled cell here means we invented attendance data.
    expect(html.match(/<td><\/td>/g)).toHaveLength(9);
    // Teacher's name, date, period and remarks are ruled blanks, not values.
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(4);
  });
});
