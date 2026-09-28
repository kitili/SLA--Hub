import { VisitRecord } from "@/domain/Visit";

export class VisitCsvExporter {
  export(rows: VisitRecord[]): string {
    const headers = [
      "Name",
      "Phone",
      "Campus",
      "Purpose",
      "Host",
      "Source",
      "Signed in",
      "Signed out",
    ];
    const lines = [headers.join(",")];
    for (const row of rows) {
      const values = [
        row.name,
        row.phone,
        row.campus,
        row.purpose,
        row.host,
        row.source,
        row.signedInAt,
        row.signedOutAt ?? "",
      ];
      lines.push(values.map((value) => this.cell(value)).join(","));
    }
    return lines.join("\n");
  }

  private cell(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }
}
