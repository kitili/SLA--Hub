import { Visit } from "@/domain/Visit";
import { VisitRecord } from "@/domain/types";
import { getDatabase } from "@/db/index";
import { VisitQuery, VisitRepository } from "./VisitRepository";

type VisitRow = {
  id: string;
  name: string;
  phone: string;
  purpose: string;
  host: string;
  campus: string;
  date: string;
  photo: string | null;
  source: "desk" | "self";
  signed_in_at: string;
  signed_out_at: string | null;
};

export class SqliteVisitRepository implements VisitRepository {
  async all(): Promise<Visit[]> {
    const rows = getDatabase()
      .prepare("SELECT * FROM visits ORDER BY signed_in_at DESC")
      .all() as VisitRow[];
    return rows.map((row) => Visit.fromRecord(this.toRecord(row)));
  }

  async findById(id: string): Promise<Visit | null> {
    const row = getDatabase()
      .prepare("SELECT * FROM visits WHERE id = ?")
      .get(id) as VisitRow | undefined;
    return row ? Visit.fromRecord(this.toRecord(row)) : null;
  }

  async query(filters: VisitQuery): Promise<Visit[]> {
    const clauses: string[] = [];
    const params: Record<string, string | number> = {};

    if (filters.campus) {
      clauses.push("campus = @campus");
      params.campus = filters.campus;
    }
    if (filters.date) {
      clauses.push("date = @date");
      params.date = filters.date;
    }
    if (filters.dateFrom) {
      clauses.push("date >= @dateFrom");
      params.dateFrom = filters.dateFrom;
    }
    if (filters.dateTo) {
      clauses.push("date <= @dateTo");
      params.dateTo = filters.dateTo;
    }
    if (filters.onSiteOnly) {
      clauses.push("signed_out_at IS NULL");
    }
    if (filters.signedOutOnly) {
      clauses.push("signed_out_at IS NOT NULL");
    }
    if (filters.source) {
      clauses.push("source = @source");
      params.source = filters.source;
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = getDatabase()
      .prepare(`SELECT * FROM visits ${where} ORDER BY signed_in_at DESC`)
      .all(params) as VisitRow[];

    return rows.map((row) => Visit.fromRecord(this.toRecord(row)));
  }

  async save(visit: Visit): Promise<void> {
    const record = visit.toRecord();
    getDatabase()
      .prepare(
        `
        INSERT INTO visits (
          id, name, phone, purpose, host, campus, date, photo, source, signed_in_at, signed_out_at
        ) VALUES (
          @id, @name, @phone, @purpose, @host, @campus, @date, @photo, @source, @signedInAt, @signedOutAt
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          phone = excluded.phone,
          purpose = excluded.purpose,
          host = excluded.host,
          campus = excluded.campus,
          date = excluded.date,
          photo = excluded.photo,
          source = excluded.source,
          signed_in_at = excluded.signed_in_at,
          signed_out_at = excluded.signed_out_at
      `,
      )
      .run(record);
  }

  private toRecord(row: VisitRow): VisitRecord {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      purpose: row.purpose,
      host: row.host,
      campus: row.campus,
      date: row.date,
      photo: row.photo,
      source: row.source,
      signedInAt: row.signed_in_at,
      signedOutAt: row.signed_out_at,
    };
  }
}
