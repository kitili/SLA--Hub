import "server-only";

import { randomUUID } from "node:crypto";

import { sql as drizzleSql } from "drizzle-orm";
import postgres from "postgres";

import { db } from "@/lib/db";

export const LINK_KINDS = ["ops.behaviour", "academics.pd", "talent.training"] as const;

export type LinkKind = (typeof LINK_KINDS)[number];

export type SystemLink = {
  id: string;
  kind: LinkKind;
  source: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type LinkInput = {
  kind: LinkKind;
  source: string;
  summary: string;
  payload: Record<string, unknown>;
  mode: "append" | "replace";
};

const SOURCES = new Set([
  "ops",
  "ops-history",
  "academics",
  "talent-academy",
  "student-experience",
  "onboarding",
  "marketing",
  "data-tech",
  "uniforms",
  "visitors",
  "workboard",
  "mel",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readPayload(payload: unknown): Record<string, unknown> {
  if (isRecord(payload)) return payload;
  if (typeof payload !== "string") return {};
  try {
    const parsed = JSON.parse(payload) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function clip(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

export function parseLinkInput(body: unknown): LinkInput | null {
  if (!isRecord(body)) return null;
  const kind = body.kind;
  if (typeof kind !== "string" || !LINK_KINDS.includes(kind as LinkKind)) return null;
  const source = clip(body.source, 40);
  if (!SOURCES.has(source)) return null;
  const payload = isRecord(body.payload) ? body.payload : null;
  if (!payload) return null;
  const encoded = JSON.stringify(payload);
  if (encoded.length > 20_000) return null;
  const mode = body.mode === "replace" ? "replace" : "append";
  return {
    kind: kind as LinkKind,
    source,
    summary: clip(body.summary, 180),
    payload,
    mode,
  };
}

let ready: Promise<void> | null = null;
let owner: ReturnType<typeof postgres> | null | undefined;

function ownerSql() {
  if (owner !== undefined) return owner;
  const url = process.env.DATABASE_URL?.trim();
  owner = url ? postgres(url, { prepare: false, max: 1 }) : null;
  return owner;
}

function ensureTable(): Promise<void> {
  if (!ready) {
    const statement = `
      CREATE TABLE IF NOT EXISTS system_links (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        source TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    const sql = ownerSql();
    const created = sql
      ? sql.unsafe(statement)
      : db.execute(drizzleSql.raw(statement));
    ready = Promise.resolve(created)
      .then(() => undefined)
      .catch((error) => {
        ready = null;
        throw error;
      });
  }
  return ready;
}

export async function saveSystemLink(input: LinkInput): Promise<SystemLink> {
  await ensureTable();
  const row: SystemLink = {
    id: randomUUID(),
    kind: input.kind,
    source: input.source,
    summary: input.summary,
    payload: input.payload,
    createdAt: new Date().toISOString(),
  };
  const sql = ownerSql();
  if (sql) {
    if (input.mode === "replace") {
      await sql`DELETE FROM system_links WHERE kind = ${input.kind} AND source = ${input.source}`;
    }
    await sql`
      INSERT INTO system_links (id, kind, source, summary, payload, created_at)
      VALUES (
        ${row.id},
        ${row.kind},
        ${row.source},
        ${row.summary},
        ${sql.json(row.payload as postgres.JSONValue)},
        ${row.createdAt}
      )
    `;
    if (input.mode === "append") {
      await sql`
        DELETE FROM system_links
        WHERE kind = ${input.kind}
          AND id NOT IN (
            SELECT id FROM system_links
            WHERE kind = ${input.kind}
            ORDER BY created_at DESC
            LIMIT 100
          )
      `;
    }
    return row;
  }

  if (input.mode === "replace") {
    await db.execute(
      drizzleSql`DELETE FROM system_links WHERE kind = ${input.kind} AND source = ${input.source}`,
    );
  }
  await db.execute(drizzleSql`
    INSERT INTO system_links (id, kind, source, summary, payload, created_at)
    VALUES (
      ${row.id},
      ${row.kind},
      ${row.source},
      ${row.summary},
      ${JSON.stringify(row.payload)}::jsonb,
      ${row.createdAt}
    )
  `);
  return row;
}

export async function listSystemLinks(kind: LinkKind): Promise<SystemLink[]> {
  await ensureTable();
  const sql = ownerSql();
  const result = sql
    ? await sql`
        SELECT id, kind, source, summary, payload, created_at
        FROM system_links
        WHERE kind = ${kind}
        ORDER BY created_at DESC
        LIMIT 100
      `
    : await db.execute(drizzleSql`
        SELECT id, kind, source, summary, payload, created_at
        FROM system_links
        WHERE kind = ${kind}
        ORDER BY created_at DESC
        LIMIT 100
      `);
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? []);
  return rows.map((row) => {
    const record = row as Record<string, unknown>;
    const payload = record.payload;
    return {
      id: String(record.id),
      kind: String(record.kind) as LinkKind,
      source: String(record.source),
      summary: String(record.summary ?? ""),
      payload: readPayload(payload),
      createdAt: new Date(String(record.created_at ?? record.createdAt)).toISOString(),
    };
  });
}
