import type { DepartmentId } from "@/lib/departments";

/** shared.people.apps[] key for a hub department. */
export const DEPARTMENT_APP: Record<DepartmentId, string> = {
  onboarding: "onboarding",
  "talent-academy": "talent",
  "lesson-plans": "lesson_plans",
  "workboard-tasks": "workboard",
  "mel-dashboard": "mel",
  ops: "ops",
  uniforms: "uniforms",
  marketing: "marketing",
  "data-tech": "data_tech",
  visitors: "visitors",
};

export const APP_LABEL: Record<string, string> = {
  onboarding: "Onboarding",
  ops: "Ops",
  data_tech: "Data & Tech",
  workboard: "1–5’s",
  uniforms: "Uniforms",
  marketing: "Marketing",
  talent: "Talent Academy",
  visitors: "Visitors",
  lesson_plans: "Lesson Plans",
  mel: "MEL",
};

