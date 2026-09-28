/**
 * Unit tests for the official-form projection — pure, no I/O.
 *
 * The guards that matter here are the ones a wrong government form would fail
 * silently on: the grade prefix, the blank delivery fields, and the four
 * official steps staying in the form's own order.
 */
import { describe, it, expect } from "vitest";

import { VALID_PLAN } from "../../../test/fixtures/structuredPlan";
import { toComplianceForm } from "./mapPlan";

/** The fixture, with `identifier` fields overridden. */
function planWithIdentifier(overrides: Partial<typeof VALID_PLAN.identifier>) {
  return {
    ...VALID_PLAN,
    identifier: { ...VALID_PLAN.identifier, ...overrides },
  };
}

describe("toComplianceForm", () => {
  it("hard-sets the school and carries the identifier across", () => {
    const form = toComplianceForm(VALID_PLAN, 40);
    expect(form.schoolName).toBe("Silverleaf Academy");
    expect(form.subject).toBe("Arithmetic");
    expect(form.mainCompetence).toBe("4. Arithmetic");
    expect(form.specificCompetence).toBe("4.1 Recognise the concept of numbers");
    expect(form.mainActivity).toBe("Identifying groups with many and few objects");
  });

  it("strips the G prefix so the form never prints 'Grade G2'", () => {
    // The seeded corpus stores "G2"; the fixture stores "1". Both must print
    // as a bare number after "Grade ".
    expect(toComplianceForm(planWithIdentifier({ grade: "G2" }), 40).className).toBe(
      "Grade 2",
    );
    expect(toComplianceForm(planWithIdentifier({ grade: "1" }), 40).className).toBe(
      "Grade 1",
    );
  });

  it("renders the period length, falling back to 40 minutes", () => {
    expect(toComplianceForm(VALID_PLAN, 30).time).toBe("30 minutes");
    expect(toComplianceForm(VALID_PLAN, null).time).toBe("40 minutes");
  });

  it("joins success criteria and materials with '; '", () => {
    const form = toComplianceForm(VALID_PLAN, 40);
    expect(form.specificActivity).toBe(VALID_PLAN.success_criteria.join("; "));
    expect(form.teachingAids).toBe(VALID_PLAN.materials_and_prep.join("; "));
  });

  it("drops empty entries rather than emitting a dangling separator", () => {
    const form = toComplianceForm(
      { ...VALID_PLAN, materials_and_prep: ["Stones", "  ", "Bottle tops"] },
      40,
    );
    expect(form.teachingAids).toBe("Stones; Bottle tops");
  });

  it("cites the TIE scheme of work for the plan's own grade and subject", () => {
    const form = toComplianceForm(planWithIdentifier({ grade: "G2" }), 40);
    expect(form.reference).toBe(
      "Tanzania Institute of Education (TIE) — Grade 2 Arithmetic Scheme of Work",
    );
  });

  it("emits the four official steps in the form's order", () => {
    const form = toComplianceForm(VALID_PLAN, 40);
    expect(form.steps.map((step) => step.step)).toEqual([
      "UTANGULIZI / INTRODUCTION",
      "KUENDELEZA UJENZI WA UMAHIRI / COMPETENCE DEVELOPMENT",
      "KUBUNI / DESIGN",
      "TATHMINI / ASSESSMENT",
    ]);
  });

  it("leaves every step's TIME blank for the teacher to write in", () => {
    // We hold no per-stage timing; inventing it would put unauthored data on a
    // government form. The teacher fills this in by hand, like date and period.
    const form = toComplianceForm(VALID_PLAN, 40);
    expect(form.steps.map((step) => step.time)).toEqual(["", "", "", ""]);
  });

  it("maps the introduction from the hook", () => {
    const [intro] = toComplianceForm(VALID_PLAN, 40).steps;
    expect(intro!.teaching).toEqual([VALID_PLAN.teaching_sequence.introduction_hook.text]);
    expect(intro!.testing).toEqual([
      VALID_PLAN.teaching_sequence.introduction_hook.checkpoint,
    ]);
    expect(intro!.learning[0]).toContain(
      VALID_PLAN.teaching_sequence.introduction_hook.sentence_frame,
    );
  });

  it("folds I Do and We Do into the single COMPETENCE DEVELOPMENT step", () => {
    const competence = toComplianceForm(VALID_PLAN, 40).steps[1]!;
    expect(competence.teaching).toEqual([
      `I Do — ${VALID_PLAN.teaching_sequence.i_do.text}`,
      `We Do — ${VALID_PLAN.teaching_sequence.we_do.text}`,
    ]);
    // Both checkpoints survive — the form has one testing cell for the pair.
    expect(competence.testing[0]).toBe(
      `${VALID_PLAN.teaching_sequence.i_do.checkpoint}  |  ${VALID_PLAN.teaching_sequence.we_do.checkpoint}`,
    );
  });

  it("maps DESIGN from You Do and ASSESSMENT from the exit ticket", () => {
    const [, , design, assessment] = toComplianceForm(VALID_PLAN, 40).steps;
    expect(design!.teaching).toEqual([VALID_PLAN.teaching_sequence.you_do.text]);
    expect(assessment!.teaching[0]).toContain(VALID_PLAN.assessment_method);
    expect(assessment!.learning).toEqual([
      VALID_PLAN.conclusion_and_exit_ticket.exit_ticket,
    ]);
    expect(assessment!.testing).toEqual([
      VALID_PLAN.conclusion_and_exit_ticket.understanding,
    ]);
  });

  it("omits the frame clause when a stage carries no sentence frame", () => {
    const plan = structuredClone(VALID_PLAN);
    plan.teaching_sequence.introduction_hook.sentence_frame = "";
    const [intro] = toComplianceForm(plan, 40).steps;
    expect(intro!.learning[0]).toBe(
      "Learners observe and answer the guiding question orally.",
    );
  });
});
