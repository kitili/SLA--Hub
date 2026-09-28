/**
 * Tests for the branded document's export affordance.
 *
 * The rule this pins: teachers do NOT download the branded booklet — they
 * download the official government form (see ComplianceDocument). The branded
 * export survives only for the AI Studio preview, so it is opt-in and OFF by
 * default; a new surface that forgets `showPrint` gets the safe behaviour.
 *
 * No DOM: the component is rendered to static markup. PrintButton is stubbed —
 * it is a client component wanting an intl provider, and it is not under test.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { VALID_PLAN } from "../../../../test/fixtures/structuredPlan";
import LessonPlanDocument from "./LessonPlanDocument";

vi.mock("./PrintButton", () => ({
  default: () => <button type="button">print-button</button>,
}));

describe("LessonPlanDocument — branded PDF export", () => {
  it("offers no export by default, so the teacher page cannot leak it", () => {
    const html = renderToStaticMarkup(<LessonPlanDocument plan={VALID_PLAN} />);
    expect(html).not.toContain("print-button");
  });

  it("offers the export when a surface opts in (the Studio preview)", () => {
    const html = renderToStaticMarkup(<LessonPlanDocument plan={VALID_PLAN} showPrint />);
    expect(html).toContain("print-button");
  });

  it("still renders the three-page booklet either way", () => {
    for (const html of [
      renderToStaticMarkup(<LessonPlanDocument plan={VALID_PLAN} />),
      renderToStaticMarkup(<LessonPlanDocument plan={VALID_PLAN} showPrint />),
    ]) {
      expect(html.match(/data-print-root/g)).toHaveLength(1);
      expect(html.match(/data-print-page/g)).toHaveLength(3);
    }
  });
});
