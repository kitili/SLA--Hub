import { curriculumSql } from "@/lib/curriculum-db";
import { withOfflineCache, type Loaded } from "@/lib/curriculum-offline";
import { presentCurriculum, presentPd } from "./normalize";
import type { FeedbackRow, RawCurriculum, RawPd } from "./types";

export async function listCurriculumFeedback(): Promise<Loaded<FeedbackRow[]> | null> {
  const sql = curriculumSql();
  const loaded = await withOfflineCache("curriculum-feedback.json", sql
    ? async () => (await sql`
        SELECT id, submitted_at, server_received_at, teacher_name, campus, role,
               tool_type, tool_ref, strengths_rating, strengths_comment,
               gaps_rating, gaps_comment, usability_rating, usability_comment, overall_comment
        FROM curriculum_feedback
        ORDER BY submitted_at DESC NULLS LAST
      `) as RawCurriculum[]
    : null);
  return loaded ? { data: presentCurriculum(loaded.data), source: loaded.source } : null;
}

export async function listPdFeedback(): Promise<Loaded<FeedbackRow[]> | null> {
  const sql = curriculumSql();
  const loaded = await withOfflineCache("pd-feedback.json", sql
    ? async () => (await sql`
        SELECT id, submitted_at, server_received_at, teacher_name, campus, role,
               pd_topic, pd_date, pd_facilitator,
               relevance_rating, relevance_comment,
               confidence_rating, confidence_comment,
               impact_rating, impact_comment,
               applied_status, support_needed
        FROM pd_feedback
        ORDER BY submitted_at DESC NULLS LAST
      `) as RawPd[]
    : null);
  return loaded ? { data: presentPd(loaded.data), source: loaded.source } : null;
}
