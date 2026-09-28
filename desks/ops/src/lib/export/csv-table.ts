import { toCsvWithBom } from "@/lib/export/xlsx";

export type CsvColumn<T> = {
  key: string;
  header: string;
  format?: (row: T) => string | number | null | undefined;
};

export function buildCsvExport<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => c.header);
  const body = rows.map((row) =>
    columns.map((c) =>
      c.format
        ? c.format(row)
        : ((row as Record<string, unknown>)[c.key] as string | number | null | undefined),
    ),
  );
  return toCsvWithBom([header, ...body]);
}
