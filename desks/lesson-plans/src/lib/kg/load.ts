import "server-only";

import { curriculumSql } from "@/lib/curriculum-db";
import { withOfflineCache, type Loaded } from "@/lib/curriculum-offline";
import {
  KG_CLASSES,
  KG_CAMPUSES,
  type KgPayload,
  type ScoredRound,
  scoreRound,
} from "./score";

export type KgStoredStudent = {
  campus: string;
  className: string;
  teacher: string;
  name: string;
  rounds: ScoredRound[];
};

export type KgDeviceRow = {
  teacher: string;
  campus: string;
  className: string;
  lastSeen: string | null;
};

export type KgSnapshot = {
  students: KgStoredStudent[];
  devices: KgDeviceRow[];
  campuses: string[];
  classes: string[];
};

type RecordRow = {
  student_name: string;
  campus: string;
  class_name: string;
  teacher: string;
  payload: KgPayload;
};

type DeviceRow = {
  teacher: string;
  campus: string;
  class_name: string;
  last_seen: string | null;
};

async function readLive(): Promise<KgSnapshot | null> {
  const sql = curriculumSql();
  if (!sql) return null;
  await sql`
    CREATE TABLE IF NOT EXISTS kg_records (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      student_key TEXT NOT NULL,
      student_name TEXT NOT NULL DEFAULT '',
      campus TEXT NOT NULL DEFAULT '',
      class_name TEXT NOT NULL DEFAULT '',
      teacher TEXT NOT NULL DEFAULT '',
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ,
      synced_at TIMESTAMPTZ
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS kg_devices (
      device_id TEXT PRIMARY KEY,
      teacher TEXT NOT NULL DEFAULT '',
      campus TEXT NOT NULL DEFAULT '',
      class_name TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ,
      last_seen TIMESTAMPTZ
    )
  `;
  const records = (await sql`
    SELECT student_name, campus, class_name, teacher, payload
    FROM kg_records
    ORDER BY campus, class_name, student_name
  `) as RecordRow[];
  const devices = (await sql`
    SELECT teacher, campus, class_name, last_seen
    FROM kg_devices
    ORDER BY last_seen DESC NULLS LAST
  `) as DeviceRow[];

  return {
    campuses: [...new Set([...KG_CAMPUSES, ...records.map((row) => row.campus)].filter(Boolean))],
    classes: [...new Set([...KG_CLASSES, ...records.map((row) => row.class_name)].filter(Boolean))],
    students: records.map((row) => {
      const payload = row.payload ?? {};
      return {
        campus: payload.campus || row.campus || "—",
        className: payload.class || row.class_name || "—",
        teacher: row.teacher || "—",
        name: payload.name || row.student_name || "",
        rounds: [0, 1, 2].map((round) => scoreRound(payload, round)),
      };
    }),
    devices: devices.map((row) => ({
      teacher: row.teacher || "—",
      campus: row.campus || "—",
      className: row.class_name || "—",
      lastSeen: row.last_seen,
    })),
  };
}

export async function loadKgSnapshot(): Promise<Loaded<KgSnapshot> | null> {
  const sql = curriculumSql();
  const loaded = await withOfflineCache("kg-checklist.json", sql ? readLive : null, (data) => data != null);
  if (!loaded || loaded.data == null) return null;
  return { data: loaded.data, source: loaded.source };
}

export function chosenRound(student: KgStoredStudent, round: string): ScoredRound {
  const index = round === "latest" ? latestRoundFromScores(student) : Number(round);
  return student.rounds[index] ?? student.rounds[0]!;
}

function latestRoundFromScores(student: KgStoredStudent): number {
  for (let index = student.rounds.length - 1; index >= 0; index -= 1) {
    if (student.rounds[index]?.date) return index;
  }
  return 0;
}
