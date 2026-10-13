import "server-only";

import { curriculumSql } from "@/lib/curriculum-db";
import { withOfflineCache, type Loaded } from "@/lib/curriculum-offline";
import { headlineMetric, type AssessmentPayload } from "./metrics";

export type AssessmentPoint = {
  school: string;
  grade: string;
  round: string;
  tool: string;
  value: number | null;
  band: string | null;
  studentRef: string;
};

export type AssessmentSnapshot = {
  points: AssessmentPoint[];
};

type Row = {
  school: string;
  grade: string;
  round_name: string;
  tool: string;
  student_ref: string;
  payload: AssessmentPayload;
};

async function readLive(): Promise<AssessmentSnapshot | null> {
  const sql = curriculumSql();
  if (!sql) return null;
  await sql`
    CREATE TABLE IF NOT EXISTS assessment_records (
      record_id TEXT PRIMARY KEY,
      recorded_at TIMESTAMPTZ,
      school TEXT NOT NULL DEFAULT '',
      grade TEXT NOT NULL DEFAULT '',
      round_name TEXT NOT NULL DEFAULT '',
      tool TEXT NOT NULL DEFAULT '',
      student_ref TEXT NOT NULL DEFAULT '',
      payload JSONB NOT NULL
    )
  `;
  const rows = (await sql`
    SELECT school, grade, round_name, tool, student_ref, payload
    FROM assessment_records
    ORDER BY recorded_at DESC NULLS LAST
  `) as Row[];
  return {
    points: rows.map((row) => {
      const metric = headlineMetric(row.tool, row.grade, row.payload ?? {});
      return {
        school: row.school || "—",
        grade: row.grade || "—",
        round: row.round_name || "—",
        tool: row.tool || "—",
        value: metric.value,
        band: metric.band,
        studentRef: row.student_ref || "",
      };
    }),
  };
}

export async function loadAssessmentSnapshot(): Promise<Loaded<AssessmentSnapshot> | null> {
  const sql = curriculumSql();
  const loaded = await withOfflineCache(
    "assessment-live.json",
    sql ? readLive : null,
    (data) => data != null,
  );
  if (!loaded || loaded.data == null) return null;
  return { data: loaded.data, source: loaded.source };
}
