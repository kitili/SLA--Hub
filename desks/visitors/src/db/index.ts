import Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { VisitRecord } from "@/domain/types";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  purpose TEXT NOT NULL,
  host TEXT NOT NULL,
  campus TEXT NOT NULL,
  date TEXT NOT NULL,
  photo TEXT,
  source TEXT NOT NULL CHECK(source IN ('desk', 'self')),
  signed_in_at TEXT NOT NULL,
  signed_out_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_visits_campus_date ON visits(campus, date);
CREATE INDEX IF NOT EXISTS idx_visits_signed_out ON visits(signed_out_at);
`;

const globalForDb = globalThis as typeof globalThis & {
  sqlite?: Database.Database;
};

export function getDatabase(): Database.Database {
  if (!globalForDb.sqlite) {
    const dbPath = path.join(process.cwd(), "data", "visits.db");
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.exec(SCHEMA);
    migrateJsonIfNeeded(db);
    globalForDb.sqlite = db;
  }
  return globalForDb.sqlite;
}

function migrateJsonIfNeeded(db: Database.Database) {
  const count = db.prepare("SELECT COUNT(*) AS total FROM visits").get() as { total: number };
  if (count.total > 0) return;

  const jsonPath = path.join(process.cwd(), "data", "visits.json");
  if (!existsSync(jsonPath)) return;

  const records = JSON.parse(readFileSync(jsonPath, "utf8")) as VisitRecord[];
  const insert = db.prepare(`
    INSERT INTO visits (
      id, name, phone, purpose, host, campus, date, photo, source, signed_in_at, signed_out_at
    ) VALUES (
      @id, @name, @phone, @purpose, @host, @campus, @date, @photo, @source, @signedInAt, @signedOutAt
    )
  `);

  const tx = db.transaction((rows: VisitRecord[]) => {
    for (const row of rows) {
      insert.run({
        ...row,
        campus: row.campus === "Arusha Town" ? "Arusha Modern" : row.campus,
        photo: row.photo?.startsWith("data:image/") ? null : row.photo,
      });
    }
  });
  tx(records);
}
