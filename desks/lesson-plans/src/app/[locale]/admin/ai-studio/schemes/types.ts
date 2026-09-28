/**
 * Shared client types for the Schemes of Work admin panel (list / detail /
 * upload views). These mirror the `listSchemes` / `getScheme` server-action
 * return shapes but are kept lightweight and serialisable so they can flow
 * through React state across the view components.
 */
import type { SchemeHeaderContext } from "@/lib/sow/types";

export type SchemeRow = {
  id: string;
  title: string;
  grade: string;
  subject: string;
  term: string;
  year?: string | null;
  rowCount: number;
};

export type SowLesson = {
  id: string;
  schemeId: string;
  orderIndex: number;
  week?: number | null;
  lessonNumber?: string | null;
  specificCompetence?: string | null;
  mainActivity?: string | null;
  lessonObjective?: string | null;
  knowledgeAndSkills?: string | null;
  assessmentEvidence?: string | null;
  learningActivities?: string | null;
  misconceptions?: string | null;
  differentiationSupport?: string | null;
  resources?: string | null;
  reflection?: string | null;
};

export type SchemeDetail = {
  id: string;
  title: string;
  grade: string;
  subject: string;
  term: string;
  year?: string | null;
  mainCompetence?: string | null;
  weeksCount?: number | null;
  lessonsPerWeek?: number | null;
  lessonDurationMins?: number | null;
  totalLessons?: string | null;
  headerContext?: SchemeHeaderContext | null;
};
